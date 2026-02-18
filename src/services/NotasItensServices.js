const Services = require('./Services');
const db = require('../models');

class NotasItensServices extends Services {
  constructor() {
    super('NotasItens');
  }

  async getAll(filters = {}) {
    const where = {};
    if (filters.nota_id) where.nota_id = filters.nota_id;
    if (filters.produto_id) where.produto_id = filters.produto_id;

    return db.NotasItens.findAll({
      where,
      include: [{ model: db.Produtos, as:'produtos' }],
      order: [['id', 'ASC']]
    });
  }

  async getById(id) {
    return db.NotasItens.findByPk(id, { include: [{ model: db.Produtos, as:'produtos' }], as:'notaItens' });
  }

  async getByNotaId(notaId) {
    return db.NotasItens.findAll({
      where: { nota_id: notaId },
      as:'notaItens',
      include: [{ model: db.Produtos }]
    });
  }

  async createItem(data, options = {}) {
    const transaction = options.transaction;
    return db.NotasItens.create(data, { transaction });
  }

  async bulkCreate(itens = [], options = {}) {
    const transaction = options.transaction;
    const payload = itens.map(i => ({ ...i, createdAt: new Date(), updatedAt: new Date() }));
    return db.NotasItens.bulkCreate(payload, { transaction });
  }

  async updateItem(id, data, options = {}) {
    const transaction = options.transaction;
    await db.NotasItens.update(data, { where: { id }, transaction, returning: true });
    return db.NotasItens.findByPk(id, { transaction });
  }

  async deleteItem(id, options = {}) {
    const transaction = options.transaction;
    return db.NotasItens.destroy({ where: { id }, transaction });
  }
}

module.exports = NotasItensServices;
