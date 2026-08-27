const express = require('express');
const fs = require('fs');
const path = require('path');
const { protect, adminOnly } = require('../middleware/auth');
const supabase = require('../supabase');

const router = express.Router();

const COUPON_FILE = path.join(__dirname, 'coupons_data.json');

function loadFileCoupons() {
  try {
    if (fs.existsSync(COUPON_FILE)) return JSON.parse(fs.readFileSync(COUPON_FILE, 'utf8'));
  } catch (_) {}
  return [];
}

function saveFileCoupons(list) {
  try { fs.writeFileSync(COUPON_FILE, JSON.stringify(list, null, 2), 'utf8'); } catch (_) {}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function generateCode(prefix = 'TAVUSHA') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}${suffix}`;
}

async function dbGetAll() {
  const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function dbGetByCode(code) {
  const { data, error } = await supabase.from('coupons').select('*').ilike('code', code).maybeSingle();
  if (error) throw error;
  return data;
}

async function dbCreate(fields) {
  const { data, error } = await supabase.from('coupons').insert([fields]).select().single();
  if (error) throw error;
  return data;
}

async function dbUpdate(id, fields) {
  const { data, error } = await supabase.from('coupons').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function dbDelete(id) {
  const { error } = await supabase.from('coupons').delete().eq('id', id);
  if (error) throw error;
}

// ─── Fallback: file-based store ──────────────────────────────────────────────
function fileCoupons() {
  return loadFileCoupons();
}

function fileSaveCoupon(coupon) {
  const list = loadFileCoupons();
  const idx = list.findIndex(c => c.id === coupon.id);
  if (idx >= 0) list[idx] = coupon;
  else list.push(coupon);
  saveFileCoupons(list);
}

function fileDeleteCoupon(id) {
  const list = loadFileCoupons().filter(c => c.id !== id);
  saveFileCoupons(list);
}

// ═══════════════════════════════════════════════════════════
// PUBLIC — Validate a coupon at checkout
// POST /api/coupons/validate
// Body: { code, subtotal }
// ═══════════════════════════════════════════════════════════
router.post('/validate', async (req, res) => {
  try {
    const { code, subtotal } = req.body;
    if (!code) return res.status(400).json({ valid: false, message: 'No coupon code provided.' });

    let coupon;
    try {
      coupon = await dbGetByCode(code.trim().toUpperCase());
    } catch (_) {
      // Supabase down — search file store
      const all = fileCoupons();
      coupon = all.find(c => c.code.toUpperCase() === code.trim().toUpperCase()) || null;
    }

    if (!coupon) return res.json({ valid: false, message: 'Invalid coupon code.' });
    if (!coupon.is_active) return res.json({ valid: false, message: 'This coupon is no longer active.' });

    const now = new Date();
    if (coupon.expires_at && new Date(coupon.expires_at) < now) {
      return res.json({ valid: false, message: 'This coupon has expired.' });
    }
    if (coupon.starts_at && new Date(coupon.starts_at) > now) {
      return res.json({ valid: false, message: 'This coupon is not yet active.' });
    }
    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
      return res.json({ valid: false, message: 'This coupon has reached its usage limit.' });
    }

    const sub = Number(subtotal) || 0;
    if (coupon.min_order_amount && sub < coupon.min_order_amount) {
      return res.json({
        valid: false,
        message: `Minimum order amount for this coupon is ₹${Number(coupon.min_order_amount).toLocaleString('en-IN')}.`
      });
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discount_type === 'percent') {
      discount = Math.round((sub * coupon.discount_value) / 100);
      if (coupon.max_discount_amount && discount > coupon.max_discount_amount) {
        discount = coupon.max_discount_amount;
      }
    } else if (coupon.discount_type === 'flat') {
      discount = Math.min(coupon.discount_value, sub); // can't discount more than subtotal
    } else if (coupon.discount_type === 'free_shipping') {
      discount = 0; // handled in frontend by zeroing shipping
    }

    return res.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        max_discount_amount: coupon.max_discount_amount || null,
        description: coupon.description || ''
      },
      discount,
      message: `Coupon applied! You save ₹${discount.toLocaleString('en-IN')}${coupon.discount_type === 'free_shipping' ? ' (Free Shipping!)' : ''}.`
    });
  } catch (err) {
    res.status(500).json({ valid: false, message: 'Could not validate coupon.', error: err.message });
  }
});

// POST /api/coupons/redeem — increment usage on order placement
router.post('/redeem', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.json({ ok: true });
    try {
      const coupon = await dbGetByCode(code.trim().toUpperCase());
      if (coupon) await dbUpdate(coupon.id, { used_count: (coupon.used_count || 0) + 1 });
    } catch (_) {
      const all = fileCoupons();
      const c = all.find(x => x.code.toUpperCase() === code.trim().toUpperCase());
      if (c) { c.used_count = (c.used_count || 0) + 1; fileSaveCoupon(c); }
    }
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: true }); // non-critical, don't block order
  }
});

// ═══════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════════════════

// GET /api/coupons/admin — all coupons
router.get('/admin', protect, adminOnly, async (req, res) => {
  try {
    let coupons;
    try { coupons = await dbGetAll(); } catch (_) { coupons = fileCoupons(); }
    res.json(coupons || []);
  } catch (err) {
    res.json(fileCoupons());
  }
});

// POST /api/coupons/admin — create coupon
router.post('/admin', protect, adminOnly, async (req, res) => {
  try {
    const {
      code, discount_type, discount_value, max_discount_amount,
      min_order_amount, max_uses, expires_at, starts_at,
      description, is_active
    } = req.body;

    const finalCode = (code || generateCode()).trim().toUpperCase().replace(/\s+/g, '');

    const fields = {
      code: finalCode,
      discount_type: discount_type || 'percent',
      discount_value: Number(discount_value) || 10,
      max_discount_amount: max_discount_amount ? Number(max_discount_amount) : null,
      min_order_amount: min_order_amount ? Number(min_order_amount) : null,
      max_uses: max_uses ? Number(max_uses) : null,
      used_count: 0,
      expires_at: expires_at || null,
      starts_at: starts_at || null,
      description: description || '',
      is_active: is_active !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    let coupon;
    try {
      coupon = await dbCreate(fields);
      try { fileSaveCoupon(coupon); } catch (_) {}
    } catch (dbErr) {
      console.warn('[Coupons] Supabase create failed, using file store:', dbErr.message);
      const id = 'cpu_' + Date.now();
      coupon = { id, ...fields };
      fileSaveCoupon(coupon);
    }
    res.status(201).json(coupon);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create coupon', error: err.message });
  }
});

// PUT /api/coupons/admin/:id — update coupon
router.put('/admin/:id', protect, adminOnly, async (req, res) => {
  try {
    const {
      code, discount_type, discount_value, max_discount_amount,
      min_order_amount, max_uses, expires_at, starts_at,
      description, is_active
    } = req.body;

    const fields = {};
    if (code !== undefined) fields.code = code.trim().toUpperCase();
    if (discount_type !== undefined) fields.discount_type = discount_type;
    if (discount_value !== undefined) fields.discount_value = Number(discount_value);
    if (max_discount_amount !== undefined) fields.max_discount_amount = max_discount_amount ? Number(max_discount_amount) : null;
    if (min_order_amount !== undefined) fields.min_order_amount = min_order_amount ? Number(min_order_amount) : null;
    if (max_uses !== undefined) fields.max_uses = max_uses ? Number(max_uses) : null;
    if (expires_at !== undefined) fields.expires_at = expires_at || null;
    if (starts_at !== undefined) fields.starts_at = starts_at || null;
    if (description !== undefined) fields.description = description;
    if (is_active !== undefined) fields.is_active = is_active;

    let coupon;
    try {
      coupon = await dbUpdate(req.params.id, fields);
      try { fileSaveCoupon(coupon); } catch (_) {}
    } catch (dbErr) {
      const all = fileCoupons();
      const idx = all.findIndex(c => c.id === req.params.id);
      if (idx < 0) return res.status(404).json({ message: 'Coupon not found' });
      coupon = { ...all[idx], ...fields, updated_at: new Date().toISOString() };
      fileSaveCoupon(coupon);
    }
    res.json(coupon);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update coupon', error: err.message });
  }
});

// DELETE /api/coupons/admin/:id
router.delete('/admin/:id', protect, adminOnly, async (req, res) => {
  try {
    try { await dbDelete(req.params.id); } catch (_) {}
    fileDeleteCoupon(req.params.id);
    res.json({ message: 'Coupon deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete coupon', error: err.message });
  }
});

// POST /api/coupons/admin/generate-code — generate a random code
router.post('/admin/generate-code', protect, adminOnly, (req, res) => {
  const { prefix } = req.body;
  res.json({ code: generateCode(prefix || 'TAV') });
});

module.exports = router;
