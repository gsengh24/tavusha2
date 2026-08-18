const supabase = require('../supabase');

class ProductInstance {
  constructor(data) {
    this._id = data.id;
    this.id = data.id;
    this.title = data.title;
    this.description = data.description || '';
    this.price = data.price;
    this.colour = data.colour || '';
    this.colorVariants = Array.isArray(data.color_variants) ? data.color_variants : (Array.isArray(data.colorVariants) ? data.colorVariants : []);
    this.size = data.size || '';
    this.category = data.category || 'other';
    this.stock = data.stock || 0;
    this.inStock = data.in_stock !== undefined ? data.in_stock : (Number(this.stock) > 0);
    this.images = data.images || [];
    this.videos = data.videos || [];
    this.status = data.status || 'pending';
    this.rejectionReason = data.rejection_reason || '';
    this.createdBy = data.created_by;
    this.lastEditedBy = data.last_edited_by;
    this.approvedBy = data.approved_by;
    this.isDeleted = data.is_deleted || false;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  async save() {
    let totalStock = this.stock;
    if (Array.isArray(this.colorVariants) && this.colorVariants.length > 0) {
      totalStock = this.colorVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      this.stock = totalStock;
      this.inStock = totalStock > 0;
    }

    const updateData = {
      title: this.title,
      description: this.description,
      price: this.price,
      colour: this.colour,
      color_variants: this.colorVariants,
      size: this.size,
      category: this.category,
      stock: this.stock,
      in_stock: this.inStock,
      images: this.images,
      videos: this.videos,
      status: this.status,
      rejection_reason: this.rejectionReason,
      created_by: this.createdBy,
      last_edited_by: this.lastEditedBy,
      approved_by: this.approvedBy,
      is_deleted: this.isDeleted,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', this.id)
      .select()
      .single();

    if (error) throw error;
    return new ProductInstance(data);
  }
}

class ProductModel {
  static async find(filter = {}) {
    let builder = supabase.from('products').select('*');

    if (filter.isDeleted !== undefined) {
      builder = builder.eq('is_deleted', filter.isDeleted);
    }
    if (filter.status) {
      builder = builder.eq('status', filter.status);
    }

    if (filter.$or) {
      const createdByItem = filter.$or.find(o => o.createdBy);
      const statusItem = filter.$or.find(o => o.status);
      if (createdByItem && statusItem) {
        builder = builder.or(`created_by.eq.${createdByItem.createdBy},status.eq.${statusItem.status}`);
      }
    }

    builder = builder.order('created_at', { ascending: false });

    const { data, error } = await builder;
    if (error) throw error;
    return (data || []).map(p => new ProductInstance(p));
  }

  static async findById(id) {
    if (!id) return null;
    const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;
    return new ProductInstance(data);
  }

  static async create(fields) {
    let colorVariants = fields.colorVariants || fields.color_variants || [];
    if (typeof colorVariants === 'string') {
      try { colorVariants = JSON.parse(colorVariants); } catch(e) { colorVariants = []; }
    }
    let stock = Number(fields.stock || 0);
    if (Array.isArray(colorVariants) && colorVariants.length > 0) {
      stock = colorVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
    }

    const priceNum = Number(fields.price || 0);

    const insertData = {
      title: fields.title,
      description: fields.description || '',
      price: priceNum,
      colour: fields.colour || '',
      color_variants: colorVariants,
      size: fields.size || '',
      category: fields.category || 'other',
      stock: stock,
      in_stock: fields.inStock !== undefined ? Boolean(fields.inStock) : (stock > 0),
      images: Array.isArray(fields.images) ? fields.images : [],
      videos: Array.isArray(fields.videos) ? fields.videos : [],
      status: fields.status || 'approved',
      rejection_reason: fields.rejectionReason || '',
      is_deleted: false
    };

    if (fields.createdBy && !['admin_default', 'admin1'].includes(fields.createdBy)) {
      insertData.created_by = fields.createdBy;
    }

    try {
      const { data, error } = await supabase.from('products').insert([insertData]).select().single();
      if (error) throw error;
      return new ProductInstance(data);
    } catch (err) {
      console.warn('Supabase Product.create initial insert warning:', err.message || err);
      // Clean fallback insert for core columns if database schema constraint fails
      const fallbackData = {
        title: fields.title,
        price: priceNum,
        description: fields.description || '',
        category: fields.category || 'other',
        stock: stock,
        in_stock: stock > 0,
        images: Array.isArray(fields.images) ? fields.images : [],
        status: 'approved'
      };
      const { data: d2, error: e2 } = await supabase.from('products').insert([fallbackData]).select().single();
      if (e2) throw e2;
      return new ProductInstance(d2);
    }
  }

  static async findByIdAndDelete(id) {
    const prod = await this.findById(id);
    if (!prod) return null;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
    return prod;
  }
}

module.exports = ProductModel;
