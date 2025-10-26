const Services = require('./Services');
const db = require('../models');

class ExpedicoesServices extends Services {
  constructor() {
    super('Expedicaos');
  }

  async createExpedicaoComPedido(pedidoId) {
    const transaction = await db.sequelize.transaction();
    try {
      const pedido = await db.Pedidos.findByPk(pedidoId, { transaction });
      if (!pedido) throw new Error('Pedido não encontrado');

      const rastreio = "XPRESS" + Math.floor(Math.random() * 999999);

      const novaExpedicao = await db.Expedicaos.create({
        id_pedido: pedidoId,
        data_envio: new Date(),
        nota_fiscal: "NF" + pedidoId,
        codigo_rastreamento: rastreio,
      }, { transaction });

      await db.Pedidos.update(
        { status: 'AGUARDANDO_SEPARACAO' },
        { where: { id: pedidoId }, transaction }
      );

      await db.Separacao.create({
        id_pedido: pedidoId,
        status: 'PENDENTE',
        data_separacao: null,
      }, { transaction });

      await db.Rastreamento.create({
        pedido_id: pedidoId,
        status_atual: 'AWAITING_SEPARATION',
        data_status: new Date(),
        localizacao: 'Área de expedição'
      }, { transaction });

      await transaction.commit();

      return {
        message: "Pedido expedido e aguardando separação",
        codigo_rastreamento: rastreio,
        expedicao: novaExpedicao
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
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
      whereConditions.data_envio = {
        [db.Sequelize.Op.between]: [new Date(filters.data_inicio), new Date(filters.data_fim)]
      };
    }

    try {
      const { count, rows } = await db.Expedicaos.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: db.Pedidos,
            as: 'pedido',
            include: [
              {
                model: db.Produto,
                as: 'produto'
              }
            ]
          }
        ],
        order: [[sortBy, sortOrder]],
        limit: parseInt(limit),
        offset: offset,
        distinct: true
      });

      return {
        expedicoes: rows,
        total: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit: limit
      };
    } catch (error) {
      throw new Error(`Erro ao buscar expedições: ${error.message}`);
    }
  }
}

module.exports = ExpedicoesServices;