require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const Staff = require('./models/Staff');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

async function ensureAdminAccount() {
  const existingAdmin = await Staff.findOne({ role: 'admin' });
  if (existingAdmin) return;

  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  await Staff.create({
    name: 'Main Admin',
    loginId: email.toLowerCase(),
    password,
    role: 'admin',
    permissions: { canUpload: true, canEdit: true, canDelete: true, canUpdateStock: true }
  });
  console.log(`Admin account created -> loginId: ${email} (password from .env). Please log in and change it.`);
}

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('MongoDB connected');
    await ensureAdminAccount();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
