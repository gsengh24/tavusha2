const supabase = require('../supabase');

class ShippingZoneModel {
  static async getAll() {
    const { data, error } = await supabase.from('shipping_zones').select('*').order('rate_per_piece', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  static async getActive() {
    const { data, error } = await supabase.from('shipping_zones').select('*').eq('is_active', true);
    if (error) throw error;
    return data || [];
  }

  static async findByPincode(pincode) {
    const pin = String(pincode).trim();
    const zones = await this.getActive();

    // Match from most specific (longest prefix) to least specific
    let matched = null;
    let longestMatch = 0;
    for (const zone of zones) {
      const prefixes = zone.pincode_prefixes || [];
      for (const prefix of prefixes) {
        if (pin.startsWith(prefix) && prefix.length > longestMatch) {
          matched = zone;
          longestMatch = prefix.length;
        }
      }
    }

    if (matched) return matched;

    // Fallback: try state lookup (for cases where pincode DB might be incomplete)
    // Default to Central India rate if no match
    return {
      name: 'Default',
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
