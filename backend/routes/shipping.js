const express = require('express');
const ShippingZone = require('../models/ShippingZone');
const { protect, adminOnly } = require('../middleware/auth');
const supabase = require('../supabase');

const router = express.Router();

// ═══════════════════════════════════════════════════════════
// PUBLIC
// ═══════════════════════════════════════════════════════════

// GET /api/shipping/calculate?pincode=110001&pieces=2
router.get('/calculate', async (req, res) => {
  try {
    const { pincode, pieces } = req.query;
    if (!pincode) return res.status(400).json({ message: 'pincode is required' });

    const zone = await ShippingZone.findByPincode(pincode);
    const qty = Math.max(1, parseInt(pieces) || 1);

    // Check free shipping threshold
    const subtotal = parseFloat(req.query.subtotal) || 0;
    let charge = zone.rate_per_piece * qty;
    let isFree = false;

    if (zone.free_shipping_above && subtotal >= zone.free_shipping_above) {
      charge = 0;
      isFree = true;
    }

    res.json({
      pincode,
      zone_name: zone.name,
      rate_per_piece: zone.rate_per_piece,
      pieces: qty,
      shipping_charge: charge,
      is_free: isFree,
      free_above: zone.free_shipping_above || null,
    });
  } catch (err) {
    res.status(500).json({ message: 'Shipping calculation failed', error: err.message });
  }
});

// GET /api/shipping/zones — public list of zones (for display at checkout)
router.get('/zones', async (req, res) => {
  try {
    const zones = await ShippingZone.getActive();
    // Return simplified public info (don't expose pincode_prefixes internals)
    const publicZones = zones.map(z => ({
      id: z.id,
      name: z.name,
      rate_per_piece: z.rate_per_piece,
      states: z.states,
      free_shipping_above: z.free_shipping_above,
    }));
    res.json(publicZones);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load zones', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════════════════

// GET /api/shipping/admin/zones — full zone data
router.get('/admin/zones', protect, adminOnly, async (req, res) => {
  try {
    const zones = await ShippingZone.getAll();
    res.json(zones);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load zones', error: err.message });
  }
});

// POST /api/shipping/admin/zones
router.post('/admin/zones', protect, adminOnly, async (req, res) => {
  try {
    const { name, rate_per_piece, states, pincode_prefixes, free_shipping_above } = req.body;
    if (!name || rate_per_piece === undefined) {
      return res.status(400).json({ message: 'name and rate_per_piece are required' });
    }
    const zone = await ShippingZone.create({
      name, rate_per_piece: Number(rate_per_piece),
      states: Array.isArray(states) ? states : (states ? states.split(',').map(s => s.trim()) : []),
      pincode_prefixes: Array.isArray(pincode_prefixes) ? pincode_prefixes : (pincode_prefixes ? pincode_prefixes.split(',').map(s => s.trim()) : []),
      free_shipping_above: free_shipping_above ? Number(free_shipping_above) : null,
    });
    res.status(201).json(zone);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create zone', error: err.message });
  }
});

// PUT /api/shipping/admin/zones/:id
router.put('/admin/zones/:id', protect, adminOnly, async (req, res) => {
  try {
    const fields = { ...req.body };
    if (fields.rate_per_piece !== undefined) fields.rate_per_piece = Number(fields.rate_per_piece);
    if (fields.free_shipping_above !== undefined) fields.free_shipping_above = fields.free_shipping_above ? Number(fields.free_shipping_above) : null;
    if (typeof fields.states === 'string') fields.states = fields.states.split(',').map(s => s.trim());
    if (typeof fields.pincode_prefixes === 'string') fields.pincode_prefixes = fields.pincode_prefixes.split(',').map(s => s.trim());
    if (typeof fields.is_active === 'string') fields.is_active = fields.is_active === 'true';
    const zone = await ShippingZone.update(req.params.id, fields);
    res.json(zone);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update zone', error: err.message });
  }
});

// DELETE /api/shipping/admin/zones/:id
router.delete('/admin/zones/:id', protect, adminOnly, async (req, res) => {
  try {
    await ShippingZone.delete(req.params.id);
    res.json({ message: 'Zone deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete zone', error: err.message });
  }
});

module.exports = router;
