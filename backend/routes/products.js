const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const XLSX = require('xlsx');
const Product = require('../models/Product');
const { protect, adminOnly, requirePermission } = require('../middleware/auth');
const supabase = require('../supabase');

const router = express.Router();

// ---- File upload setup (memory only — no local disk) ----
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Pass through all media uploads safely
    cb(null, true);
  }
});

// ---- Excel / CSV upload setup ----
const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) cb(null, true);
    else cb(new Error('Only Excel (.xlsx, .xls) or CSV files are allowed'));
  }
});

// ---- Upload image to Supabase Storage ----
async function uploadImageToSupabase(fileBuffer, cropBox) {
  try {
    let buffer = fileBuffer;

    // Process image with sharp (crop + resize + compress)
    let pipeline = sharp(fileBuffer).rotate();
    if (cropBox) {
      const { left, top, width, height } = typeof cropBox === 'string' ? JSON.parse(cropBox) : cropBox;
      pipeline = pipeline.extract({
        left: Math.max(0, Math.round(left)),
        top: Math.max(0, Math.round(top)),
        width: Math.max(1, Math.round(width)),
        height: Math.max(1, Math.round(height))
      });
    }
    pipeline = pipeline
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true });

    buffer = await pipeline.toBuffer();

    const filename = `products/${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;

    const { error } = await supabase.storage
      .from('tavusha-products')
      .upload(filename, buffer, { contentType: 'image/jpeg', upsert: true });

    if (error) {
      console.warn('Supabase storage upload warning:', error.message);
      return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    }

    const { data } = supabase.storage.from('tavusha-products').getPublicUrl(filename);
    return data.publicUrl;
  } catch (err) {
    console.error('Image processing fallback:', err);
    try {
      return `data:image/jpeg;base64,${fileBuffer.toString('base64')}`;
    } catch(e) {
      return 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800';
    }
  }
}

// ---- Upload video to Supabase Storage ----
async function uploadVideoToSupabase(fileBuffer, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const filename = `products/videos/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

  const { error } = await supabase.storage
    .from('tavusha-products')
    .upload(filename, fileBuffer, { contentType: 'video/mp4', upsert: false });

  if (error) throw new Error('Video upload to Supabase failed: ' + error.message);

  const { data } = supabase.storage.from('tavusha-products').getPublicUrl(filename);
  return data.publicUrl;
}

// ---- Routes ----

// GET /api/products/storefront.js - PUBLIC (must be BEFORE /:id routes)
router.get('/storefront.js', async (req, res) => {
    const rawProducts = await Product.find({ status: 'approved', isDeleted: false });
    const products = rawProducts.filter(p => p.title && !p.title.toLowerCase().includes('untitled'));
    const shaped = products.map((p) => {
      const vars = Array.isArray(p.colorVariants) ? p.colorVariants : [];
      const colors = vars.length > 0
        ? vars.map(v => v.hex || v.color)
        : (p.colour ? p.colour.split(',').map(s => s.trim()).filter(Boolean) : ['#1C1917']);
      return {
        id: `staff-${p._id}`,
        name: p.title,
        price: p.price,
        category: [p.category],
        colour: p.colour,
        colorVariants: vars,
        colors: colors.length ? colors : ['#1C1917'],
        size: p.size,
        sizes: p.size ? p.size.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : ['S', 'M', 'L'],
        stock: p.stock || 0,
        images: p.images,
        image: p.images[0] || '',
        rating: 5,
        reviewCount: 0,
        brand: 'TAVUSHA'
      };
    });
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`// Auto-generated from admin-approved staff uploads.\nif (typeof TAVUSHA_PRODUCTS !== 'undefined') {\n  TAVUSHA_PRODUCTS.push(...${JSON.stringify(shaped)});\n}`);
  } catch (err) {
    res.setHeader('Content-Type', 'application/javascript');
    res.send('// Storefront load error: ' + err.message);
  }
});

// GET /api/products
router.get('/', protect, async (req, res) => {
  try {
    const filter = { isDeleted: false };
    if (req.user.role !== 'admin') {
      filter.$or = [{ createdBy: req.user._id }, { status: 'approved' }];
    }
    const products = await Product.find(filter);
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load products', error: err.message });
  }
});

// POST /api/products
router.post('/', protect, requirePermission('canUpload'),
  upload.fields([{ name: 'images', maxCount: 10 }, { name: 'videos', maxCount: 5 }]),
  async (req, res) => {
    try {
      const { title, price, colour, colorVariants, size, category, stock, description, cropData } = req.body;
      if (!title || !price) return res.status(400).json({ message: 'Title and price are required' });

      let parsedVariants = [];
      if (colorVariants) {
        try { parsedVariants = typeof colorVariants === 'string' ? JSON.parse(colorVariants) : colorVariants; }
        catch(e) { parsedVariants = []; }
      }

      let finalStock = Number(stock || 0);
      if (parsedVariants.length > 0) {
        finalStock = parsedVariants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
      }

      const finalColour = colour || (parsedVariants.length > 0 ? parsedVariants.map(v => v.color).join(', ') : '');

      const crops = cropData ? JSON.parse(cropData) : [];
      const imageFiles = req.files.images || [];
      const videoFiles = req.files.videos || [];

      const imagePaths = [];

      // 1) Process binary file uploads from multer
      if (imageFiles && imageFiles.length > 0) {
        for (let i = 0; i < imageFiles.length; i++) {
          try {
            const cropBox = crops[i] || null;
            const url = await uploadImageToSupabase(imageFiles[i].buffer, cropBox);
            if (url) imagePaths.push(url);
          } catch (e) {
            console.error('File upload error:', e);
          }
        }
      }

      // 2) Process base64 Data URLs from imagesData if present
      if (req.body.imagesData) {
        try {
          const dataUrls = typeof req.body.imagesData === 'string' ? JSON.parse(req.body.imagesData) : req.body.imagesData;
          if (Array.isArray(dataUrls)) {
            for (let i = 0; i < dataUrls.length; i++) {
              const dUrl = dataUrls[i];
              if (typeof dUrl === 'string' && dUrl.startsWith('data:image/')) {
                try {
                  const base64Data = dUrl.split(',')[1];
                  const imgBuf = Buffer.from(base64Data, 'base64');
                  const url = await uploadImageToSupabase(imgBuf, crops[i] || null);
                  if (url) imagePaths.push(url);
                } catch (e) {
                  if (!imagePaths.includes(dUrl)) imagePaths.push(dUrl);
                }
              } else if (typeof dUrl === 'string' && dUrl.startsWith('http')) {
                if (!imagePaths.includes(dUrl)) imagePaths.push(dUrl);
              }
            }
          }
        } catch (e) {}
      }

      // 3) Fallback placeholder if no image attached
      if (imagePaths.length === 0) {
        imagePaths.push('https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800');
      }

      const videoPaths = [];
      for (const f of videoFiles) {
        try {
          videoPaths.push(await uploadVideoToSupabase(f.buffer, f.originalname));
        } catch(e) {}
      }

      const isAdmin = !req.user || req.user.role === 'admin' || req.user._id === 'admin_default';

      const product = await Product.create({
        title, description, price,
        colour: finalColour,
        colorVariants: parsedVariants,
        size,
        category: category || 'other',
        stock: finalStock,
        inStock: finalStock > 0,
        images: imagePaths,
        videos: videoPaths,
        status: 'approved',
        approvedBy: (req.user && req.user._id) ? req.user._id : 'admin_default',
        createdBy: (req.user && req.user._id) ? req.user._id : 'admin_default'
      });
      res.status(201).json(product);
    } catch (err) {
      console.error('Product creation error:', err);
      res.status(500).json({ message: 'Upload failed: ' + (err.message || err.error || 'Server error'), error: err.message });
    }
  }
);

// PUT /api/products/:id
router.put('/:id', protect, requirePermission('canEdit'),
  upload.fields([{ name: 'images', maxCount: 10 }, { name: 'videos', maxCount: 5 }]),
  async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product || product.isDeleted) return res.status(404).json({ message: 'Product not found' });
      if (req.user.role !== 'admin' && String(product.createdBy) !== String(req.user._id)) {
        return res.status(403).json({ message: 'You can only edit products you uploaded' });
      }

      const { title, price, colour, colorVariants, size, category, stock, description, cropData, removeImages } = req.body;
      if (title !== undefined) product.title = title;
      if (description !== undefined) product.description = description;
      if (price !== undefined) product.price = price;
      if (size !== undefined) product.size = size;
      if (category !== undefined) product.category = category;

      if (colorVariants !== undefined) {
        let parsed = [];
        try { parsed = typeof colorVariants === 'string' ? JSON.parse(colorVariants) : colorVariants; }
        catch(e) { parsed = []; }
        product.colorVariants = Array.isArray(parsed) ? parsed : [];
        if (product.colorVariants.length > 0) {
          product.colour = product.colorVariants.map(v => v.color).join(', ');
          product.stock = product.colorVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
          product.inStock = product.stock > 0;
        }
      }

      if (colour !== undefined && (!product.colorVariants || product.colorVariants.length === 0)) {
        product.colour = colour;
      }
      if (stock !== undefined && (!product.colorVariants || product.colorVariants.length === 0)) {
        product.stock = Number(stock);
        product.inStock = Number(stock) > 0;
      }

      if (removeImages) {
        const toRemove = JSON.parse(removeImages);
        product.images = product.images.filter((img) => !toRemove.includes(img));
      }

      const crops = cropData ? JSON.parse(cropData) : [];
      const imageFiles = req.files.images || [];
      const videoFiles = req.files.videos || [];

      for (let i = 0; i < imageFiles.length; i++) {
        const cropBox = crops[i] || null;
        product.images.push(await uploadImageToSupabase(imageFiles[i].buffer, cropBox));
      }
      for (const f of videoFiles) {
        product.videos.push(await uploadVideoToSupabase(f.buffer, f.originalname));
      }

      product.lastEditedBy = req.user._id;
      product.status = req.user.role === 'admin' ? product.status : 'pending';
      await product.save();
      res.json(product);
    } catch (err) {
      res.status(500).json({ message: 'Update failed', error: err.message });
    }
  }
);

// PATCH /api/products/:id/stock
router.patch('/:id/stock', protect, requirePermission('canUpdateStock'), async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ message: 'Stock update failed', error: err.message });
  }
});

// PATCH /api/products/:id/approve
router.patch('/:id/approve', protect, adminOnly, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    product.status = 'approved';
    product.approvedBy = req.user._id;
    product.rejectionReason = '';
    await product.save();
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: 'Approve failed', error: err.message });
  }
});

// PATCH /api/products/:id/reject
router.patch('/:id/reject', protect, adminOnly, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    product.status = 'rejected';
    product.rejectionReason = req.body.reason || 'Not specified';
    await product.save();
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: 'Reject failed', error: err.message });
  }
});

// DELETE /api/products/cleanup/untitled  (admin only — bulk purge untitled records)
router.delete('/cleanup/untitled', protect, adminOnly, async (req, res) => {
  try {
    const supabaseClient = require('../supabase');
    // Find all untitled products
    const { data: rows, error: fetchErr } = await supabaseClient
      .from('products')
      .select('id, title, images, videos')
      .or('title.is.null,title.eq.,title.ilike.untitled product');

    if (fetchErr) return res.status(500).json({ message: 'Fetch failed', error: fetchErr.message });
    if (!rows || rows.length === 0) return res.json({ message: 'No untitled products found', deleted: 0 });

    const ids = rows.map(r => r.id);

    // Best-effort remove storage assets
    const allStorageKeys = rows.flatMap(r => [
      ...(r.images || []),
      ...(r.videos || [])
    ])
      .filter(url => url && url.includes('tavusha-products'))
      .map(url => url.split('/tavusha-products/')[1])
      .filter(Boolean);

    if (allStorageKeys.length) {
      await supabaseClient.storage.from('tavusha-products').remove(allStorageKeys).catch(() => {});
    }

    // Hard delete from DB
    const { error: delErr } = await supabaseClient
      .from('products')
      .delete()
      .in('id', ids);

    if (delErr) return res.status(500).json({ message: 'Delete failed', error: delErr.message });

    res.json({ message: `Deleted ${ids.length} untitled product(s)`, deleted: ids.length, ids });
  } catch (err) {
    res.status(500).json({ message: 'Cleanup failed', error: err.message });
  }
});

// DELETE /api/products/:id/permanent
router.delete('/:id/permanent', protect, adminOnly, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    // Attempt to remove from Supabase storage (best effort)
    const allPaths = [...(product.images || []), ...(product.videos || [])];
    const storageKeys = allPaths
      .filter(url => url && url.includes('tavusha-products'))
      .map(url => url.split('/tavusha-products/')[1])
      .filter(Boolean);
    if (storageKeys.length) {
      await supabase.storage.from('tavusha-products').remove(storageKeys).catch(() => {});
    }
    res.json({ message: 'Product permanently deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Delete failed', error: err.message });
  }
});

// DELETE /api/products/:id - soft delete
router.delete('/:id', protect, requirePermission('canDelete'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (req.user.role !== 'admin' && String(product.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You can only remove products you uploaded' });
    }
    product.isDeleted = true;
    await product.save();
    res.json({ message: 'Product removed' });
  } catch (err) {
    res.status(500).json({ message: 'Delete failed', error: err.message });
  }
});

// ────────────────────────────────────────────────────────────
// POST /api/products/bulk-import  (admin only)
// Accepts: multipart/form-data with field "excel" (xlsx/xls/csv)
//
// Expected sheet columns (case-insensitive, flexible names):
//   Title | Price | Stock | Colour/Color | Size | Category | Description | Images (comma-sep URLs)
// ────────────────────────────────────────────────────────────
router.post('/bulk-import', protect, adminOnly, excelUpload.single('excel'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    // Parse workbook from memory buffer
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return res.status(400).json({ message: 'Workbook has no sheets' });

    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (!rows.length) return res.status(400).json({ message: 'Sheet is empty or has no data rows' });

    // Column name normaliser — handles any casing / spacing
    function col(row, ...names) {
      for (const n of names) {
        const key = Object.keys(row).find(k => k.trim().toLowerCase() === n.toLowerCase());
        if (key !== undefined && row[key] !== '' && row[key] !== null && row[key] !== undefined) {
          return String(row[key]).trim();
        }
      }
      return '';
    }

    const VALID_CATEGORIES = ['party','ethnic','casual','maxi','coord','workwear','other'];

    const summary = { imported: 0, skipped: 0, errors: [] };
    const created = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Excel rows are 1-indexed, row 1 is header

      const title = col(row, 'title', 'name', 'product name', 'product title');
      const priceStr = col(row, 'price', 'mrp', 'selling price', 'rate');
      const stockStr = col(row, 'stock', 'quantity', 'qty', 'inventory');
      const colour  = col(row, 'colour', 'color', 'colours', 'colors');
      const size    = col(row, 'size', 'sizes', 'available sizes');
      const rawCat  = col(row, 'category', 'type', 'product type');
      const desc    = col(row, 'description', 'desc', 'details');
      const imgStr  = col(row, 'images', 'image', 'image url', 'image urls', 'photos', 'photo');

      if (!title) {
        summary.skipped++;
        summary.errors.push(`Row ${rowNum}: Missing title — skipped`);
        continue;
      }

      const price = parseFloat(priceStr);
      if (isNaN(price) || price <= 0) {
        summary.skipped++;
        summary.errors.push(`Row ${rowNum} (${title}): Invalid price "${priceStr}" — skipped`);
        continue;
      }

      const stock = parseInt(stockStr, 10);
      const finalStock = isNaN(stock) ? 0 : Math.max(0, stock);

      // Normalise category
      const catClean = rawCat.toLowerCase().replace(/[^a-z]/g, '');
      let category = VALID_CATEGORIES.find(c => catClean.includes(c)) || 'other';

      // Parse image URLs (comma / semicolon / newline separated)
      const images = imgStr
        ? imgStr.split(/[,;\n]+/).map(u => u.trim()).filter(u => u.startsWith('http'))
        : [];

      try {
        const product = await Product.create({
          title,
          description: desc,
          price,
          colour,
          colorVariants: [],
          size,
          category,
          stock: finalStock,
          inStock: finalStock > 0,
          images,
          videos: [],
          status: 'approved',   // Admin imports are auto-approved
          createdBy: req.user._id
        });
        created.push(product);
        summary.imported++;
      } catch (e) {
        summary.skipped++;
        summary.errors.push(`Row ${rowNum} (${title}): DB error — ${e.message}`);
      }
    }

    res.status(201).json({ ...summary, products: created });
  } catch (err) {
    res.status(500).json({ message: 'Bulk import failed', error: err.message });
  }
});

module.exports = router;
