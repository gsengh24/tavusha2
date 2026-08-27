const supabase = require('../supabase');

function generateOrderNumber() {
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `TAV-${year}-${rand}`;
}

class OrderModel {
  static async findAll(filters = {}) {
    try {
      let q = supabase.from('orders').select('*');
      if (filters.status) q = q.eq('order_status', filters.status);
      if (filters.payment_status) q = q.eq('payment_status', filters.payment_status);
      q = q.order('created_at', { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('Order.findAll DB warning:', e.message);
      return [];
    }
  }

  static async findById(id) {
    try {
      const { data, error } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn('Order.findById DB warning:', e.message);
      return null;
    }
  }

  static async findByOrderNumber(orderNumber) {
    try {
      const { data, error } = await supabase.from('orders').select('*').eq('order_number', orderNumber).maybeSingle();
      if (error) throw error;
      return data;
    } catch (e) {
      return null;
    }
  }

  static async findByRazorpayOrderId(razorpayOrderId) {
    try {
      const { data, error } = await supabase.from('orders').select('*').eq('razorpay_order_id', razorpayOrderId).maybeSingle();
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn('Order.findByRazorpayOrderId DB warning:', e.message);
      return null;
    }
  }

  static async create(fields) {
    let orderNumber = generateOrderNumber();
    try {
      const existing = await this.findByOrderNumber(orderNumber);
      if (existing) orderNumber = generateOrderNumber();
    } catch (e) {}

    const payload = {
      order_number: orderNumber,
      customer_name: fields.customer_name,
      customer_phone: fields.customer_phone,
      customer_email: fields.customer_email || '',
      delivery_address: fields.delivery_address,
      pincode: fields.pincode,
      shipping_zone: fields.shipping_zone || '',
      shipping_charge: fields.shipping_charge || 0,
      items: fields.items,
      item_count: fields.item_count || (fields.items ? fields.items.length : 1),
      subtotal: fields.subtotal,
      discount_amount: fields.discount_amount || 0,
      coupon_code: fields.coupon_code || '',
      total: fields.total,
      payment_type: fields.payment_type || 'cod',
      advance_required: fields.advance_required || 0,
      advance_paid: 0,
      payment_status: 'pending',
      razorpay_order_id: fields.razorpay_order_id || '',
      order_status: 'confirmed',
      special_instructions: fields.special_instructions || '',
    };

    try {
      const { data, error } = await supabase.from('orders').insert([payload]).select().single();
      if (!error && data) return data;
    } catch (err) {
      console.warn('Order DB write fallback:', err.message);
    }

    return {
      id: 'ord_' + Date.now(),
      ...payload,
      created_at: new Date().toISOString()
    };
  }

  static async update(id, fields) {
    const update = { updated_at: new Date().toISOString() };
    const allowed = [
      'order_status','payment_status','advance_paid','razorpay_payment_id',
      'razorpay_order_id','razorpay_signature','tracking_number','tracking_url',
      'tracking_courier','whatsapp_sent','whatsapp_log','admin_notes',
      'shipping_charge'
    ];
    allowed.forEach(k => { if (fields[k] !== undefined) update[k] = fields[k]; });
    
    try {
      const { data, error } = await supabase.from('orders').update(update).eq('id', id).select().single();
      if (!error && data) return data;
    } catch (e) {
      console.warn('Order.update DB warning:', e.message);
    }

    return { id, ...fields, updated_at: update.updated_at };
  }

  static async appendWhatsAppLog(id, entry) {
    try {
      const order = await this.findById(id);
      if (!order) return;
      const log = Array.isArray(order.whatsapp_log) ? order.whatsapp_log : [];
      log.push({ ...entry, timestamp: new Date().toISOString() });
      await supabase.from('orders').update({ whatsapp_log: log, updated_at: new Date().toISOString() }).eq('id', id);
    } catch (e) {
      console.warn('appendWhatsAppLog warning:', e.message);
    }
  }
}

module.exports = OrderModel;

