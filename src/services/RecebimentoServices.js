const Services = require('./Services');
const db = require('../models');

class RecebimentoServices extends Services {
  constructor() {
    super('Recebimento');
  }

  calcularImpactoDivergencia(totalEsperado, totalConferido) {
    const diferenca = Math.abs(totalEsperado - totalConferido);
    const custoPorDivergencia = 100;
    return diferenca * custoPorDivergencia;
  }

  async getById(id) {
    return db.Recebimento.findByPk(id, {
      include: [
        { model: db.Usuario, as: 'usuarios', attributes: ['nome'] },
        { model: db.Pedidos, as: 'pedidos' }
      ]
    });
  }

  async createWithPedidos(dados) {
    const transaction = await db.sequelize.transaction();

    try {
      const { pedidosCodigos = [], ...dadosRecebimento } = dados;

      const novoRecebimento = await db.Recebimento.create({
        ...dadosRecebimento,
        status: 'PENDENTE',
        data_criacao: new Date()
      }, { transaction });

      let pedidos = [];
      if (pedidosCodigos.length > 0) {
        pedidos = await db.Pedidos.findAll({
          where: { codigo_pedido: pedidosCodigos },
          transaction
        });

        if (pedidos.length !== pedidosCodigos.length) {
          throw new Error('Um ou mais pedidos informados não foram encontrados.');
        }

        await db.Pedidos.update(
          { recebimento_id: novoRecebimento.id },
          { where: { codigo_pedido: pedidosCodigos }, transaction }
        );
      }

      novoRecebimento.quantidade_pedidos = pedidos.length;
      await novoRecebimento.save({ transaction });

      await transaction.commit();

      return {
        message: "Recebimento criado com sucesso",
        recebimento: novoRecebimento,
        pedidosVinculados: pedidos
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async concluirRecebimento(id) {
    const transaction = await db.sequelize.transaction();

    try {
      const recebimento = await db.Recebimento.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!recebimento) {
        throw new Error('Recebimento não encontrado');
      }

      if (recebimento.status === 'CONCLUIDO') {
        throw new Error('Recebimento já está concluído');
      }

      const pedidos = await db.Pedidos.findAll({
        where: { recebimento_id: id },
        transaction
      });

      if (!pedidos || pedidos.length === 0) {
        throw new Error(`Não é possível concluir recebimento ${id} sem pedidos`);
      }

      if (recebimento.quantidade_pedidos !== pedidos.length) {
        await db.Excecao.create({
          numero_ocorrencia: `TO-${Date.now()}`,
          tipo: 'DIVERGENCIA',
          gravidade: 'ALTA',
          titulo: `Divergência na quantidade de pedidos - Recebimento ${recebimento.id}`,
          descricao: `Quantidade esperada: ${recebimento.quantidade_pedidos}, Quantidade recebida: ${pedidos.length}`,
          recebimento_id: recebimento.id,
          criador_id: recebimento.operador_id,
          data_ocorrencia: new Date(),
          impacto_financeiro: this.calcularImpactoDivergencia(
            recebimento.quantidade_pedidos,
            pedidos.length
          ),
          status: 'ABERTA'
        }, { transaction });
      }

      recebimento.status = 'CONCLUIDO';
      recebimento.data_conclusao = new Date();
      recebimento.quantidade_pedidos = pedidos.length;
      await recebimento.save({ transaction });

      const transporte = await db.Transporte.create({
        tipo_transporte: 'TO',
        numero_transporte: `TO-${Date.now()}`,
        recebimento_id: recebimento.id,
        quantidade_total: pedidos.length,
        status_transporte: 'CRIADO',
        operador_id: recebimento.operador_id,
        direcao: 'INBOUND',
        data_criacao: new Date()
      }, { transaction });

      const conferencia = await db.Conferencia.create({
        tipo: 'INBOUND',
        transporte_id: transporte.id,
        status: 'PENDENTE',
        total_pedidos_iniciais: pedidos.length,
        total_pedidos_finais: pedidos.length,
        operador_id: recebimento.operador_id,
        data_criacao: new Date()
      }, { transaction });

      await db.Pedidos.update(
        { 
          transporte_id: transporte.id, 
          conferencia_id: conferencia.id,
          status: 'AGUARDANDO_CONFERENCIA'
        },
        {
          where: { recebimento_id: recebimento.id },
          transaction
        }
      );

      for (const pedido of pedidos) {
        await db.Rastreamento.create({
          id_pedido: pedido.id,
          status_atual: 'RECEIVED',
          data_status: new Date(),
          localizacao: 'Hub origem',
          observacao: `Recebimento ${recebimento.id} concluído`
        }, { transaction });
      }

      await transaction.commit();

      return {
        message: "Recebimento concluído com sucesso",
        recebimento,
        transporte,
        conferencia,
        totalPedidos: pedidos.length
      };

    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error('Erro ao concluir recebimento:', error);
      throw new Error(`Erro ao concluir recebimento: ${error.message}`);
    }
  }

  async getPedidosByRecebimento(id) {
    const recebimento = await db.Recebimento.findByPk(id, {
      include: [{ model: db.Pedidos, as: 'pedidos' }]
    });

    if (!recebimento) {
      throw new Error('Recebimento não encontrado');
    }

    return recebimento.pedidos || [];
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
    
    if (filters.operador_id) {
      whereConditions.operador_id = filters.operador_id;
    }
    
    if (filters.data_inicio && filters.data_fim) {
      whereConditions.data_criacao = {
        [Op.between]: [new Date(filters.data_inicio), new Date(filters.data_fim)]
      };
    }

    try {
      const { count, rows } = await db.Recebimento.findAndCountAll({
        where: whereConditions,
        include: [
          { model: db.Usuario, as: 'usuarios', attributes: ['nome'] }
        ],
        order: [[sortBy, sortOrder]],
        limit: parseInt(limit),
        offset: offset,
        distinct: true
      });

      return {
        recebimentos: rows,
        total: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit: limit
      };
    } catch (error) {
      throw new Error(`Erro ao buscar recebimentos: ${error.message}`);
    }
  }

  async searchRecebimentos(query, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    
    try {
      const { count, rows } = await db.Recebimento.findAndCountAll({
        where: {
          [Op.or]: [
            { id: { [Op.eq]: !isNaN(query) ? parseInt(query) : 0 } },
            { '$usuarios.nome$': { [Op.iLike]: `%${query}%` } },
            { status: { [Op.iLike]: `%${query}%` } }
          ]
        },
        include: [
          { model: db.Usuario, as: 'usuarios', attributes: ['nome'] }
        ],
        order: [['data_criacao', 'DESC']],
        limit: parseInt(limit),
        offset: offset,
        distinct: true
      });

      return {
        recebimentos: rows,
        total: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit: limit
      };
    } catch (error) {
      throw new Error(`Erro na busca de recebimentos: ${error.message}`);
    }
  }
}

module.exports = RecebimentoServices;