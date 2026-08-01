const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true },
    colour: { type: String, default: '' },
    size: { type: String, default: '' }, // free-text, e.g. "S, M, L, XL"
    // matches the TAVUSHA shop filters: party / ethnic / casual / maxi / coord
    category: { type: String, enum: ['party', 'ethnic', 'casual', 'maxi', 'coord', 'other'], default: 'other' },
    stock: { type: Number, default: 0 },
    inStock: { type: Boolean, default: true },

    images: [{ type: String }], // stored file paths / URLs (already cropped+resized)
    videos: [{ type: String }],

    // Approval workflow: every upload/edit by staff needs admin approval before going live
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    rejectionReason: { type: String, default: '' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },

    isDeleted: { type: Boolean, default: false } // soft delete so admin can review before permanent removal
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
