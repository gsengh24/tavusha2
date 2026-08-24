/**
 * cms_store.js — JSON file-based CMS storage fallback
 * Used when Supabase is not configured / unavailable.
 * Stores banners, sections, and popups in cms_data.json next to this file.
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'cms_data.json');

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('[cms_store] failed to read cms_data.json:', e.message);
  }
  return {
    banners: [
      { id: 'b1', type: 'hero', title: 'Style Every Moment', subtitle: 'Discover curated elegance and edge.', badge_text: 'New Summer 2026', cta_text: 'Shop Now', cta_url: '#', image_url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900', visible: true, sort_order: 0 }
    ],
    sections: [
      {
        key: 'announcement',
        label: 'Top Announcement Bar',
        visible: true,
        config: {
          text: '✦  Free Shipping on Orders Above ₹2,499  ·  Code TAVUSHA10 — 10% Off First Order  ·  New Arrivals Every Friday  ✦'
        }
      }
    ],
    popups: []
  };
}

function save(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn('[cms_store] failed to write cms_data.json:', e.message);
  }
}

module.exports = {
  getBanners(type) {
    const { banners } = load();
    if (type) return (banners || []).filter(b => b.type === type);
    return banners || [];
  },
  getPublicBanners(type) {
    const { banners } = load();
    let list = (banners || []).filter(b => b.visible !== false);
    if (type) list = list.filter(b => b.type === type);
    return list;
  },
  createBanner(fields) {
    const data = load();
    const newBanner = { id: 'b_' + Date.now(), ...fields };
    data.banners = data.banners || [];
    data.banners.push(newBanner);
    save(data);
    return newBanner;
  },
  updateBanner(id, fields) {
    const data = load();
    data.banners = data.banners || [];
    const idx = data.banners.findIndex(b => String(b.id) === String(id));
    if (idx === -1) throw new Error('Banner not found');
    data.banners[idx] = { ...data.banners[idx], ...fields };
    save(data);
    return data.banners[idx];
  },
  deleteBanner(id) {
    const data = load();
    data.banners = (data.banners || []).filter(b => String(b.id) !== String(id));
    save(data);
  },
  getSections() {
    const { sections } = load();
    return sections || [];
  },
  upsertSection(key, fields) {
    const data = load();
    data.sections = data.sections || [];
    const idx = data.sections.findIndex(s => s.key === key);
    if (idx !== -1) {
      data.sections[idx] = { ...data.sections[idx], ...fields };
    } else {
      data.sections.push({ key, ...fields });
    }
    save(data);
    return data.sections.find(s => s.key === key);
  },
  getPopups() {
    const { popups } = load();
    return popups || [];
  },
  getActivePopup() {
    const { popups } = load();
    return (popups || []).find(p => p.visible) || null;
  },
  createPopup(fields) {
    const data = load();
    const newPop = { id: 'pop_' + Date.now(), ...fields };
    data.popups = data.popups || [];
    data.popups.push(newPop);
    save(data);
    return newPop;
  },
  updatePopup(id, fields) {
    const data = load();
    data.popups = data.popups || [];
    const idx = data.popups.findIndex(p => String(p.id) === String(id));
    if (idx === -1) throw new Error('Popup not found');
    data.popups[idx] = { ...data.popups[idx], ...fields };
    save(data);
    return data.popups[idx];
  },
  deletePopup(id) {
    const data = load();
    data.popups = (data.popups || []).filter(p => String(p.id) !== String(id));
    save(data);
  },
  getPublicData() {
    const data = load();
    const banners = (data.banners || []).filter(b => b.visible !== false);
    const popup = (data.popups || []).find(p => p.visible) || null;
    const announcementSection = (data.sections || []).find(s => s.key === 'announcement');
    const announcement = announcementSection?.config?.text || '';
    const site_settings = data.site_settings || {};
    return { banners, sections: data.sections || [], popup, announcement, site_settings };
  },
  getSiteSettings() {
    const { site_settings } = load();
    return site_settings || {};
  },
  getSiteSetting(key) {
    const { site_settings } = load();
    return site_settings?.[key] ? { key, value: site_settings[key] } : null;
  },
  updateSiteSetting(key, value) {
    const data = load();
    data.site_settings = data.site_settings || {};
    data.site_settings[key] = value;
    save(data);
    return { key, value };
  }
};
