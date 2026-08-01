const jwt = require('jsonwebtoken');
const Staff = require('../models/Staff');

// Verifies JWT and attaches the logged-in staff/admin to req.user
async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.split(' ')[1] : null;
    if (!token) return res.status(401).json({ message: 'Login required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await Staff.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Account not found or disabled' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired session, please login again' });
  }
}

// Restrict a route to admin only
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access only' });
  }
  next();
}

// Checks a specific permission flag for staff (admin always passes)
function requirePermission(permissionKey) {
  return (req, res, next) => {
    if (req.user.role === 'admin') return next();
    if (!req.user.permissions[permissionKey]) {
      return res.status(403).json({ message: 'You do not have permission to do this' });
    }
    next();
  };
}

module.exports = { protect, adminOnly, requirePermission };
