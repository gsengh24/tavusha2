const supabase = require('../supabase');

// ─── CMS Banners ───────────────────────────────────────────────────────────────
class CmsModel {

  // ── Banners ──────────────────────────────────────────────────────────────────
  static async getBanners(type = null) {
    let q = supabase.from('cms_banners').select('*');
    if (type) q = q.eq('type', type);
    const now = new Date().toISOString();
    q = q.order('sort_order', { ascending: true });
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  static async getPublicBanners(type = null) {
    let q = supabase.from('cms_banners').select('*').eq('visible', true);
    if (type) q = q.eq('type', type);
    const { data, error } = await q.order('sort_order', { ascending: true });
    if (error) throw error;
    
    // Seed defaults if database table is completely empty
    if (!data || data.length === 0) {
      try {
        await CmsModel.createBanner({
          type: 'hero',
          title: 'Style Every Moment',
          subtitle: 'Discover curated elegance and edge.',
          badge_text: 'New Summer 2026',
          cta_text: 'Shop Now',
          cta_url: '#',
          image_url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900',
          visible: true,
          sort_order: 0
        });
      } catch (e) {
        console.warn('[CMS] Failed to seed default hero banner:', e.message);
      }
    }

    const active = (data || []).filter(b => {
      const afterStart = !b.schedule_start || new Date(b.schedule_start) <= new Date();
      const beforeEnd = !b.schedule_end || new Date(b.schedule_end) >= new Date();
      return afterStart && beforeEnd;
    });
    return active;
  }

  static async createBanner(fields) {
    const { data, error } = await supabase.from('cms_banners').insert([{
      type: fields.type || 'hero',
      title: fields.title || '',
      subtitle: fields.subtitle || '',
      badge_text: fields.badge_text || '',
      cta_text: fields.cta_text || 'Shop Now',
      cta_url: fields.cta_url || '#',
      image_url: fields.image_url || '',
      mobile_image_url: fields.mobile_image_url || '',
      bg_color: fields.bg_color || '',
      text_color: fields.text_color || '',
      visible: fields.visible !== undefined ? fields.visible : true,
      sort_order: fields.sort_order || 0,
      schedule_start: fields.schedule_start || null,
      schedule_end: fields.schedule_end || null,
      festival_tag: fields.festival_tag || '',
    }]).select().single();
    if (error) throw error;
    return data;
  }

  static async updateBanner(id, fields) {
    const update = { updated_at: new Date().toISOString() };
    const allowed = ['type','title','subtitle','badge_text','cta_text','cta_url','image_url',
      'mobile_image_url','bg_color','text_color','visible','sort_order',
      'schedule_start','schedule_end','festival_tag'];
    allowed.forEach(k => { if (fields[k] !== undefined) update[k] = fields[k]; });

    // Try updating existing record first
    const { data, error } = await supabase.from('cms_banners').update(update).eq('id', id).select().maybeSingle();
    if (error) throw error;
    if (data) return data;

    // If banner with this ID doesn't exist in Supabase, create/upsert it!
    const newBannerObj = {
      type: fields.type || 'hero',
      title: fields.title || '',
      subtitle: fields.subtitle || '',
      badge_text: fields.badge_text || '',
      cta_text: fields.cta_text || 'Shop Now',
      cta_url: fields.cta_url || '#',
      image_url: fields.image_url || '',
      mobile_image_url: fields.mobile_image_url || '',
      visible: fields.visible !== undefined ? fields.visible : true,
      sort_order: fields.sort_order || 0,
      festival_tag: fields.festival_tag || '',
      ...update
    };

    // If ID is suitable as explicit string/UUID or integer, try inserting with ID
    try {
      const { data: createdWithId, error: err1 } = await supabase.from('cms_banners').insert([{ id, ...newBannerObj }]).select().single();
      if (!err1 && createdWithId) return createdWithId;
    } catch (e1) { /* fallback below */ }

    // Otherwise insert with auto-generated ID
    const { data: createdAuto, error: err2 } = await supabase.from('cms_banners').insert([newBannerObj]).select().single();
    if (err2) throw err2;
    return createdAuto;
  }

  static async deleteBanner(id) {
    const { error } = await supabase.from('cms_banners').delete().eq('id', id);
    if (error) throw error;
    return { message: 'Banner deleted' };
  }

  static async reorderBanners(orderedIds) {
    const updates = orderedIds.map((id, idx) =>
      supabase.from('cms_banners').update({ sort_order: idx }).eq('id', id)
    );
    await Promise.all(updates);
    return { message: 'Reordered' };
  }

  // ── Sections ─────────────────────────────────────────────────────────────────
  static async getSections() {
    const { data, error } = await supabase.from('cms_sections').select('*').order('sort_order', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  static async updateSection(key, fields) {
    const now = new Date().toISOString();
    const { data: existing } = await supabase.from('cms_sections').select('config, visible, sort_order, label').eq('key', key).maybeSingle();
    if (existing) {
      const update = { updated_at: now };
      if (fields.visible !== undefined) update.visible = fields.visible;
      if (fields.sort_order !== undefined) update.sort_order = fields.sort_order;
      if (fields.label !== undefined) update.label = fields.label;
      if (fields.config !== undefined) update.config = { ...(existing.config || {}), ...fields.config };
      const { data, error } = await supabase.from('cms_sections').update(update).eq('key', key).select().single();
      if (error) throw error;
      return data;
    } else {
      const upsertData = { key, updated_at: now };
      if (fields.visible !== undefined) upsertData.visible = fields.visible;
      if (fields.sort_order !== undefined) upsertData.sort_order = fields.sort_order;
      if (fields.config !== undefined) upsertData.config = fields.config;
      if (fields.label !== undefined) upsertData.label = fields.label;
      const { data, error } = await supabase.from('cms_sections').insert([upsertData]).select().single();
      if (error) throw error;
      return data;
    }
  }

  static async upsertSection(key, label, fields) {
    const row = {
      key,
      label: label || key,
      updated_at: new Date().toISOString(),
    };
    if (fields.visible !== undefined) row.visible = fields.visible;
    if (fields.sort_order !== undefined) row.sort_order = fields.sort_order;
    if (fields.config !== undefined) row.config = fields.config;
    if (fields.label !== undefined) row.label = fields.label;
    const { data, error } = await supabase
      .from('cms_sections')
      .upsert(row, { onConflict: 'key' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  static async reorderSections(orderedKeys) {
    const updates = orderedKeys.map((key, idx) =>
      supabase.from('cms_sections').update({ sort_order: idx }).eq('key', key)
    );
    await Promise.all(updates);
    return { message: 'Reordered' };
  }

  // ── Popups ───────────────────────────────────────────────────────────────────
  static async getActivePopup() {
    const { data, error } = await supabase.from('cms_popups').select('*').eq('visible', true).limit(1).maybeSingle();
    if (error) throw error;
    return data;
  }

  static async getAllPopups() {
    const { data, error } = await supabase.from('cms_popups').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createPopup(fields) {
    const { data, error } = await supabase.from('cms_popups').insert([{
      title: fields.title || '',
      body: fields.body || '',
      image_url: fields.image_url || '',
      cta_text: fields.cta_text || '',
      cta_url: fields.cta_url || '',
      visible: fields.visible !== undefined ? fields.visible : false,
      trigger_delay_seconds: fields.trigger_delay_seconds || 5,
      show_once: fields.show_once !== undefined ? fields.show_once : true,
    }]).select().single();
    if (error) throw error;
    return data;
  }

  static async updatePopup(id, fields) {
    const update = { updated_at: new Date().toISOString() };
    const allowed = ['title','body','image_url','cta_text','cta_url','visible','trigger_delay_seconds','show_once'];
    allowed.forEach(k => { if (fields[k] !== undefined) update[k] = fields[k]; });
    const { data, error } = await supabase.from('cms_popups').update(update).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  static async deletePopup(id) {
    const { error } = await supabase.from('cms_popups').delete().eq('id', id);
    if (error) throw error;
    return { message: 'Popup deleted' };
  }

  // ── Announcement ─────────────────────────────────────────────────────────────
  static async getAnnouncement() {
    // Return the section config for announcement
    const { data, error } = await supabase.from('cms_sections').select('*').eq('key', 'announcement').maybeSingle();
    if (error) throw error;
    return data;
  }

  static async updateAnnouncement(text, visible) {
    const update = {
      updated_at: new Date().toISOString(),
      config: { text },
    };
    if (visible !== undefined) update.visible = visible;
    const { data, error } = await supabase.from('cms_sections').update(update).eq('key', 'announcement').select().single();
    if (error) throw error;
    return data;
  }

  // ── Site Settings ────────────────────────────────────────────────────────────
  static async getSiteSettings() {
    const { data, error } = await supabase.from('site_settings').select('*');
    if (error) throw error;
    return data || [];
  }

  static async getSiteSetting(key) {
    const { data, error } = await supabase.from('site_settings').select('*').eq('key', key).maybeSingle();
    if (error) throw error;
    return data;
  }

  static async updateSiteSetting(key, value) {
    const row = { key, value, updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from('site_settings').upsert(row, { onConflict: 'key' }).select().single();
    if (error) throw error;
    return data;
  }
}

module.exports = CmsModel;
