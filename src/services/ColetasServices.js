const Services = require('./Services');
const db = require('../models');

class ColetasServices extends Services {
  constructor() {
    super('Coleta');
  }

  async marcarComoColetado(id) {
    const transaction = await db.sequelize.transaction();
    try {
      const coleta = await db.Coleta.findByPk(id, {
        include: [{
          model: db.Pedidos,
          as: 'pedido'
        }],
        transaction
      });
      
      if (!coleta) throw new Error('Coleta não encontrada');

      await coleta.update({
        status: 'REALIZADA',
        data_coleta: new Date()
      }, { transaction });

      await db.Pedidos.update(
        { status: 'EM_TRANSITO' },
        { where: { id: coleta.id_pedido }, transaction }
      );

      await db.Rastreamento.create({
        pedido_id: coleta.id_pedido,
        status_atual: 'IN_TRANSIT',
        data_status: new Date(),
        localizacao: 'Em trânsito para hub'
      }, { transaction });

      await transaction.commit();
      return coleta;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getColetasPendentes() {
    return db.Coleta.findAll({
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
      whereConditions.data_coleta = {
        [db.Sequelize.Op.between]: [new Date(filters.data_inicio), new Date(filters.data_fim)]
      };
    }

    try {
      const { count, rows } = await db.Coleta.findAndCountAll({
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
        coletas: rows,
        total: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit: limit
      };
    } catch (error) {
      throw new Error(`Erro ao buscar coletas: ${error.message}`);
    }
  }
}

module.exports = ColetasServices;