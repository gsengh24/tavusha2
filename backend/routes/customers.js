const express = require('express');
const supabase = require('../supabase');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// POST /api/customers/register  — storefront calls this on signup
// Public endpoint (no auth required). Stores customer info only
// (no password — passwords stay client-side in localStorage).
// ─────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check for existing customer
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existing) {
      // Already registered — return silently (don't error, customer may re-signup)
      return res.json({ message: 'already_registered' });
    }

    const { data, error } = await supabase
      .from('customers')
      .insert([{
        name: name.trim(),
        email: normalizedEmail,
        phone: (phone || '').trim(),
        joined_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ message: 'registered', customer: data });
  } catch (err) {
    // Don't crash the signup flow — just log and respond OK
    console.warn('Customer register error:', err.message);
    res.status(200).json({ message: 'ok' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/customers/admin  — Admin: list all registered customers
// ─────────────────────────────────────────────────────────────
router.get('/admin', protect, adminOnly, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('joined_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/customers/admin/:id  — Admin: remove a customer
// ─────────────────────────────────────────────────────────────
router.delete('/admin/:id', protect, adminOnly, async (req, res) => {
  try {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Customer removed' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
