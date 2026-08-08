// WhatsApp Business Cloud API (Meta) Service
// Sends automated WhatsApp messages using Meta's official Cloud API
// Requires: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID in .env

const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const WA_TOKEN = process.env.WHATSAPP_TOKEN;
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WA_API_URL = `https://graph.facebook.com/v18.0/${WA_PHONE_ID}/messages`;

// Format phone for WhatsApp (must be in international format without +)
function formatPhone(phone) {
  let p = String(phone).replace(/\D/g, '');
  if (p.startsWith('0')) p = p.slice(1);
  if (!p.startsWith('91') && p.length === 10) p = '91' + p;
  return p;
}

function formatCurrency(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN');
}

function formatItems(items) {
  if (!Array.isArray(items)) return '';
  return items.map(i => `• ${i.title} (${i.size || 'One Size'}, ${i.colour || ''}) × ${i.qty || 1} — ${formatCurrency(i.price)}`).join('\n');
}

async function sendMessage(phone, message) {
  if (!WA_TOKEN || !WA_PHONE_ID) {
    console.warn('⚠️ WhatsApp not configured. Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env');
    return { skipped: true, reason: 'WhatsApp not configured' };
  }

  const to = formatPhone(phone);
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: message },
  };

  try {
    const res = await fetch(WA_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('WhatsApp API error:', data);
      return { success: false, error: data };
    }
    return { success: true, data };
  } catch (err) {
    console.error('WhatsApp send error:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── Message Templates ────────────────────────────────────────────────────────

async function sendOrderConfirmation(phone, order) {
  const itemsText = formatItems(order.items);
  const msg = `🛍️ *Order Confirmed — TAVUSHA*

Hello ${order.customer_name}! Your order has been placed successfully.

*Order Details*
━━━━━━━━━━━━━━━━━
Order No: *${order.order_number}*
Date: ${new Date(order.created_at).toLocaleDateString('en-IN')}

${itemsText}

━━━━━━━━━━━━━━━━━
Subtotal: ${formatCurrency(order.subtotal)}
Shipping: ${formatCurrency(order.shipping_charge)} (${order.shipping_zone || 'Standard'})
*Total: ${formatCurrency(order.total)}*

Payment: ${order.payment_type === 'cod' ? 'Cash on Delivery (20% advance paid)' : 'Prepaid'}
Payment Status: ${order.payment_status === 'advance_paid' ? '✅ Advance Received' : order.payment_status === 'paid' ? '✅ Fully Paid' : '⏳ Pending'}

📦 Deliver to:
${order.delivery_address?.line1 || ''}
${order.delivery_address?.city || ''}, ${order.delivery_address?.state || ''} - ${order.pincode}

We'll notify you once your order is shipped!

Thank you for shopping with TAVUSHA 💛
_www.tavusha.in_`;

  return sendMessage(phone, msg);
}

async function sendPaymentConfirmation(phone, order, amountPaid) {
  const msg = `✅ *Payment Received — TAVUSHA*

Hello ${order.customer_name}!

We've received your payment for Order *${order.order_number}*.

Amount Paid: *${formatCurrency(amountPaid)}*
Payment ID: ${order.razorpay_payment_id || 'N/A'}
Total Order: ${formatCurrency(order.total)}

${order.payment_type === 'cod' ? `⚠️ Remaining COD amount to be paid at delivery: *${formatCurrency(order.total - amountPaid)}*` : '✅ Full payment received — no payment needed at delivery!'}

Your order is now confirmed and will be processed shortly.

Thank you for shopping with TAVUSHA 💛`;

  return sendMessage(phone, msg);
}

async function sendShippingUpdate(phone, order) {
  const msg = `🚚 *Your Order is Shipped! — TAVUSHA*

Hello ${order.customer_name}!

Great news! Your order *${order.order_number}* has been shipped.

🏷️ Courier: ${order.tracking_courier || 'Standard Courier'}
📦 Tracking No: *${order.tracking_number || 'N/A'}*
${order.tracking_url ? `🔗 Track here: ${order.tracking_url}` : ''}

Items in this shipment:
${formatItems(order.items)}

Estimated delivery: 3–7 business days

📍 Delivering to:
${order.delivery_address?.city || ''}, ${order.delivery_address?.state || ''} - ${order.pincode}

If you have any questions, reply to this message.

TAVUSHA 💛 | www.tavusha.in`;

  return sendMessage(phone, msg);
}

async function sendDeliveryConfirmation(phone, order) {
  const msg = `🎉 *Delivered! — TAVUSHA*

Hello ${order.customer_name}!

Your order *${order.order_number}* has been delivered successfully!

We hope you love your purchase 💛

${order.payment_type === 'cod' ? `💵 COD Amount: Please ensure the delivery amount of *${formatCurrency(order.total - order.advance_paid)}* has been paid to the delivery person.` : ''}

Items delivered:
${formatItems(order.items)}

Thank you for shopping with TAVUSHA!`;

  return sendMessage(phone, msg);
}

async function sendFeedbackRequest(phone, order) {
  const msg = `⭐ *How was your TAVUSHA experience?*

Hello ${order.customer_name}!

We hope you're loving your recent purchase from TAVUSHA!

Your feedback helps us serve you better. Would you take a moment to share your experience?

Order: ${order.order_number}

You can share your review by replying to this message, or visit our website: www.tavusha.in

We read every message 💛

— Team TAVUSHA`;

  return sendMessage(phone, msg);
}

async function sendCodReminder(phone, order) {
  const msg = `💵 *COD Payment Reminder — TAVUSHA*

Hello ${order.customer_name},

Your order *${order.order_number}* is out for delivery today!

Please keep *${formatCurrency(order.total - order.advance_paid)}* ready for the delivery partner.

(You already paid ${formatCurrency(order.advance_paid)} as advance — remaining balance only)

Thank you! — TAVUSHA 💛`;

  return sendMessage(phone, msg);
}

module.exports = {
  sendOrderConfirmation,
  sendPaymentConfirmation,
  sendShippingUpdate,
  sendDeliveryConfirmation,
  sendFeedbackRequest,
  sendCodReminder,
  sendMessage,
};
