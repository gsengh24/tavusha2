const bcrypt = require('bcryptjs');
const supabase = require('../supabase');

class StaffModel {
  static async findOne(query) {
    let builder = supabase.from('staff').select('*');
    if (query.loginId) {
      builder = builder.eq('login_id', query.loginId.toLowerCase().trim());
    }
    if (query.role) {
      builder = builder.eq('role', query.role);
    }
    const { data, error } = await builder.maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;
    return this.formatUser(data);
  }

  static async findById(id) {
    if (!id) return null;
    const { data, error } = await supabase.from('staff').select('*').eq('id', id).maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;
    return this.formatUser(data);
  }

  static async find(query = {}) {
    let builder = supabase.from('staff').select('*');
    if (query.role) {
      builder = builder.eq('role', query.role);
    }
    builder = builder.order('created_at', { ascending: false });
    const { data, error } = await builder;
    if (error) throw error;
    return (data || []).map(u => this.formatUser(u));
  }

  static async create(fields) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(fields.password, salt);
    
    const insertData = {
      name: fields.name.trim(),
      login_id: fields.loginId.toLowerCase().trim(),
      password: hashedPassword,
      role: fields.role || 'staff',
      permissions: fields.permissions || { canUpload: true, canEdit: true, canDelete: false, canUpdateStock: true },
      is_active: fields.isActive !== undefined ? fields.isActive : true
    };

    const { data, error } = await supabase.from('staff').insert([insertData]).select().single();
    if (error) throw error;
    return this.formatUser(data);
  }

  static async findByIdAndUpdate(id, updates) {
    const staff = await this.findById(id);
    if (!staff) return null;

    const updateData = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.permissions !== undefined) updateData.permissions = updates.permissions;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
    if (updates.password !== undefined) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(updates.password, salt);
    }
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from('staff').update(updateData).eq('id', id).select().single();
    if (error) throw error;
    return this.formatUser(data);
  }

  static async findByIdAndDelete(id) {
    const staff = await this.findById(id);
    if (!staff) return null;
    const { error } = await supabase.from('staff').delete().eq('id', id);
    if (error) throw error;
    return staff;
  }

  static formatUser(data) {
    if (!data) return null;
    const user = {
      _id: data.id,
      id: data.id,
      name: data.name,
      loginId: data.login_id,
      role: data.role,
      permissions: data.permissions || { canUpload: true, canEdit: true, canDelete: false, canUpdateStock: true },
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      comparePassword: async function (candidate) {
        return bcrypt.compare(candidate, data.password);
      },
      toJSON: function () {
        const copy = { ...user };
        delete copy.comparePassword;
        delete copy.toJSON;
        return copy;
      }
    };
    return user;
  }
}

module.exports = StaffModel;
