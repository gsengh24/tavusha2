const express = require('express');
const jwt = require('jsonwebtoken');
const Staff = require('../models/Staff');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

function generateToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// POST /api/auth/login  { loginId, password }
router.post('/login', async (req, res) => {
  try {
    const { loginId, password } = req.body;
    if (!loginId || !password) {
      return res.status(400).json({ message: 'Login ID and password required' });
    }

    const user = await Staff.findOne({ loginId: loginId.toLowerCase().trim() });
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid login ID or password' });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid login ID or password' });
    }

    res.json({
      token: generateToken(user._id),
      user
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/auth/me - current logged-in user
router.get('/me', protect, async (req, res) => {
  res.json(req.user);
});

// ---- Admin: manage staff accounts ----

// POST /api/auth/staff - Admin creates a new staff login
router.post('/staff', protect, adminOnly, async (req, res) => {
  try {
    const { name, loginId, password, permissions } = req.body;
    if (!name || !loginId || !password) {
      return res.status(400).json({ message: 'Name, login ID and password are required' });
    }
    const exists = await Staff.findOne({ loginId: loginId.toLowerCase().trim() });
    if (exists) return res.status(400).json({ message: 'This login ID is already taken' });

    const staff = await Staff.create({
      name,
      loginId: loginId.toLowerCase().trim(),
      password,
      role: 'staff',
      permissions: permissions || undefined
    });
    res.status(201).json(staff);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/auth/staff - Admin: list all staff accounts
router.get('/staff', protect, adminOnly, async (req, res) => {
  const list = await Staff.find({ role: 'staff' }).sort({ createdAt: -1 });
  res.json(list);
});

// PUT /api/auth/staff/:id - Admin: update permissions / active status / reset password
router.put('/staff/:id', protect, adminOnly, async (req, res) => {
  try {
    const { permissions, isActive, password, name } = req.body;
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ message: 'Staff not found' });

    if (permissions) staff.permissions = { ...staff.permissions.toObject(), ...permissions };
    if (typeof isActive === 'boolean') staff.isActive = isActive;
    if (name) staff.name = name;
    if (password) staff.password = password; // will be re-hashed by pre-save hook

    await staff.save();
    res.json(staff);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/auth/staff/:id - Admin: remove a staff account
router.delete('/staff/:id', protect, adminOnly, async (req, res) => {
  const staff = await Staff.findByIdAndDelete(req.params.id);
  if (!staff) return res.status(404).json({ message: 'Staff not found' });
  res.json({ message: 'Staff account removed' });
});

module.exports = router;
