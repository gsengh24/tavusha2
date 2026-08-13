const supabase = require('../supabase');

class ShippingZoneModel {
  static async getAll() {
    try {
      const { data, error } = await supabase.from('shipping_zones').select('*').order('rate_per_piece', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('ShippingZone.getAll DB warning:', e.message);
      return [];
    }
  }

  static async getActive() {
    try {
      const { data, error } = await supabase.from('shipping_zones').select('*').eq('is_active', true);
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('ShippingZone.getActive DB warning:', e.message);
      return [];
    }
  }

  static async findByPincode(pincode) {
    const pin = String(pincode || '').trim();
    let zones = [];
    try {
      zones = await this.getActive();
    } catch (e) {
      zones = [];
    }

    // Match from most specific (longest prefix) to least specific
    let matched = null;
    let longestMatch = 0;
    if (zones && zones.length) {
      for (const zone of zones) {
        const prefixes = zone.pincode_prefixes || [];
        for (const prefix of prefixes) {
          if (pin.startsWith(prefix) && prefix.length > longestMatch) {
            matched = zone;
            longestMatch = prefix.length;
          }
        }
      }
    }

    if (matched) return matched;

    // Built-in rule fallback
    const prefix2 = pin.slice(0, 2);
    const ne = ['78','79','83','84','85','86','87','88','89','90','91','92','93','94','95','96','97'];
    if (ne.includes(prefix2)) return { name: 'North-East India', rate_per_piece: 150 };
    if (['7','8'].includes(pin.slice(0, 1))) return { name: 'West Bengal & Assam', rate_per_piece: 100 };
    if (parseInt(pin.slice(0, 2)) <= 33) return { name: 'North India', rate_per_piece: 60 };

    return {
      name: 'Central & South India',
      rate_per_piece: 100,
    };
  }

  static async create(fields) {
    const { data, error } = await supabase.from('shipping_zones').insert([{
      name: fields.name,
      rate_per_piece: fields.rate_per_piece || 60,
      states: fields.states || [],
      pincode_prefixes: fields.pincode_prefixes || [],
      is_active: fields.is_active !== undefined ? fields.is_active : true,
      free_shipping_above: fields.free_shipping_above || null,
    }]).select().single();
    if (error) throw error;
    return data;
  }

  static async update(id, fields) {
    const update = { updated_at: new Date().toISOString() };
    const allowed = ['name','rate_per_piece','states','pincode_prefixes','is_active','free_shipping_above'];
    allowed.forEach(k => { if (fields[k] !== undefined) update[k] = fields[k]; });
    const { data, error } = await supabase.from('shipping_zones').update(update).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  static async delete(id) {
    const { error } = await supabase.from('shipping_zones').delete().eq('id', id);
    if (error) throw error;
    return { message: 'Zone deleted' };
  }
}

module.exports = ShippingZoneModel;

