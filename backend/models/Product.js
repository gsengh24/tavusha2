const supabase = require('../supabase');

class ProductInstance {
  constructor(data) {
    this._id = data.id;
    this.id = data.id;
    this.title = data.title;
    this.description = data.description || '';
    this.price = data.price;
    this.colour = data.colour || '';
    this.size = data.size || '';
    this.category = data.category || 'other';
    this.stock = data.stock || 0;
    this.inStock = data.in_stock !== undefined ? data.in_stock : true;
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
    const updateData = {
      title: this.title,
      description: this.description,
      price: this.price,
      colour: this.colour,
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
    const insertData = {
      title: fields.title,
      description: fields.description || '',
      price: fields.price,
      colour: fields.colour || '',
      size: fields.size || '',
      category: fields.category || 'other',
      stock: fields.stock || 0,
      in_stock: fields.inStock !== undefined ? fields.inStock : (Number(fields.stock || 0) > 0),
      images: fields.images || [],
      videos: fields.videos || [],
      status: fields.status || 'pending',
      rejection_reason: fields.rejectionReason || '',
      created_by: fields.createdBy,
      is_deleted: fields.isDeleted || false
    };

    const { data, error } = await supabase.from('products').insert([insertData]).select().single();
    if (error) throw error;
    return new ProductInstance(data);
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
