const Services = require('./Services');
const db = require('../models');
const { Op } = require('sequelize');

class ConferenciaServices extends Services {
  constructor() {
    super('Conferencia');
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
    
    if (filters.tipo) {
      whereConditions.tipo = filters.tipo;
    }
    
    if (filters.status) {
      whereConditions.status = filters.status;
    }
    
    if (filters.operador_id) {
      whereConditions.operador_id = filters.operador_id;
    }
    
    if (filters.data_inicio && filters.data_fim) {
      whereConditions.data_inicio = {
        [Op.between]: [new Date(filters.data_inicio), new Date(filters.data_fim)]
      };
    } else if (filters.data_inicio) {
      whereConditions.data_inicio = {
        [Op.gte]: new Date(filters.data_inicio)
      };
    } else if (filters.data_fim) {
      whereConditions.data_inicio = {
        [Op.lte]: new Date(filters.data_fim)
      };
    }
    
    if (filters.nome_estacao) {
      whereConditions.nome_estacao = {
        [Op.iLike]: `%${filters.nome_estacao}%`
      };
    }

    if (filters.disponiveis === true) {
      whereConditions.transporte_id = { [Op.is]: null };
    }

    try {
      const { count, rows } = await db.Conferencia.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: db.Transporte,
            as: 'transporte',
            include: [
              {
                model: db.Motorista,
                as: 'motorista'
              },
              {
                model: db.Hubs,
                as: 'hubOrigem'
              },
              {
                model: db.Hubs,
                as: 'hubDestino'
              }
            ]
          },
          { model: db.Usuario, as: 'operador' },
          { model: db.Pedidos, as: 'pedidos' }
        ],
        order: [[sortBy, sortOrder]],
        limit: parseInt(limit),
        offset: offset,
        distinct: true
      });

      return {
        conferencias: rows,
        total: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit: limit
      };
    } catch (error) {
      throw new Error(`Erro ao buscar conferências: ${error.message}`);
    }
  }

  async getConferenciasDisponiveis() {
    try {
      return await db.Conferencia.findAll({
        where: {
          status: 'PENDENTE',
          transporte_id: null // Conferências não associadas a transportes
        },
        include: [
          {
            model: db.Pedidos,
            as: 'pedidos',
            attributes: ['id', 'codigo_pedido', 'status']
          },
          {
            model: db.Usuario,
            as: 'operador',
            attributes: ['id', 'nome']
          }
        ],
        attributes: ['id', 'nome_estacao', 'status', 'tipo', 'data_inicio', 'total_pedidos_esperados'],
        order: [['data_inicio', 'DESC']]
      });
    } catch (error) {
      throw new Error(`Erro ao buscar conferências disponíveis: ${error.message}`);
    }
  }

  async findConferencia(identifier) {
    try {
      const id = Number(identifier);
      
      if (!isNaN(id)) {
        // Busca por ID
        return await db.Conferencia.findByPk(id, {
          include: [
            {
              model: db.Transporte,
              as: 'transporte',
              include: [
                { model: db.Motorista, as: 'motorista' },
                { model: db.Hubs, as: 'hubOrigem' },
                { model: db.Hubs, as: 'hubDestino' }
              ]
            },
            { model: db.Usuario, as: 'operador' },
            { 
              model: db.Pedidos, 
              as: 'pedidos',
              include: [
                { model: db.Produtos, as: 'produto' },
                { model: db.Clientes, as: 'cliente' }
              ]
            }
          ]
        });
      } else {
        return await db.Conferencia.findOne({
          where: {
            nome_estacao: {
              [Op.iLike]: `%${identifier}%`
            }
          },
          include: [
            {
              model: db.Transporte,
              as: 'transporte',
              include: [
                { model: db.Motorista, as: 'motorista' },
                { model: db.Hubs, as: 'hubOrigem' },
                { model: db.Hubs, as: 'hubDestino' }
              ]
            },
            { model: db.Usuario, as: 'operador' },
            { 
              model: db.Pedidos, 
              as: 'pedidos',
              include: [
                { model: db.Produtos, as: 'produto' },
                { model: db.Clientes, as: 'cliente' }
              ]
            }
          ]
        });
      }
    } catch (error) {
      throw new Error(`Erro ao buscar conferência: ${error.message}`);
    }
  }

  async searchConferencias(query, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    
    try {
      const { count, rows } = await db.Conferencia.findAndCountAll({
        where: {
          [Op.or]: [
            { nome_estacao: { [Op.iLike]: `%${query}%` } },
            { tipo: { [Op.iLike]: `%${query}%` } },
            { status: { [Op.iLike]: `%${query}%` } },
            { '$transporte.numero_transporte$': { [Op.iLike]: `%${query}%` } },
            { '$operador.nome$': { [Op.iLike]: `%${query}%` } }
          ]
        },
        include: [
          {
            model: db.Transporte,
            as: 'transporte',
            include: [
              {
                model: db.Motorista,
                as: 'motorista'
              }
            ]
          },
          { model: db.Usuario, as: 'operador' },
          { model: db.Pedidos, as: 'pedidos' }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: offset,
        distinct: true
      });

      return {
        conferencias: rows,
        total: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit: limit
      };
    } catch (error) {
      throw new Error(`Erro na busca de conferências: ${error.message}`);
    }
  }
  
  async getById(id) {
    return db.Conferencia.findByPk(id, {
      include: [
        {
          model: db.Transporte,
          as: 'transporte',
          include: [
            {
              model: db.Motorista,
              as: 'motorista'
            }
          ]
        },
        { model: db.Usuario, as: 'operador' },
        { model: db.Pedidos, as: 'pedidos' }
      ]
    });
  }

  async getConferenciaCompleta(id) {
    try {
      return await db.Conferencia.findByPk(id, {
        include: [
          {
            model: db.Transporte,
            as: 'transporte',
            include: [
              { model: db.Motorista, as: 'motorista' },
              { model: db.Hubs, as: 'hubOrigem' },
              { model: db.Hubs, as: 'hubDestino' },
              { model: db.Rota, as: 'rota' }
            ]
          },
          { 
            model: db.Usuario, 
            as: 'operador',
            attributes: ['id', 'nome', 'email']
          },
          { 
            model: db.Pedidos, 
            as: 'pedidos',
            include: [
              { 
                model: db.Produtos, 
                as: 'produto',
                attributes: ['id', 'nome', 'codigo', 'peso', 'dimensoes']
              },
              { 
                model: db.Clientes, 
                as: 'cliente',
                attributes: ['id', 'nome', 'telefone', 'email']
              },
              {
                model: db.Endereco,
                as: 'endereco',
                attributes: ['id', 'logradouro', 'numero', 'cidade', 'estado', 'cep']
              }
            ]
          }
        ]
      });
    } catch (error) {
      throw new Error(`Erro ao buscar conferência completa: ${error.message}`);
    }
  }

  async getPedidosValidados(conferenciaId) {
    const pedidos = await db.Pedidos.findAll({
      where: {
        conferencia_id: conferenciaId,
        status: 'VALIDADO'
      }
    });

    return pedidos;
  }

  async createComPedidos(dados) {
    const transaction = await db.sequelize.transaction();

    try {
      if (!dados.tipo) {
        throw new Error('Tipo da conferência é obrigatório');
      }

      if (!dados.operador_id) {
        throw new Error('Operador é obrigatório');
      }

      const conferencia = await db.Conferencia.create({
        tipo: dados.tipo,
        operador_id: dados.operador_id,
        nome_estacao: dados.nome_estacao || null,
        status: 'PENDENTE',
        total_pedidos_esperados: dados.pedidos?.length || 0,
        total_pedidos_iniciais: dados.pedidos?.length || 0,
        total_pedidos_finais: dados.pedidos?.length || 0,
        total_AT_TO: 0,
        data_inicio: new Date()
      }, { transaction });

      if (dados.tipo === 'OUTBOUND' && dados.transporte_id) {
        conferencia.transporte_id = dados.transporte_id;
        await conferencia.save({ transaction });
      }

      if (dados.pedidos && dados.pedidos.length > 0) {
        for (const pedidoIdentifier of dados.pedidos) {
          let pedido;
          if (typeof pedidoIdentifier === 'number') {
            pedido = await db.Pedidos.findByPk(pedidoIdentifier, { transaction });
          } else if (typeof pedidoIdentifier === 'string') {
            pedido = await db.Pedidos.findOne({
              where: { codigo_pedido: pedidoIdentifier },
              transaction
            });
          }

          if (!pedido) throw new Error(`Pedido ${pedidoIdentifier} não encontrado`);

          pedido.conferencia_id = conferencia.id;

          if (dados.tipo === 'INBOUND') {
            pedido.status = 'AGUARDANDO_CONFERENCIA';

            await db.Rastreamento.create({
              id_pedido: pedido.id,
              status_atual: 'NO_HUB',
              data_status: new Date(),
              localizacao: 'Portaria / Recebimento'
            }, { transaction });
          }

          if (dados.tipo === 'OUTBOUND') {
            pedido.status = 'AGUARDANDO_SEPARACAO';

            await db.Separacao.create({
              id_pedido: pedido.id,
              conferencia_id: conferencia.id,
              corredor_gaiola: null,
              status: 'PENDENTE',
              data_separacao: null
            }, { transaction });

            await db.Rastreamento.create({
              id_pedido: pedido.id,
              status_atual: 'NO_HUB',
              data_status: new Date(),
              localizacao: 'Área de picking'
            }, { transaction });
          }

          await pedido.save({ transaction });
        }
      }

      await transaction.commit();
      return await db.Conferencia.findByPk(conferencia.id, {
        include: [
          { model: db.Pedidos, as: 'pedidos' },
          { model: db.Transporte, as: 'transporte' }
        ]
      });
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  async getPedidosByConferencia(id) {
    const conferencia = await db.Conferencia.findByPk(id, {
      include: [{ model: db.Pedidos, as: 'pedidos' }]
    });
    if (!conferencia) throw new Error('Conferência não encontrada');
    return conferencia.pedidos || [];
  }

  async validarPedido(conferenciaId, pedidoId) {
    const transaction = await db.sequelize.transaction();

    try {
      const conferencia = await db.Conferencia.findByPk(conferenciaId);
      if (!conferencia) throw new Error('Conferência não encontrada');

      const pedido = await db.Pedidos.findByPk(pedidoId);
      if (!pedido) throw new Error('Pedido não encontrado');

      if (pedido.conferencia_id !== parseInt(conferenciaId)) {
        throw new Error('Pedido não pertence a esta conferência');
      }

      if (pedido.status === 'VALIDADO') {
        throw new Error('Pedido já foi validado');
      }

      pedido.status = 'VALIDADO';
      await pedido.save({ transaction });

      await this.atualizarEstatisticasConferencia(conferenciaId, transaction);

      await transaction.commit();
      return { success: true, pedido };
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  async invalidarPedido(conferenciaId, pedidoId) {
    const transaction = await db.sequelize.transaction();

    try {
      const conferencia = await db.Conferencia.findByPk(conferenciaId);
      if (!conferencia) throw new Error('Conferência não encontrada');

      const pedido = await db.Pedidos.findByPk(pedidoId);
      if (!pedido) throw new Error('Pedido não encontrado');

      if (pedido.conferencia_id !== parseInt(conferenciaId)) {
        throw new Error('Pedido não pertence a esta conferência');
      }

      pedido.status = 'CANCELADO';
      await pedido.save({ transaction });

      await this.atualizarEstatisticasConferencia(conferenciaId, transaction);

      await transaction.commit();
      return { success: true, pedido };
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  async atualizarEstatisticasConferencia(conferenciaId, transaction = null) {
    try {
      const options = transaction ? { transaction } : {};
      
      const pedidosValidados = await db.Pedidos.count({
        where: {
          conferencia_id: conferenciaId,
          status: 'VALIDADO'
        },
        ...options
      });

      const totalPedidos = await db.Pedidos.count({
        where: {
          conferencia_id: conferenciaId
        },
        ...options
      });

      await db.Conferencia.update({
        pedidos_escaneados: pedidosValidados,
        percentual_validacao: totalPedidos > 0 ? (pedidosValidados / totalPedidos) * 100 : 0
      }, {
        where: { id: conferenciaId },
        ...options
      });

      return { pedidosValidados, totalPedidos };
    } catch (error) {
      throw new Error(`Erro ao atualizar estatísticas: ${error.message}`);
    }
  }

  async associarPedido(conferenciaId, pedidoId) {
    const transaction = await db.sequelize.transaction();

    try {
      const conferencia = await db.Conferencia.findByPk(conferenciaId);
      if (!conferencia) throw new Error('Conferência não encontrada');

      const pedido = await db.Pedidos.findByPk(pedidoId);
      if (!pedido) throw new Error('Pedido não encontrado');

      if (pedido.conferencia_id && pedido.conferencia_id !== parseInt(conferenciaId)) {
        throw new Error('Pedido já está associado a outra conferência');
      }

      pedido.conferencia_id = conferenciaId;
      await pedido.save({ transaction });

      const totalPedidos = await db.Pedidos.count({
        where: { conferencia_id: conferenciaId },
        transaction
      });

      await db.Conferencia.update({
        total_pedidos_esperados: totalPedidos,
        total_pedidos_iniciais: totalPedidos,
        total_pedidos_finais: totalPedidos
      }, {
        where: { id: conferenciaId },
        transaction
      });

      await transaction.commit();
      return { success: true, pedido };
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  async concluirConferencia(id, dados = {}) {
    const transaction = await db.sequelize.transaction();

    try {
      const conferencia = await db.Conferencia.findByPk(id, {
        include: [
          { 
            model: db.Transporte, 
            as: 'transporte', 
            include: [
              { model: db.Motorista, as: 'motorista' },
              { model: db.Hubs, as: 'hubOrigem' },
              { model: db.Hubs, as: 'hubDestino' }
            ] 
          },
          { model: db.Usuario, as: 'operador' },
          { 
            model: db.Pedidos, 
            as: 'pedidos',
            include: [
              { model: db.Produtos, as: 'produto' },
              { model: db.Clientes, as: 'cliente' }
            ]
          }
        ],
        transaction
      });

      if (!conferencia) throw new Error('Conferência não encontrada');
      if (conferencia.status === 'CONCLUIDO') throw new Error('Conferência já concluída');

      if (!conferencia.pedidos || conferencia.pedidos.length === 0) {
        throw new Error('Conferência não possui pedidos para processar');
      }

      conferencia.status = 'CONCLUIDO';
      conferencia.data_fim = new Date();
      await conferencia.save({ transaction });

      const pedidosEscaneados = conferencia.pedidos.filter(p => p.status === 'VALIDADO').length;
      
      if (conferencia.total_pedidos_finais !== pedidosEscaneados) {
        const impactoFinanceiro = this.calcularImpactoDivergencia(conferencia.total_pedidos_finais, pedidosEscaneados);
        const numeroOcorrencia = "EXC-" + Date.now();
        
        await db.Excecao.create({
          numero_ocorrencia: numeroOcorrencia,
          tipo: 'DIVERGENCIA',
          gravidade: 'ALTA',
          titulo: `Divergência na conferência - ${conferencia.id}`,
          descricao: `Total esperado: ${conferencia.total_pedidos_finais}, escaneados: ${pedidosEscaneados}`,
          conferencia_id: conferencia.id,
          transporte_id: conferencia.transporte?.id,
          criador_id: conferencia.operador?.id,
          data_ocorrencia: new Date(),
          impacto_financeiro: impactoFinanceiro,
          status: 'ABERTA'
        }, { transaction });
      }

      if (conferencia.tipo === 'INBOUND') {
        await this.processarConferenciaInbound(conferencia, transaction);
        
        if (conferencia.transporte && !conferencia.transporte.rota_id) {
          const rota = await db.Rota.create({
            id_motorista: conferencia.transporte.motorista_id,
            cluster: 'INBOUND',
            numero_paradas: 1, 
            distancia_total_km: await this.calcularDistancia(
              conferencia.transporte.hubOrigem,
              conferencia.transporte.hubDestino
            ),
            status_rota: 'FINALIZADA',
            data_criacao: new Date(),
            data_finalizacao: new Date()
          }, { transaction });

          conferencia.transporte.rota_id = rota.id;
          conferencia.transporte.status_transporte = 'RECEBIDO';
          await conferencia.transporte.save({ transaction });

          await db.Parada.create({
            id_rota: rota.id,
            id_pedido: null, 
            ordem_entrega: 1,
            gaiola_codigo: 'RECEBIMENTO',
            status_parada: 'ENTREGUE',
            data_chegada: new Date(),
            data_saida: new Date()
          }, { transaction });
        }

      } else if (conferencia.tipo === 'OUTBOUND') {
        await this.processarConferenciaOutbound(conferencia, transaction);
      }

      await transaction.commit();
      return await db.Conferencia.findByPk(id, {
        include: [
          { 
            model: db.Transporte, 
            as: 'transporte',
            include: [
              { model: db.Rota, as: 'rota' }
            ]
          },
          { model: db.Pedidos, as: 'pedidos' }
        ]
      });
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw new Error(`Erro ao concluir conferência: ${error.message}`);
    }
  }

  async updateConferencia(id, dados) {
    const transaction = await db.sequelize.transaction();

    try {
      const conferencia = await db.Conferencia.findByPk(id);
      if (!conferencia) {
        throw new Error('Conferência não encontrada');
      }

      const camposPermitidos = ['nome_estacao', 'status', 'observacoes'];
      const dadosAtualizacao = {};
      
      camposPermitidos.forEach(campo => {
        if (dados[campo] !== undefined) {
          dadosAtualizacao[campo] = dados[campo];
        }
      });

      await db.Conferencia.update(dadosAtualizacao, {
        where: { id },
        transaction
      });

      await transaction.commit();
      return await this.getConferenciaCompleta(id);
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw new Error(`Erro ao atualizar conferência: ${error.message}`);
    }
  }

  async removerPedido(conferenciaId, pedidoId) {
    const transaction = await db.sequelize.transaction();

    try {
      const conferencia = await db.Conferencia.findByPk(conferenciaId);
      if (!conferencia) throw new Error('Conferência não encontrada');

      const pedido = await db.Pedidos.findByPk(pedidoId);
      if (!pedido) throw new Error('Pedido não encontrado');

      if (pedido.conferencia_id !== parseInt(conferenciaId)) {
        throw new Error('Pedido não pertence a esta conferência');
      }

      pedido.conferencia_id = null;
      pedido.status = 'PENDENTE'; 
      await pedido.save({ transaction });

      await this.atualizarEstatisticasConferencia(conferenciaId, transaction);

      await transaction.commit();
      return { success: true, pedido };
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  async getEstatisticas(conferenciaId) {
    try {
      const conferencia = await db.Conferencia.findByPk(conferenciaId, {
        include: [
          {
            model: db.Pedidos,
            as: 'pedidos',
            attributes: ['id', 'status']
          }
        ]
      });

      if (!conferencia) {
        throw new Error('Conferência não encontrada');
      }

      const estatisticas = {
        totalPedidos: conferencia.pedidos.length,
        pedidosValidados: conferencia.pedidos.filter(p => p.status === 'VALIDADO').length,
        pedidosPendentes: conferencia.pedidos.filter(p => p.status === 'AGUARDANDO_CONFERENCIA').length,
        pedidosCancelados: conferencia.pedidos.filter(p => p.status === 'CANCELADO').length,
        percentualConclusao: conferencia.percentual_validacao || 0
      };

      return estatisticas;
    } catch (error) {
      throw new Error(`Erro ao obter estatísticas: ${error.message}`);
    }
  }

  async calcularDistancia(hubOrigem, hubDestino) {
    if (!hubOrigem || !hubDestino) return 0;
    
    const distancia = Math.random() * 100 + 50; // Entre 50 e 150 km
    return parseFloat(distancia.toFixed(2));
  }

  async processarConferenciaInbound(conferencia, transaction) {
    try {
      for (const pedido of conferencia.pedidos) {
        if (pedido.status === 'VALIDADO') {
          pedido.status = 'EM_ESTOQUE';
          await pedido.save({ transaction });

          await db.Estoque.create({
            id_produto: pedido.produto_id,
            id_pedido: pedido.id,
            hub_id: conferencia.transporte?.hub_destino_id,
            quantidade: 1,
            localizacao: 'Área de Recebimento',
            data_entrada: new Date()
          }, { transaction });

          await db.Rastreamento.create({
            id_pedido: pedido.id,
            status_atual: 'STOCKED',
            data_status: new Date(),
            localizacao: 'Estoque - ' + (conferencia.transporte?.hubDestino?.nome || 'Hub Principal')
          }, { transaction });
        }
      }

      const pedidosValidados = conferencia.pedidos.filter(p => p.status === 'VALIDADO').length;
      await conferencia.update({
        pedidos_escaneados: pedidosValidados,
        percentual_validacao: conferencia.total_pedidos_finais > 0 ? 
          (pedidosValidados / conferencia.total_pedidos_finais) * 100 : 0
      }, { transaction });

    } catch (error) {
      throw new Error(`Erro no processamento INBOUND: ${error.message}`);
    }
  }

  async processarConferenciaOutbound(conferencia, transaction) {
    try {
      const { transporte, operador } = conferencia;

      if (!transporte) {
        throw new Error('Transporte não encontrado para a conferência OUTBOUND');
      }

      if (!transporte.motorista) {
        await this.criarExcecao({
          tipo: 'NOSHOW',
          gravidade: 'ALTA',
          titulo: `Transporte sem motorista - ${transporte.numero_transporte}`,
          descricao: `Transporte pronto para expedição mas sem motorista atribuído`,
          transporte_id: transporte.id,
          criador_id: operador.id,
          data_ocorrencia: new Date(),
          impacto_financeiro: this.calcularImpactoAtrasoTransporte(),
          models: db,
          transaction
        });
        return;
      }

      let rota;
      if (transporte.rota_id) {
        rota = await db.Rota.findByPk(transporte.rota_id, { transaction });
      } else {
        rota = await db.Rota.create({
          id_motorista: transporte.motorista_id,
          cluster: 'OUTBOUND',
          status_rota: 'CRIADA',
          data_criacao: new Date()
        }, { transaction });

        transporte.rota_id = rota.id;
        await transporte.save({ transaction });
      }

      let ordem = 1;
      for (const pedido of conferencia.pedidos) {
        if (pedido.status === 'VALIDADO') {
          pedido.status = 'EM_ROTA';
          await pedido.save({ transaction });

          await db.Rastreamento.create({
            id_pedido: pedido.id,
            status_atual: 'EM_ROTA',
            data_status: new Date(),
            localizacao: 'Em transporte'
          }, { transaction });

          await db.Parada.create({
            id_rota: rota.id,
            id_pedido: pedido.id,
            ordem_entrega: ordem++,
            status_parada: 'PENDENTE'
          }, { transaction });
        }
      }

      await rota.update({
        numero_paradas: ordem - 1,
        status_rota: 'EM_ANDAMENTO'
      }, { transaction });

      transporte.status_transporte = 'EM_TRANSPORTE';
      await transporte.save({ transaction });

    } catch (error) {
      throw new Error(`Erro no processamento OUTBOUND: ${error.message}`);
    }
  }

  async verificarAvariaPedido(idPedido, transaction) {
    return Math.random() < 0.05; // 5% de chance de avaria
  }

  async calcularValorPedido(idPedido, transaction) {
    return 150; // Valor médio de R$ 150 por pedido
  }

  calcularImpactoAtrasoTransporte() {
    return 500; // Custo fixo de R$ 500 por atraso
  }

  calcularImpactoDivergencia(totalEsperado, totalConferido) {
    const diferenca = Math.abs(totalEsperado - totalConferido);
    const custoPorDivergencia = 100;
    return diferenca * custoPorDivergencia;
  }

  async criarExcecao({
    tipo,
    gravidade,
    titulo,
    descricao,
    id_pedido,
    transporte_id,
    recebimento_id,
    criador_id,
    data_ocorrencia,
    impacto_financeiro = 0,
    models,
    transaction
  }) {
    try {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      const numeroOcorrencia = `EXC${timestamp}${random}`;

      const excecao = await models.Excecao.create({
        numero_ocorrencia: numeroOcorrencia,
        tipo,
        gravidade,
        titulo,
        descricao,
        pedido_id: id_pedido,
        transporte_id,
        recebimento_id,
        criador_id,
        data_ocorrencia: data_ocorrencia || new Date(),
        impacto_financeiro,
        status: 'ABERTA'
      }, { transaction });

      const historico = [{
        timestamp: new Date(),
        acao: 'CRIACAO',
        descricao: 'Exceção criada automaticamente pelo sistema',
        usuario_id: criador_id
      }];

      await excecao.update({ historico }, { transaction });

      return excecao;
    } catch (error) {
      console.error('Erro ao criar exceção:', error);
      throw error;
    }
  }
}

module.exports = ConferenciaServices;