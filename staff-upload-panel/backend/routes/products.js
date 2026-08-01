const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const Product = require('../models/Product');
const { protect, adminOnly, requirePermission } = require('../middleware/auth');

const router = express.Router();

// ---- File upload setup (accepts images + videos) ----
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.memoryStorage(); // keep in memory so sharp can process images before saving
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB per file
  fileFilter: (req, file, cb) => {
    const okTypes = /jpeg|jpg|png|webp|mp4|mov|webm/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (okTypes.test(ext)) cb(null, true);
    else cb(new Error('Only image (jpg, png, webp) or video (mp4, mov, webm) files are allowed'));
  }
});

// Processes and saves an image: auto-orients, resizes to a max dimension,
// and compresses to good web quality. Optional crop box comes from the client
// (from the on-page crop tool) as JSON string: { left, top, width, height }.
async function processAndSaveImage(fileBuffer, originalName, cropBox) {
  let pipeline = sharp(fileBuffer).rotate(); // auto-orient using EXIF

  if (cropBox) {
    const { left, top, width, height } = JSON.parse(cropBox);
    pipeline = pipeline.extract({
      left: Math.round(left),
      top: Math.round(top),
      width: Math.round(width),
      height: Math.round(height)
    });
  }

  pipeline = pipeline
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true });

  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
  const outPath = path.join(uploadDir, filename);
  await pipeline.toFile(outPath);
  return `/uploads/${filename}`;
}

function saveVideoAsIs(fileBuffer, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const outPath = path.join(uploadDir, filename);
  fs.writeFileSync(outPath, fileBuffer);
  return `/uploads/${filename}`;
}

// ---- Routes ----

// GET /api/products - list (admin sees everything, staff sees their own + approved)
router.get('/', protect, async (req, res) => {
  const filter = { isDeleted: false };
  if (req.user.role !== 'admin') {
    filter.$or = [{ createdBy: req.user._id }, { status: 'approved' }];
  }
  const products = await Product.find(filter).sort({ createdAt: -1 });
  res.json(products);
});

// POST /api/products - staff uploads a new product (goes in as "pending")
// multipart/form-data fields: title, price, colour, size, stock, description
// files: images[], videos[]
// optional: cropData (JSON array, same order as images[]) for client-side crop boxes
router.post(
  '/',
  protect,
  requirePermission('canUpload'),
  upload.fields([{ name: 'images', maxCount: 10 }, { name: 'videos', maxCount: 5 }]),
  async (req, res) => {
    try {
      const { title, price, colour, size, category, stock, description, cropData } = req.body;
      if (!title || !price) return res.status(400).json({ message: 'Title and price are required' });

      const crops = cropData ? JSON.parse(cropData) : [];
      const imageFiles = (req.files.images || []);
      const videoFiles = (req.files.videos || []);

      const imagePaths = [];
      for (let i = 0; i < imageFiles.length; i++) {
        const box = crops[i] ? JSON.stringify(crops[i]) : null;
        imagePaths.push(await processAndSaveImage(imageFiles[i].buffer, imageFiles[i].originalname, box));
      }
      const videoPaths = videoFiles.map((f) => saveVideoAsIs(f.buffer, f.originalname));

      const product = await Product.create({
        title,
        description,
        price,
        colour,
        size,
        category: category || 'other',
        stock: stock || 0,
        inStock: Number(stock || 0) > 0,
        images: imagePaths,
        videos: videoPaths,
        status: 'pending', // admin must approve before it goes live
        createdBy: req.user._id
      });

      res.status(201).json(product);
    } catch (err) {
      res.status(500).json({ message: 'Upload failed', error: err.message });
    }
  }
);

// PUT /api/products/:id - staff/admin edits a product (staff edits reset status to "pending")
router.put(
  '/:id',
  protect,
  requirePermission('canEdit'),
  upload.fields([{ name: 'images', maxCount: 10 }, { name: 'videos', maxCount: 5 }]),
  async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product || product.isDeleted) return res.status(404).json({ message: 'Product not found' });

      // staff can only edit their own uploads (admin can edit anything)
      if (req.user.role !== 'admin' && String(product.createdBy) !== String(req.user._id)) {
        return res.status(403).json({ message: 'You can only edit products you uploaded' });
      }

      const { title, price, colour, size, category, stock, description, cropData, removeImages } = req.body;
      if (title !== undefined) product.title = title;
      if (description !== undefined) product.description = description;
      if (price !== undefined) product.price = price;
      if (colour !== undefined) product.colour = colour;
      if (size !== undefined) product.size = size;
      if (category !== undefined) product.category = category;
      if (stock !== undefined) {
        product.stock = stock;
        product.inStock = Number(stock) > 0;
      }

      // remove selected existing images
      if (removeImages) {
        const toRemove = JSON.parse(removeImages);
        product.images = product.images.filter((img) => !toRemove.includes(img));
      }

      // add newly uploaded images/videos
      const crops = cropData ? JSON.parse(cropData) : [];
      const imageFiles = (req.files.images || []);
      const videoFiles = (req.files.videos || []);
      for (let i = 0; i < imageFiles.length; i++) {
        const box = crops[i] ? JSON.stringify(crops[i]) : null;
        product.images.push(await processAndSaveImage(imageFiles[i].buffer, imageFiles[i].originalname, box));
      }
      for (const f of videoFiles) {
        product.videos.push(saveVideoAsIs(f.buffer, f.originalname));
      }

      product.lastEditedBy = req.user._id;
      // any staff edit needs re-approval; admin edits stay approved
      product.status = req.user.role === 'admin' ? product.status : 'pending';

      await product.save();
      res.json(product);
    } catch (err) {
      res.status(500).json({ message: 'Update failed', error: err.message });
    }
  }
);

// PATCH /api/products/:id/stock - quick stock update (lighter permission)
router.patch('/:id/stock', protect, requirePermission('canUpdateStock'), async (req, res) => {
  const { stock, inStock } = req.body;
  const product = await Product.findById(req.params.id);
  if (!product || product.isDeleted) return res.status(404).json({ message: 'Product not found' });

  if (req.user.role !== 'admin' && String(product.createdBy) !== String(req.user._id)) {
    return res.status(403).json({ message: 'You can only update stock for products you uploaded' });
  }

  if (stock !== undefined) product.stock = stock;
  if (inStock !== undefined) product.inStock = inStock;
  await product.save();
  res.json(product);
});

// DELETE /api/products/:id - soft delete (staff needs canDelete permission; goes to admin review either way)
router.delete('/:id', protect, requirePermission('canDelete'), async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });

  if (req.user.role !== 'admin' && String(product.createdBy) !== String(req.user._id)) {
    return res.status(403).json({ message: 'You can only remove products you uploaded' });
  }

  product.isDeleted = true;
  await product.save();
  res.json({ message: 'Product removed' });
});

// ---- Admin-only approval actions ----

// PATCH /api/products/:id/approve
router.patch('/:id/approve', protect, adminOnly, async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  product.status = 'approved';
  product.approvedBy = req.user._id;
  product.rejectionReason = '';
  await product.save();
  res.json(product);
});

// PATCH /api/products/:id/reject  { reason }
router.patch('/:id/reject', protect, adminOnly, async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  product.status = 'rejected';
  product.rejectionReason = req.body.reason || 'Not specified';
  await product.save();
  res.json(product);
});

// DELETE /api/products/:id/permanent - admin only, permanently removes product + files
router.delete('/:id/permanent', protect, adminOnly, async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  [...product.images, ...product.videos].forEach((filePath) => {
    const full = path.join(uploadDir, path.basename(filePath));
    if (fs.existsSync(full)) fs.unlinkSync(full);
  });
  res.json({ message: 'Product permanently deleted' });
});

// GET /api/products/storefront.js - PUBLIC, no login required.
// Outputs approved products as a ready-to-drop-in JS file that appends to
// the site's existing TAVUSHA_PRODUCTS array (same shape: id, title, price,
// category, colour, size, images). This does NOT touch shop.html/index.html —
// it's an optional extra <script> tag the developer can add later, after
// js/products.js, to bring live staff uploads onto the storefront without
// changing any existing file or design.
router.get('/storefront.js', async (req, res) => {
  const products = await Product.find({ status: 'approved', isDeleted: false }).sort({ createdAt: -1 });
  const shaped = products.map((p, i) => ({
    id: `staff-${p._id}`,
    name: p.title,
    price: p.price,
    category: [p.category],
    colour: p.colour,
    size: p.size,
    images: p.images,
    image: p.images[0] || '',
    rating: 5,
    brand: 'TAVUSHA'
  }));
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`// Auto-generated from admin-approved staff uploads. Do not edit by hand.
if (typeof TAVUSHA_PRODUCTS !== 'undefined') {
  TAVUSHA_PRODUCTS.push(...${JSON.stringify(shaped)});
}`);
});

module.exports = router;
