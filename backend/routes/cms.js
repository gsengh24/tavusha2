const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const CmsContent = require('../models/CmsContent');
const { protect, adminOnly } = require('../middleware/auth');
const supabase = require('../supabase');
const fileStore = require('../cms_store'); // JSON file fallback when Supabase unavailable

const router = express.Router();

// File upload for banner images
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const okTypes = /jpeg|jpg|png|webp/;
    if (okTypes.test(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only image files allowed'));
  }
});

async function uploadBannerImage(buffer, type = 'hero') {
  const optimized = await sharp(buffer)
    .rotate()
    .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();

  const filename = `cms/${type}/${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
  const { error } = await supabase.storage
    .from('tavusha-products')
    .upload(filename, optimized, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error('Banner upload failed: ' + error.message);
  const { data } = supabase.storage.from('tavusha-products').getPublicUrl(filename);
  return data.publicUrl;
}

// ═══════════════════════════════════════════════════════════
// PUBLIC ROUTES (no auth needed — storefront reads these)
// ═══════════════════════════════════════════════════════════

// GET /api/cms/public — all CMS data the homepage needs in one request
router.get('/public', async (req, res) => {
  try {
    let banners, sections, popup, announcement;
    try {
      [banners, sections, popup, announcement] = await Promise.all([
        CmsContent.getPublicBanners(),
        CmsContent.getSections(),
        CmsContent.getActivePopup(),
        CmsContent.getAnnouncement(),
      ]);
    } catch (dbErr) {
      console.warn('[CMS] Supabase error, using file store:', dbErr.message);
      const fallback = fileStore.getPublicData();
      banners = fallback.banners;
      sections = fallback.sections;
      popup = fallback.popup;
      announcement = fallback.announcement;
    }
    const heroBanners = (banners || []).filter(b => b.type === 'hero');
    const festivalBanners = (banners || []).filter(b => b.type === 'festival');
    const annText = announcement?.config?.text || (typeof announcement === 'string' ? announcement : (announcement?.text || ''));
    res.json({
      banners: banners || [],
      heroBanners,
      festivalBanners,
      sections: sections || [],
      popup: popup ? {
        enabled: true,
        title: popup.title,
        body: popup.body,
        image_url: popup.image_url,
        cta_label: popup.cta_text,
        cta_url: popup.cta_url,
        delay: popup.trigger_delay_seconds
      } : { enabled: false },
      announcement: annText
    });
  } catch (err) {
    // Last resort: return file store data even on complete failure
    try {
      const fallback = fileStore.getPublicData();
      res.json({ banners: fallback.banners, sections: fallback.sections, popup: fallback.popup, announcement: fallback.announcement });
    } catch (e2) {
      res.status(500).json({ message: 'CMS load error', error: err.message });
    }
  }
});

// GET /api/cms/banners?type=hero
router.get('/banners', async (req, res) => {
  try {
    const { type } = req.query;
    let banners;
    try {
      banners = await CmsContent.getPublicBanners(type || null);
    } catch (dbErr) {
      banners = fileStore.getPublicBanners(type || null);
    }
    res.json(banners || []);
  } catch (err) {
    res.json(fileStore.getPublicBanners() || []);
  }
});

// GET /api/cms/popup
router.get('/popup', async (req, res) => {
  try {
    const popup = await CmsContent.getActivePopup();
    res.json(popup || null);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load popup', error: err.message });
  }
});

// GET /api/cms/sections
router.get('/sections', async (req, res) => {
  try {
    const sections = await CmsContent.getSections();
    res.json(sections);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load sections', error: err.message });
  }
});

// GET /api/cms/announcement
router.get('/announcement', async (req, res) => {
  try {
    const ann = await CmsContent.getAnnouncement();
    res.json(ann);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load announcement', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// ADMIN ROUTES (JWT auth required)
// ═══════════════════════════════════════════════════════════

// GET /api/cms/admin/banners — all banners (including invisible/scheduled) — with file store fallback
router.get('/admin/banners', protect, adminOnly, async (req, res) => {
  try {
    const { type } = req.query;
    let banners;
    try {
      banners = await CmsContent.getBanners(type || null);
    } catch (dbErr) {
      banners = fileStore.getBanners(type || null);
    }
    res.json(banners || []);
  } catch (err) {
    res.json(fileStore.getBanners() || []);
  }
});

// POST /api/cms/admin/banners — create banner (with optional image upload)
router.post('/admin/banners', protect, adminOnly,
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'mobile_image', maxCount: 1 }]),
  async (req, res) => {
    try {
      const fields = { ...req.body };
      if (fields.visible !== undefined) fields.visible = fields.visible === 'true' || fields.visible === true;
      if (fields.sort_order !== undefined) fields.sort_order = Number(fields.sort_order);
      if (fields.schedule_start === '') fields.schedule_start = null;
      if (fields.schedule_end === '') fields.schedule_end = null;

      if (req.files && req.files.image && req.files.image[0]) {
        fields.image_url = await uploadBannerImage(req.files.image[0].buffer, fields.type || 'hero');
      }
      if (req.files && req.files.mobile_image && req.files.mobile_image[0]) {
        fields.mobile_image_url = await uploadBannerImage(req.files.mobile_image[0].buffer, 'mobile');
      }

      let banner;
      try {
        banner = await CmsContent.createBanner(fields);
      } catch (dbErr) {
        console.warn('[CMS] Supabase createBanner failed, using file store:', dbErr.message);
        banner = fileStore.createBanner(fields);
      }
      res.status(201).json(banner);
    } catch (err) {
      res.status(500).json({ message: 'Failed to create banner', error: err.message });
    }
  }
);

// PUT /api/cms/admin/banners/:id
router.put('/admin/banners/:id', protect, adminOnly,
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'mobile_image', maxCount: 1 }]),
  async (req, res) => {
    try {
      const fields = { ...req.body };
      if (fields.visible !== undefined) fields.visible = fields.visible === 'true' || fields.visible === true;
      if (fields.sort_order !== undefined) fields.sort_order = Number(fields.sort_order);
      if (fields.schedule_start === '') fields.schedule_start = null;
      if (fields.schedule_end === '') fields.schedule_end = null;

      if (req.files && req.files.image && req.files.image[0]) {
        fields.image_url = await uploadBannerImage(req.files.image[0].buffer, fields.type || 'hero');
      }
      if (req.files && req.files.mobile_image && req.files.mobile_image[0]) {
        fields.mobile_image_url = await uploadBannerImage(req.files.mobile_image[0].buffer, 'mobile');
      }

      let banner;
      try {
        banner = await CmsContent.updateBanner(req.params.id, fields);
      } catch (dbErr) {
        console.warn('[CMS] Supabase updateBanner failed, using file store:', dbErr.message);
        banner = fileStore.updateBanner(req.params.id, fields);
      }
      res.json(banner);
    } catch (err) {
      res.status(500).json({ message: 'Failed to update banner', error: err.message });
    }
  }
);

// DELETE /api/cms/admin/banners/:id
router.delete('/admin/banners/:id', protect, adminOnly, async (req, res) => {
  try {
    try { await CmsContent.deleteBanner(req.params.id); } catch { fileStore.deleteBanner(req.params.id); }
    res.json({ message: 'Banner deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete banner', error: err.message });
  }
});

// PUT /api/cms/admin/banners/reorder
router.put('/admin/banners/reorder', protect, adminOnly, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ message: 'ids array required' });
    await CmsContent.reorderBanners(ids);
    res.json({ message: 'Reordered' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reorder', error: err.message });
  }
});

// ── Sections ──────────────────────────────────────────────────────────────────
// PUT /api/cms/admin/sections/:key
router.put('/admin/sections/:key', protect, adminOnly, upload.fields([
  { name: 'main_image', maxCount: 1 },
  { name: 'side1_image', maxCount: 1 },
  { name: 'side2_image', maxCount: 1 }
]), async (req, res) => {
  try {
    let fields = { ...req.body };
    if (typeof fields.config === 'string') {
      try { fields.config = JSON.parse(fields.config); } catch (e) {}
    }
    if (typeof fields.visible === 'string') {
      fields.visible = fields.visible === 'true';
    }

    if (req.files) {
      if (!fields.config) fields.config = {};
      if (req.files.main_image?.[0]) {
        fields.config.main_image = await uploadBannerImage(req.files.main_image[0].buffer, 'poster');
      }
      if (req.files.side1_image?.[0]) {
        fields.config.side1_image = await uploadBannerImage(req.files.side1_image[0].buffer, 'poster');
      }
      if (req.files.side2_image?.[0]) {
        fields.config.side2_image = await uploadBannerImage(req.files.side2_image[0].buffer, 'poster');
      }
    }

    let section;
    try {
      section = await CmsContent.updateSection(req.params.key, fields);
    } catch (dbErr) {
      console.warn('[CMS] Supabase updateSection failed, using file store:', dbErr.message);
      section = fileStore.upsertSection(req.params.key, fields);
    }
    res.json(section);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update section', error: err.message });
  }
});

// PUT /api/cms/admin/sections/reorder
router.put('/admin/sections/reorder', protect, adminOnly, async (req, res) => {
  try {
    const { keys } = req.body;
    if (!Array.isArray(keys)) return res.status(400).json({ message: 'keys array required' });
    await CmsContent.reorderSections(keys);
    res.json({ message: 'Reordered' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reorder sections', error: err.message });
  }
});

// ── Popups ────────────────────────────────────────────────────────────────────
router.get('/admin/popups', protect, adminOnly, async (req, res) => {
  try {
    let popups;
    try { popups = await CmsContent.getAllPopups(); } catch { popups = fileStore.getPopups(); }
    res.json(popups || []);
  } catch (err) {
    res.json(fileStore.getPopups() || []);
  }
});

router.post('/admin/popups', protect, adminOnly,
  upload.fields([{ name: 'image', maxCount: 1 }]),
  async (req, res) => {
    try {
      const fields = { ...req.body };
      if (fields.visible !== undefined) fields.visible = fields.visible === 'true' || fields.visible === true;
      if (fields.show_once !== undefined) fields.show_once = fields.show_once === 'true' || fields.show_once === true;
      if (fields.trigger_delay_seconds !== undefined) fields.trigger_delay_seconds = Number(fields.trigger_delay_seconds);
      if (req.files && req.files.image && req.files.image[0]) {
        fields.image_url = await uploadBannerImage(req.files.image[0].buffer, 'popup');
      }
      let popup;
      try { popup = await CmsContent.createPopup(fields); } catch (dbErr) { popup = fileStore.createPopup(fields); }
      res.status(201).json(popup);
    } catch (err) {
      res.status(500).json({ message: 'Failed to create popup', error: err.message });
    }
  }
);

router.put('/admin/popups/:id', protect, adminOnly,
  upload.fields([{ name: 'image', maxCount: 1 }]),
  async (req, res) => {
    try {
      const fields = { ...req.body };
      if (fields.visible !== undefined) fields.visible = fields.visible === 'true' || fields.visible === true;
      if (fields.show_once !== undefined) fields.show_once = fields.show_once === 'true' || fields.show_once === true;
      if (fields.trigger_delay_seconds !== undefined) fields.trigger_delay_seconds = Number(fields.trigger_delay_seconds);
      if (req.files && req.files.image && req.files.image[0]) {
        fields.image_url = await uploadBannerImage(req.files.image[0].buffer, 'popup');
      }
      let popup;
      try { popup = await CmsContent.updatePopup(req.params.id, fields); } catch (dbErr) { popup = fileStore.updatePopup(req.params.id, fields); }
      res.json(popup);
    } catch (err) {
      res.status(500).json({ message: 'Failed to update popup', error: err.message });
    }
  }
);

router.delete('/admin/popups/:id', protect, adminOnly, async (req, res) => {
  try {
    await CmsContent.deletePopup(req.params.id);
    res.json({ message: 'Popup deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete popup', error: err.message });
  }
});

// ── Announcement ──────────────────────────────────────────────────────────────
router.put('/admin/announcement', protect, adminOnly, async (req, res) => {
  try {
    const { text, visible } = req.body;
    const result = await CmsContent.updateAnnouncement(text, visible);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update announcement', error: err.message });
  }
});

module.exports = router;
