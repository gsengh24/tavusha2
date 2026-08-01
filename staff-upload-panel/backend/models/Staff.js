const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const staffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    loginId: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true }, // hashed
    role: { type: String, enum: ['admin', 'staff'], default: 'staff' },
    // Fine-grained permissions - admin can toggle these per staff member
    permissions: {
      canUpload: { type: Boolean, default: true },
      canEdit: { type: Boolean, default: true },
      canDelete: { type: Boolean, default: false }, // off by default, admin can enable
      canUpdateStock: { type: Boolean, default: true }
    },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Hash password before saving
staffSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

staffSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Never send password hash back in API responses
staffSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('Staff', staffSchema);
