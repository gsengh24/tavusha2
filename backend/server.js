require('dotenv').config();
const express = require('express');
const cors = require('cors');

const Staff = require('./models/Staff');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, database: 'supabase' }));

async function ensureAdminAccount() {
  try {
    const existingAdmin = await Staff.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('✅ Admin account checked in Supabase');
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
    console.log(`✅ Admin account created -> loginId: ${email}`);
  } catch (err) {
    console.warn('⚠️ Could not verify/create admin account (ensure Supabase tables exist according to schema.sql):', err.message);
  }
}

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT} with Supabase backend`);
  await ensureAdminAccount();
});
