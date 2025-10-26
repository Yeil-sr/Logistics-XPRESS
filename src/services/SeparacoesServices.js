const Services = require('./Services');
const db = require('../models');

class SeparacoesServices extends Services {
  constructor() {
    super('Separacao');
  }

  async marcarComoSeparado(id) {
    const transaction = await db.sequelize.transaction();
    try {
      const separacao = await db.Separacao.findByPk(id, {
        include: [{
          model: db.Pedidos,
          as: 'pedido'
        }],
        transaction
      });
      
      if (!separacao) throw new Error('Separação não encontrada');

      await separacao.update({
        status: 'SEPARADO',
        data_separacao: new Date()
      }, { transaction });

      await db.Pedidos.update(
        { status: 'AGUARDANDO_COLETA' },
        { where: { id: separacao.id_pedido }, transaction }
      );

      await db.Coleta.create({
        id_pedido: separacao.id_pedido,
        status: 'PENDENTE',
        data_coleta: null,
      }, { transaction });

      await db.Rastreamento.create({
        pedido_id: separacao.id_pedido,
        status_atual: 'AWAITING_PICKUP',
        data_status: new Date(),
        localizacao: 'Área de separação'
      }, { transaction });

      await transaction.commit();
      return separacao;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getPedidosPendentes() {
    return db.Separacao.findAll({
      where: { status: 'PENDENTE' },
      include: [{
        model: db.Pedidos,
        as: 'pedido',
        include: [{
          model: db.Produto,
          as: 'produto'
        }]
      }]
    });
  }

  async getAllWithFilters(options = {}) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      filters = {}
    } = options;

    const offset = (page - 1) * limit;
    
    const whereConditions = {};
    
    if (filters.status) {
      whereConditions.status = filters.status;
    }
    
    if (filters.data_inicio && filters.data_fim) {
      whereConditions.data_separacao = {
        [db.Sequelize.Op.between]: [new Date(filters.data_inicio), new Date(filters.data_fim)]
      };
    }

    try {
      const { count, rows } = await db.Separacao.findAndCountAll({
        where: whereConditions,
        include: [{
          model: db.Pedidos,
          as: 'pedido',
          include: [{
            model: db.Produto,
            as: 'produto'
          }]
        }],
        order: [[sortBy, sortOrder]],
        limit: parseInt(limit),
        offset: offset,
        distinct: true
      });

      return {
        separacoes: rows,
        total: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit: limit
      };
    } catch (error) {
      throw new Error(`Erro ao buscar separações: ${error.message}`);
    }
  }
}

module.exports = SeparacoesServices;