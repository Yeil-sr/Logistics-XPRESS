const Services = require('./Services');
const db = require('../models');

class PedidoItensServices extends Services {
  constructor() {
    super('PedidoItens');
  }

  async getAll(filters = {}) {
    const where = {};
    if (filters.pedido_id) where.pedido_id = filters.pedido_id;
    if (filters.produto_id) where.produto_id = filters.produto_id;

    return db.PedidoItens.findAll({
      where,
      include: [{ model: db.Produtos, as: 'produtos' }],
      order: [['id', 'ASC']]
    });
  }

  async getById(id) {
    return db.PedidoItens.findByPk(id, {
      include: [{ model: db.Produtos, as: 'produtos' }]
    });
  }

  async getByPedidoId(pedidoId) {
    return db.PedidoItens.findAll({
      where: { pedido_id: pedidoId },
      include: [{ model: db.Produtos, as: 'produtos' }],
      order: [['id', 'ASC']]
    });
  }

  async createItem(data, options = {}) {
    const transaction = options.transaction;
    return db.PedidoItens.create(data, { transaction });
  }

  async bulkCreateItens(itens = [], options = {}) {
    const transaction = options.transaction;
    if (!Array.isArray(itens)) throw new Error('itens precisa ser um array');
    // garante createdAt/updatedAt para bulkCreate quando necessário
    const payload = itens.map(i => ({ ...i, createdAt: new Date(), updatedAt: new Date() }));
    return db.PedidoItens.bulkCreate(payload, { transaction });
  }

  async updateItem(id, data, options = {}) {
    const transaction = options.transaction;
    await db.PedidoItens.update(data, { where: { id }, transaction, returning: true });
    return db.PedidoItens.findByPk(id, { transaction });
  }

  async deleteItem(id, options = {}) {
    const transaction = options.transaction;
    return db.PedidoItens.destroy({ where: { id }, transaction });
  }
}

module.exports = PedidoItensServices;
