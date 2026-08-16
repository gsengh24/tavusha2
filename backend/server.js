require('dotenv').config();
const express = require('express');
const cors = require('cors');

const Staff = require('./models/Staff');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cmsRoutes = require('./routes/cms');
const shippingRoutes = require('./routes/shipping');
const orderRoutes = require('./routes/orders');

let compression;
try { compression = require('compression'); } catch(e) {}

const app = express();

if (compression) app.use(compression());

// Performance Caching Headers for Public GET Requests
app.use((req, res, next) => {
  if (req.method === 'GET') {
    if (req.path.includes('/storefront.js')) {
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    } else if (req.path.includes('/cms')) {
      res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=600, stale-while-revalidate=1200');
    }
  }
  next();
});

// Webhook route must use raw body — mount BEFORE json middleware
app.use('/api/orders/webhook', express.raw({ type: 'application/json' }));

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cms', cmsRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/orders', orderRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, database: 'supabase', version: '2.0.0' }));

// Serve frontend static files from the root directory
const path = require('path');
app.use(express.static(path.join(__dirname, '../')));

async function ensureAdminAccount() {
  try {
    const existingAdmin = await Staff.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('✅ Admin account verified in Supabase');
      return;
    }
    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
    await Staff.create({
      name: 'Main Admin',
      loginId: email.toLowerCase(),
      password,
      role: 'admin',
      permissions: { canUpload: true, canEdit: true, canDelete: true, canUpdateStock: true }
    });
    console.log(`✅ Admin account created → loginId: ${email}`);
  } catch (err) {
    console.warn('⚠️ Could not verify/create admin account:', err.message);
  }
}

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`🚀 Tavusha backend v2.0 running on port ${PORT}`);
  console.log(`   ✓ CMS routes: /api/cms/*`);
  console.log(`   ✓ Shipping routes: /api/shipping/*`);
  console.log(`   ✓ Orders routes: /api/orders/*`);
  console.log(`   ✓ Razorpay: ${process.env.RAZORPAY_KEY_ID ? 'Configured ✅' : 'Not configured ⚠️'}`);
  console.log(`   ✓ WhatsApp: ${process.env.WHATSAPP_TOKEN ? 'Configured ✅' : 'Not configured ⚠️'}`);
  await ensureAdminAccount();

  // ─── Keep-Alive Ping (prevents Render free tier cold starts) ──────────────
  const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  setInterval(async () => {
    try {
      const { default: fetch } = await import('node-fetch').catch(() => ({ default: null }));
      if (fetch) {
        await fetch(`${SELF_URL}/api/health`);
        console.log('🏓 Keep-alive ping sent');
      }
    } catch (_) { /* silent — ping failure is non-critical */ }
  }, 4 * 60 * 1000); // every 4 minutes
  console.log(`   ✓ Keep-alive: pinging every 4 min to prevent cold starts`);
});
