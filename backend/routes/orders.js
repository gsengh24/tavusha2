const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const Order = require('../models/Order');
const ShippingZone = require('../models/ShippingZone');
const whatsapp = require('../services/whatsapp');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Initialize Razorpay (will warn if not configured)
let razorpay;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
} else {
  console.warn('⚠️ Razorpay not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
}

// ═══════════════════════════════════════════════════════════
// PUBLIC — Checkout Flow
// ═══════════════════════════════════════════════════════════

// POST /api/orders — Create order + generate Razorpay payment
router.post('/', async (req, res) => {
  try {
    const {
      customer_name, customer_phone, customer_email,
      delivery_address, pincode,
      items, payment_type,
      special_instructions
    } = req.body;

    if (!customer_name || !customer_phone || !pincode || !items || !items.length) {
      return res.status(400).json({ message: 'Missing required order fields' });
    }

    // Calculate subtotal
    const subtotal = items.reduce((sum, i) => sum + (Number(i.price) * Number(i.qty || 1)), 0);
    const item_count = items.reduce((sum, i) => sum + Number(i.qty || 1), 0);

    // Calculate shipping
    const zone = await ShippingZone.findByPincode(pincode);
    let shipping_charge = zone.rate_per_piece * item_count;
    if (zone.free_shipping_above && subtotal >= zone.free_shipping_above) shipping_charge = 0;

    const total = subtotal + shipping_charge;

    // COD: 20% advance required
    const COD_ADVANCE_PCT = Number(process.env.COD_ADVANCE_PCT || 20) / 100;
    const advance_required = payment_type === 'cod' ? Math.ceil(total * COD_ADVANCE_PCT) : total;

    // Create Razorpay order for the payment amount
    let razorpay_order_id = '';
    let razorpay_key = process.env.RAZORPAY_KEY_ID || '';
    
    if (razorpay) {
      const rp_order = await razorpay.orders.create({
        amount: Math.round(advance_required * 100), // paise
        currency: 'INR',
        receipt: `TAV-${Date.now()}`,
        notes: {
          customer_name,
          customer_phone,
          payment_type: payment_type || 'cod',
        },
      });
      razorpay_order_id = rp_order.id;
    }

    // Create order in DB
    const order = await Order.create({
      customer_name,
      customer_phone,
      customer_email,
      delivery_address,
      pincode,
      shipping_zone: zone.name,
      shipping_charge,
      items,
      item_count,
      subtotal,
      total,
      payment_type: payment_type || 'cod',
      advance_required,
      razorpay_order_id,
      special_instructions,
    });

    res.status(201).json({
      order,
      razorpay: {
        key: razorpay_key,
        order_id: razorpay_order_id,
        amount: Math.round(advance_required * 100),
        currency: 'INR',
        name: 'TAVUSHA',
        description: `Order ${order.order_number} — ${payment_type === 'cod' ? '20% Advance' : 'Full Payment'}`,
        prefill: {
          name: customer_name,
          contact: customer_phone,
          email: customer_email || '',
        },
        theme: { color: '#1a1a1a' },
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Order creation failed', error: err.message });
  }
});

// POST /api/orders/verify-payment — frontend calls after Razorpay payment
router.post('/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing payment verification fields' });
    }

    // Verify signature
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ message: 'Payment signature verification failed' });
    }

    // Find order
    const order = await Order.findByRazorpayOrderId(razorpay_order_id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Update payment
    const isFullyPaid = order.payment_type === 'prepaid';
    const updated = await Order.update(order.id, {
      razorpay_payment_id,
      razorpay_signature,
      advance_paid: order.advance_required,
      payment_status: isFullyPaid ? 'paid' : 'advance_paid',
    });

    // Send WhatsApp messages
    try {
      await whatsapp.sendOrderConfirmation(order.customer_phone, updated);
      await Order.appendWhatsAppLog(order.id, { type: 'order_confirmation', status: 'sent' });
      await whatsapp.sendPaymentConfirmation(order.customer_phone, updated, order.advance_required);
      await Order.appendWhatsAppLog(order.id, { type: 'payment_confirmation', status: 'sent' });
      await Order.update(order.id, { whatsapp_sent: true });
    } catch (waErr) {
      console.error('WhatsApp send failed:', waErr.message);
    }

    res.json({ success: true, order: updated });
  } catch (err) {
    res.status(500).json({ message: 'Payment verification failed', error: err.message });
  }
});

// POST /api/orders/webhook — Razorpay webhook (server-to-server)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

    if (secret) {
      const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(req.body)
        .digest('hex');
      if (expectedSig !== sig) {
        return res.status(400).json({ message: 'Invalid webhook signature' });
      }
    }

    const event = JSON.parse(req.body.toString());
    const entity = event?.payload?.payment?.entity;

    if (event.event === 'payment.captured' && entity) {
      const order = await Order.findByRazorpayOrderId(entity.order_id);
      if (order && order.payment_status === 'pending') {
        const amountPaid = entity.amount / 100;
        const isFullyPaid = order.payment_type === 'prepaid';
        const updated = await Order.update(order.id, {
          razorpay_payment_id: entity.id,
          advance_paid: amountPaid,
          payment_status: isFullyPaid ? 'paid' : 'advance_paid',
        });

        // WhatsApp notifications
        try {
          await whatsapp.sendOrderConfirmation(order.customer_phone, { ...updated, created_at: order.created_at });
          await whatsapp.sendPaymentConfirmation(order.customer_phone, updated, amountPaid);
          await Order.update(order.id, { whatsapp_sent: true });
        } catch (waErr) {
          console.error('WhatsApp webhook error:', waErr.message);
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(500).json({ message: 'Webhook error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════════════════

// GET /api/orders/admin/all
router.get('/admin/all', protect, adminOnly, async (req, res) => {
  try {
    const { status, payment_status } = req.query;
    const orders = await Order.findAll({ status, payment_status });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load orders', error: err.message });
  }
});

// GET /api/orders/admin/:id
router.get('/admin/:id', protect, adminOnly, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load order', error: err.message });
  }
});

// PATCH /api/orders/admin/:id/status — update order status + trigger WA
router.patch('/admin/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { order_status, tracking_number, tracking_url, tracking_courier, shipping_charge, admin_notes } = req.body;
    const fields = {};
    if (order_status) fields.order_status = order_status;
    if (tracking_number !== undefined) fields.tracking_number = tracking_number;
    if (tracking_url !== undefined) fields.tracking_url = tracking_url;
    if (tracking_courier !== undefined) fields.tracking_courier = tracking_courier;
    if (shipping_charge !== undefined) fields.shipping_charge = Number(shipping_charge);
    if (admin_notes !== undefined) fields.admin_notes = admin_notes;

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    const updated = await Order.update(order.id, fields);

    // Auto-send WhatsApp based on new status
    if (order_status === 'shipped') {
      try {
        await whatsapp.sendShippingUpdate(order.customer_phone, { ...updated, created_at: order.created_at });
        await Order.appendWhatsAppLog(order.id, { type: 'shipping_update', status: 'sent' });
      } catch (waErr) { console.error('WhatsApp shipping error:', waErr.message); }
    }
    if (order_status === 'delivered') {
      try {
        await whatsapp.sendDeliveryConfirmation(order.customer_phone, { ...updated, created_at: order.created_at });
        await Order.appendWhatsAppLog(order.id, { type: 'delivery_confirmation', status: 'sent' });
        // Schedule feedback after 2 days (simple timeout — replace with cron in production)
        setTimeout(async () => {
          try {
            await whatsapp.sendFeedbackRequest(order.customer_phone, order);
            await Order.appendWhatsAppLog(order.id, { type: 'feedback_request', status: 'sent' });
          } catch (e) { console.error('WA feedback error:', e.message); }
        }, 2 * 24 * 60 * 60 * 1000);
      } catch (waErr) { console.error('WhatsApp delivery error:', waErr.message); }
    }
    if (order_status === 'out_for_delivery' && order.payment_type === 'cod') {
      try {
        await whatsapp.sendCodReminder(order.customer_phone, updated);
        await Order.appendWhatsAppLog(order.id, { type: 'cod_reminder', status: 'sent' });
      } catch (waErr) { console.error('WhatsApp COD reminder error:', waErr.message); }
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Status update failed', error: err.message });
  }
});

// POST /api/orders/admin/:id/resend-whatsapp — manually resend WA message
router.post('/admin/:id/resend-whatsapp', protect, adminOnly, async (req, res) => {
  try {
    const { type } = req.body; // 'order_confirmation'|'payment_confirmation'|'shipping_update'|'delivery_confirmation'|'feedback'
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    let result;
    switch (type) {
      case 'order_confirmation': result = await whatsapp.sendOrderConfirmation(order.customer_phone, order); break;
      case 'payment_confirmation': result = await whatsapp.sendPaymentConfirmation(order.customer_phone, order, order.advance_paid); break;
      case 'shipping_update': result = await whatsapp.sendShippingUpdate(order.customer_phone, order); break;
      case 'delivery_confirmation': result = await whatsapp.sendDeliveryConfirmation(order.customer_phone, order); break;
      case 'feedback': result = await whatsapp.sendFeedbackRequest(order.customer_phone, order); break;
      default: return res.status(400).json({ message: 'Invalid message type' });
    }
    await Order.appendWhatsAppLog(order.id, { type, status: result.success ? 'resent' : 'failed', ...result });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ message: 'Failed to resend WhatsApp', error: err.message });
  }
});

module.exports = router;
