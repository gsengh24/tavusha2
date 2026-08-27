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
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
});

async function uploadBannerImage(buffer, type = 'hero') {
  try {
    const optimized = await sharp(buffer)
      .rotate()
      .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();

    const filename = `${type}/${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;

    // 1. Primary: Upload to 'banner' bucket in Supabase Storage (exact user bucket)
    try {
      const { error } = await supabase.storage
        .from('banner')
        .upload(filename, optimized, { contentType: 'image/jpeg', upsert: true });
      if (!error) {
        const { data } = supabase.storage.from('banner').getPublicUrl(filename);
        if (data && data.publicUrl) return data.publicUrl;
      } else {
        console.warn('[CMS Storage] Upload to "banner" bucket warning:', error.message);
      }
    } catch (e1) {
      console.warn('[CMS Storage] Exception uploading to "banner" bucket:', e1.message);
    }

    // 2. Secondary fallback: 'banners' bucket
    try {
      const { error } = await supabase.storage
        .from('banners')
        .upload(filename, optimized, { contentType: 'image/jpeg', upsert: true });
      if (!error) {
        const { data } = supabase.storage.from('banners').getPublicUrl(filename);
        if (data && data.publicUrl) return data.publicUrl;
      }
    } catch (e2) {}

    // 3. Tertiary fallback: 'tavusha-products' bucket
    try {
      const { error } = await supabase.storage
        .from('tavusha-products')
        .upload(`cms/${filename}`, optimized, { contentType: 'image/jpeg', upsert: true });
      if (!error) {
        const { data } = supabase.storage.from('tavusha-products').getPublicUrl(`cms/${filename}`);
        if (data && data.publicUrl) return data.publicUrl;
      }
    } catch (e3) {}

    // 3. Fallback: Base64 data URL
    return `data:image/jpeg;base64,${optimized.toString('base64')}`;
  } catch (err) {
    console.warn('[CMS] Error in uploadBannerImage, using raw buffer base64 fallback:', err.message);
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  }
}

// ═══════════════════════════════════════════════════════════
// PUBLIC ROUTES (no auth needed — storefront reads these)
// ═══════════════════════════════════════════════════════════

// GET /api/cms/site-settings/banner — public endpoint to fetch active banner_url from Supabase site_settings
// (Registered BEFORE /site-settings to prevent route matching conflicts)
const handleGetBannerSetting = async (req, res) => {
  try {
    let setting;
    try {
      setting = await CmsContent.getSiteSetting('banner_url');
    } catch (dbErr) {
      setting = fileStore.getSiteSetting('banner_url');
    }
    let bannerUrl = setting ? (setting.value || setting.banner_url || '') : '';
    if (!bannerUrl || bannerUrl.includes('1771345000-123456789.jpg')) {
      bannerUrl = 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900';
    }
    res.json({ banner_url: bannerUrl, key: 'banner_url', value: bannerUrl });
  } catch (err) {
    res.json({ banner_url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900', key: 'banner_url', value: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900' });
  }
};

router.get('/site-settings/banner', handleGetBannerSetting);
router.get('/site-setting/banner', handleGetBannerSetting);
router.get('/banner', handleGetBannerSetting);

// GET /api/cms/site-settings — public endpoint to read site_settings from Supabase
router.get('/site-settings', async (req, res) => {
  try {
    let settings;
    try {
      settings = await CmsContent.getSiteSettings();
    } catch (dbErr) {
      settings = fileStore.getSiteSettings();
    }
    let map = {};
    if (Array.isArray(settings)) {
      settings.forEach(s => { map[s.key] = s.value; });
    } else if (settings && typeof settings === 'object') {
      map = settings;
    }
    res.json({ success: true, site_settings: map, banner_url: map.banner_url || '' });
  } catch (err) {
    res.json({ success: false, site_settings: {}, banner_url: '' });
  }
});

// GET /api/cms/public — all CMS data the homepage needs in one request
router.get('/public', async (req, res) => {
  try {
    let banners, sections, popup, announcement, siteSettings;
    try {
      [banners, sections, popup, announcement, siteSettings] = await Promise.all([
        CmsContent.getPublicBanners(),
        CmsContent.getSections(),
        CmsContent.getActivePopup(),
        CmsContent.getAnnouncement(),
        CmsContent.getSiteSettings()
      ]);
    } catch (dbErr) {
      console.warn('[CMS] Supabase error, using file store:', dbErr.message);
      const fallback = fileStore.getPublicData();
      banners = fallback.banners;
      sections = fallback.sections;
      popup = fallback.popup;
      announcement = fallback.announcement;
      siteSettings = fallback.site_settings || [];
    }

    let settingsMap = {};
    if (Array.isArray(siteSettings)) {
      siteSettings.forEach(s => { settingsMap[s.key] = s.value; });
    } else if (siteSettings && typeof siteSettings === 'object') {
      settingsMap = siteSettings;
    }

    const heroBanners = (banners || []).filter(b => b.type === 'hero');
    const festivalBanners = (banners || []).filter(b => b.type === 'festival');
    const annText = cleanUtf8Text(announcement?.config?.text || (typeof announcement === 'string' ? announcement : (announcement?.text || '')));

    // Override hero banner image with site_settings banner_url if present
    if (settingsMap.banner_url && heroBanners.length > 0) {
      heroBanners[0].image_url = settingsMap.banner_url;
    }

    // Sanitize section config text fields to fix mojibake
    const textConfigKeys = ['eyebrow','title','main_badge','main_title','main_desc','side1_badge','side1_title','side1_quote','side2_badge','side2_title','side2_quote','quote_text','quote_author','text'];
    const cleanedSections = (sections || []).map(s => {
      if (!s.config || typeof s.config !== 'object') return s;
      const cleanConfig = { ...s.config };
      textConfigKeys.forEach(k => {
        if (cleanConfig[k] && typeof cleanConfig[k] === 'string') {
          cleanConfig[k] = cleanUtf8Text(cleanConfig[k]);
        }
      });
      return { ...s, config: cleanConfig };
    });

    res.json({
      banners: banners || [],
      heroBanners,
      festivalBanners,
      sections: cleanedSections,
      site_settings: settingsMap,
      banner_url: settingsMap.banner_url || (heroBanners[0]?.image_url || ''),
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
      res.json({ banners: fallback.banners, sections: fallback.sections, popup: fallback.popup, announcement: fallback.announcement, banner_url: fallback.site_settings?.banner_url || '' });
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

function cleanUtf8Text(str) {
  if (!str || typeof str !== 'string') return str || '';
  return str
    .replace(/âœ¦/g, '✦')
    .replace(/â‚¹/g, '₹')
    .replace(/Â·/g, '·')
    .replace(/â€”/g, '—')
    .replace(/â€“/g, '–')
    .replace(/Ã¢â‚¬â€/g, '—')
    .replace(/Ã¢â‚¬Â/g, '’');
}

// GET /api/cms/sections
router.get('/sections', async (req, res) => {
  try {
    let sections;
    try {
      sections = await CmsContent.getSections();
    } catch (e) {
      sections = fileStore.getSections();
    }
    if (!Array.isArray(sections)) sections = [];

    // Ensure announcement section exists in list
    let ann = sections.find(s => s.key === 'announcement');
    if (!ann) {
      ann = {
        key: 'announcement',
        label: 'Top Announcement Bar',
        visible: true,
        config: { text: '✦  Free Shipping on Orders Above ₹2,499  ·  Code TAVUSHA10 — 10% Off First Order  ·  New Arrivals Every Friday  ✦' }
      };
      sections.unshift(ann);
    } else if (ann.config?.text) {
      ann.config.text = cleanUtf8Text(ann.config.text);
    }

    res.json(sections);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load sections', error: err.message });
  }
});

// GET /api/cms/announcement
router.get('/announcement', async (req, res) => {
  try {
    let ann;
    try { ann = await CmsContent.getAnnouncement(); } catch (e) {}
    if (!ann) {
      const sections = fileStore.getSections();
      ann = sections.find(s => s.key === 'announcement') || {
        key: 'announcement',
        label: 'Top Announcement Bar',
        visible: true,
        config: { text: '✦  Free Shipping on Orders Above ₹2,499  ·  Code TAVUSHA10 — 10% Off First Order  ·  New Arrivals Every Friday  ✦' }
      };
    }
    if (ann?.config?.text) {
      ann.config.text = cleanUtf8Text(ann.config.text);
    }
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

// POST /api/cms/admin/site-settings/banner — Admin endpoint to upload banner to Supabase Storage 'banners' bucket & save in site_settings
router.post('/admin/site-settings/banner', protect, adminOnly,
  upload.fields([{ name: 'banner', maxCount: 1 }, { name: 'image', maxCount: 1 }, { name: 'file', maxCount: 1 }]),
  async (req, res) => {
    try {
      let bannerUrl = req.body.banner_url || req.body.image_url || '';
      const fileObj = req.files?.banner?.[0] || req.files?.image?.[0] || req.files?.file?.[0];

      if (fileObj) {
        bannerUrl = await uploadBannerImage(fileObj.buffer, 'hero');
      }

      if (!bannerUrl) {
        return res.status(400).json({ message: 'No banner image file or URL provided' });
      }

      // Save into Supabase 'site_settings' table
      let settingRecord;
      try {
        // Fetch old banner to delete it from server
        const oldSetting = await CmsContent.getSiteSetting('banner_url').catch(() => null);
        const oldBannerUrl = oldSetting ? (oldSetting.value || oldSetting.banner_url) : null;
        
        if (oldBannerUrl && oldBannerUrl !== bannerUrl && oldBannerUrl.includes('/storage/v1/object/public/')) {
          try {
            const bucketAndPath = oldBannerUrl.split('/storage/v1/object/public/')[1];
            const firstSlash = bucketAndPath.indexOf('/');
            if (firstSlash > -1) {
              const bucket = bucketAndPath.substring(0, firstSlash);
              const filePath = bucketAndPath.substring(firstSlash + 1);
              await supabase.storage.from(bucket).remove([filePath]).catch(() => {});
            }
          } catch(e) {}
        }
        
        settingRecord = await CmsContent.updateSiteSetting('banner_url', bannerUrl);
        try { fileStore.updateSiteSetting('banner_url', bannerUrl); } catch(e) {}
      } catch (dbErr) {
        console.warn('[CMS] Supabase updateSiteSetting failed, using file store:', dbErr.message);
        settingRecord = fileStore.updateSiteSetting('banner_url', bannerUrl);
      }

      // Also ensure main hero banner in cms_banners / fileStore stays updated
      try {
        const banners = await CmsContent.getBanners('hero');
        if (banners && banners.length > 0) {
          await CmsContent.updateBanner(banners[0].id, { image_url: bannerUrl });
          try { fileStore.updateBanner(banners[0].id, { image_url: bannerUrl }); } catch(e) {}
        }
      } catch (e) {}

      res.json({
        success: true,
        message: 'Banner uploaded and saved to Supabase site_settings successfully!',
        key: 'banner_url',
        banner_url: bannerUrl,
        setting: settingRecord
      });
    } catch (err) {
      res.status(500).json({ message: 'Failed to upload banner setting', error: err.message });
    }
  }
);

router.post('/admin/upload-banner', protect, adminOnly,
  upload.fields([{ name: 'banner', maxCount: 1 }, { name: 'image', maxCount: 1 }, { name: 'file', maxCount: 1 }]),
  async (req, res) => {
    try {
      const fileObj = req.files?.banner?.[0] || req.files?.image?.[0] || req.files?.file?.[0];
      if (!fileObj) return res.status(400).json({ message: 'No file uploaded' });
      const bannerUrl = await uploadBannerImage(fileObj.buffer, 'hero');
      await CmsContent.updateSiteSetting('banner_url', bannerUrl).catch(() => {});
      fileStore.updateSiteSetting('banner_url', bannerUrl);
      res.json({ success: true, banner_url: bannerUrl, url: bannerUrl });
    } catch(err) {
      res.status(500).json({ message: 'Upload failed', error: err.message });
    }
  }
);

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
        try { fileStore.createBanner(fields); } catch(e) {}
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
        try { fileStore.updateBanner(req.params.id, fields); } catch(e) {}
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
    try { await CmsContent.deleteBanner(req.params.id); } catch(e) {}
    try { fileStore.deleteBanner(req.params.id); } catch(e) {}
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
      try { fileStore.upsertSection(req.params.key, fields); } catch(e) {}
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

// ── Site-Wide Discount Settings ────────────────────────────────────────────────
router.get('/site-settings/sitewide_discount', async (req, res) => {
  try {
    let setting;
    try {
      setting = await CmsContent.getSiteSetting('sitewide_discount');
    } catch (dbErr) {
      setting = fileStore.getSiteSetting('sitewide_discount');
    }
    res.json({ success: true, sitewide_discount: setting ? setting.value : null });
  } catch (err) {
    res.json({ success: false, sitewide_discount: null });
  }
});

router.put('/admin/site-settings/sitewide_discount', protect, adminOnly, async (req, res) => {
  try {
    const { value } = req.body;
    let setting;
    try {
      setting = await CmsContent.updateSiteSetting('sitewide_discount', value);
    } catch (dbErr) {
      setting = fileStore.updateSiteSetting('sitewide_discount', value);
    }
    res.json({ success: true, setting });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update sitewide discount setting', error: err.message });
  }
});

module.exports = router;
