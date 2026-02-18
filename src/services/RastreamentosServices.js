const Services = require('./Services');
const db = require('../models');
const { Op } = require('sequelize');

class RastreamentosServices extends Services {
  constructor() {
    super('Rastreamentos');
    this._maxRetries = 3;
  }

  /**
   * Verifica profundamente o estado da transação
   */
  async verificarTransacaoDetalhada(transaction) {
    if (!transaction) {
      console.error('[RastreamentosServices] Transação é nula');
      return false;
    }

    console.debug('[RastreamentosServices] Verificando estado da transação', {
      transactionId: transaction.id,
      finished: transaction.finished,
      parent: transaction.parent?.id
    });

    try {
      if (transaction.finished) {
        const estado = transaction.finished.toUpperCase();
        console.error(`[RastreamentosServices] Transação já finalizada: ${estado}`);
        return false;
      }

      const result = await db.sequelize.query('SELECT 1 as teste_transacao', {
        transaction,
        type: db.sequelize.QueryTypes.SELECT
      });

      console.debug('[RastreamentosServices] Transação ativa e válida');
      return true;
    } catch (error) {
      console.error('[RastreamentosServices] ERRO ao verificar transação:', {
        message: error.message,
        code: error.parent?.code,
        sqlState: error.parent?.sqlState
      });

      const isAborted = error.message.includes('aborted') || 
                       error.message.includes('25P02') ||
                       error.parent?.code === '25P02';

      if (isAborted) {
        console.error('[RastreamentosServices] TRANSAÇÃO ABORTADA DETECTADA');
        return false;
      }

      return false;
    }
  }

  /**
   * Executa função com retry para deadlocks e transações abortadas
   */
  async withRetryTransaction(fn, maxRetries = 3) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      const transaction = await db.sequelize.transaction({
        isolationLevel: db.sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
        timeout: 30000
      });
      
      console.log(`[RastreamentosServices] [Retry ${i + 1}/${maxRetries}] Iniciando transação`);

      try {
        const result = await fn(transaction);
        await transaction.commit();
        console.log(`[RastreamentosServices] [Retry ${i + 1}/${maxRetries}] Transação commitada com sucesso`);
        return result;
      } catch (error) {
        console.error(`[RastreamentosServices] [Retry ${i + 1}/${maxRetries}] Erro:`, error.message);
        
        await transaction.rollback();
        lastError = error;
        
        const shouldRetry = error.message.includes('deadlock') || 
                           error.message.includes('aborted') ||
                           error.message.includes('25P02') ||
                           error.parent?.code === '40P01';
        
        if (shouldRetry && i < maxRetries - 1) {
          console.log(`[RastreamentosServices] [Retry ${i + 1}/${maxRetries}] Tentando novamente...`);
          await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
          continue;
        }
        break;
      }
    }
    
    console.error('[RastreamentosServices] Máximo de retries atingido');
    throw lastError;
  }

  /**
   * Mapeia status do pedido para status de rastreamento
   */
  _mapPedidoStatusToRastreamentoStatus(pedidoStatus) {
    const map = {
      'PENDENTE': 'NO_HUB',
      'PROCESSANDO': 'NO_HUB',
      'AGUARDANDO_CONFERENCIA': 'NO_HUB',
      'AGUARDANDO_SEPARACAO': 'NO_HUB',
      'VALIDADO': 'NO_HUB',
      'EM_ESTOQUE': 'NO_HUB',
      'EM_ROTA': 'EM_ROTA',
      'ENTREGUE': 'ENTREGUE',
      'CANCELADO': 'EXCECAO',
      'SEPARADO': 'SEPARADO',
      'COLETADO': 'COLETADO'
    };
    
    const statusMapeado = map[pedidoStatus] || 'NO_HUB';
    console.debug('[RastreamentosServices] Mapeamento de status:', {
      pedidoStatus,
      rastreamentoStatus: statusMapeado
    });
    
    return statusMapeado;
  }

  /**
   * Valida status de rastreamento contra ENUM do modelo
   */
  _validarStatusRastreamento(status) {
    const statusValidos = ['NO_HUB', 'COLETADO', 'SEPARADO', 'EM_ROTA', 'ENTREGUE', 'EXCECAO'];
    
    if (!statusValidos.includes(status)) {
      console.warn('[RastreamentosServices] Status de rastreamento inválido:', {
        status,
        statusValidos
      });
      
      // Mapear automaticamente para o mais próximo
      if (status === 'PENDENTE') return 'NO_HUB';
      if (status === 'PROCESSANDO') return 'NO_HUB';
      if (status === 'AGUARDANDO_COLETA') return 'COLETADO';
      
      return 'NO_HUB';
    }
    
    return status;
  }

  /**
   * Cria evento de rastreamento com tratamento robusto
   */
  async criarEvento(pedido_id, status_atual, localizacao = 'Sistema', options = {}) {
    console.log('[RastreamentosServices] INÍCIO: criarEvento', {
      pedido_id,
      status_atual,
      localizacao,
      transactionId: options.transaction?.id,
      usuario_id: options.usuario_id,
      timestamp: new Date().toISOString()
    });

    const externalTx = options.transaction;
    let transaction;
    const createdHere = !externalTx;

    try {
      // Configurar transação
      if (!externalTx) {
        console.log('[RastreamentosServices] Criando nova transação para evento');
        transaction = await db.sequelize.transaction({
          isolationLevel: db.sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
          timeout: 30000
        });
        console.log('[RastreamentosServices] Nova transação criada, ID:', transaction.id);
      } else {
        transaction = externalTx;
        console.log('[RastreamentosServices] Usando transação externa, ID:', transaction.id);
        
        const transacaoValida = await this.verificarTransacaoDetalhada(transaction);
        if (!transacaoValida) {
          console.error('[RastreamentosServices] Transação externa fornecida está inválida ou abortada');
          throw new Error('Transação externa inválida. Não é possível criar evento de rastreamento.');
        }
      }

      // Validar status
      const statusValidado = this._validarStatusRastreamento(status_atual);
      console.log('[RastreamentosServices] Status validado:', {
        original: status_atual,
        validado: statusValidado
      });

      // Verificar se pedido existe
      console.log('[RastreamentosServices] Verificando existência do pedido:', pedido_id);
      const pedido = await db.Pedidos.findByPk(pedido_id, {
        transaction,
        attributes: ['id', 'codigo_pedido', 'status']
      });

      if (!pedido) {
        console.error('[RastreamentosServices] Pedido não encontrado:', pedido_id);
        throw new Error(`Pedido ${pedido_id} não encontrado`);
      }

      console.log('[RastreamentosServices] Pedido encontrado:', {
        id: pedido.id,
        codigo: pedido.codigo_pedido,
        status: pedido.status
      });

      // Criar evento de rastreamento
      const eventoData = {
        pedido_id,
        status_atual: statusValidado,
        data_status: new Date(),
        localizacao: localizacao || 'Sistema'
      };

      console.log('[RastreamentosServices] Criando evento de rastreamento:', eventoData);
      const evento = await db.Rastreamentos.create(eventoData, { 
        transaction,
        logging: (sql) => console.debug('[RastreamentosServices] SQL create evento:', sql)
      });

      // Atualizar status do pedido se necessário
      const statusDoPedidoAtual = pedido.status;
      const statusMapeadoParaPedido = this._mapRastreamentoStatusToPedidoStatus(statusValidado);
      
      if (statusMapeadoParaPedido && statusMapeadoParaPedido !== statusDoPedidoAtual) {
        console.log('[RastreamentosServices] Atualizando status do pedido:', {
          pedido_id,
          de: statusDoPedidoAtual,
          para: statusMapeadoParaPedido
        });
        
        await pedido.update({
          status: statusMapeadoParaPedido,
          updatedAt: new Date()
        }, { transaction });
        
        console.log('[RastreamentosServices] Status do pedido atualizado com sucesso');
      }

      // Se transação foi criada aqui, commitar
      if (createdHere) {
        console.log('[RastreamentosServices] Commit da transação...');
        try {
          await transaction.commit();
          console.log('[RastreamentosServices] Transação commitada com sucesso');
        } catch (commitError) {
          console.error('[RastreamentosServices] ERRO ao fazer commit:', commitError.message);
          throw commitError;
        }
      }

      console.log('[RastreamentosServices] FIM: criarEvento - sucesso', {
        eventoId: evento.id,
        pedido_id,
        status_atual: statusValidado
      });
      
      return {
        success: true,
        message: 'Evento de rastreamento criado com sucesso',
        evento,
        pedido: {
          id: pedido.id,
          codigo_pedido: pedido.codigo_pedido,
          status: pedido.status
        }
      };

    } catch (error) {
      console.error('[RastreamentosServices] ERRO CRÍTICO em criarEvento:', {
        message: error.message,
        pedido_id,
        status_atual,
        createdHere,
        transactionId: transaction?.id,
        transactionStatus: transaction?.finished || 'unknown',
        sql: error.parent?.sql,
        code: error.parent?.code,
        constraint: error.parent?.constraint
      });

      // Verificar se é erro de ENUM inválido
      if (error.message.includes('invalid input value for enum') || 
          error.parent?.code === '22P02') {
        console.error('[RastreamentosServices] ERRO DE ENUM INVÁLIDO DETECTADO');
        
        // Tentar novamente com status padrão
        if (createdHere && transaction && !transaction.finished) {
          await transaction.rollback();
          console.log('[RastreamentosServices] Rollback realizado devido a ENUM inválido');
          
          // Retry com status validado
          console.log('[RastreamentosServices] Tentando novamente com status validado...');
          const statusValidado = this._validarStatusRastreamento(status_atual);
          
          if (statusValidado !== status_atual) {
            console.log('[RastreamentosServices] Retry com status corrigido:', statusValidado);
            return this.criarEvento(pedido_id, statusValidado, localizacao, options);
          }
        }
      }

      if (createdHere && transaction && !transaction.finished) {
        console.log('[RastreamentosServices] Tentando rollback da transação...');
        try {
          await transaction.rollback();
          console.log('[RastreamentosServices] Rollback realizado com sucesso');
        } catch (rollbackError) {
          console.error('[RastreamentosServices] ERRO ao fazer rollback:', rollbackError.message);
        }
      } else if (externalTx) {
        console.warn('[RastreamentosServices] Transação externa - não fazendo rollback');
      }

      if (error.message.includes('aborted') || error.message.includes('25P02')) {
        throw new Error(`ERRO DE TRANSAÇÃO ABORTADA: Evento de rastreamento não pôde ser criado. Detalhes: ${error.message}`);
      }

      throw new Error(`Erro ao criar evento de rastreamento: ${error.message}`);
    }
  }

  /**
   * Mapeia status de rastreamento para status do pedido
   */
  _mapRastreamentoStatusToPedidoStatus(rastreamentoStatus) {
    const map = {
      'NO_HUB': 'PENDENTE',
      'COLETADO': 'PROCESSANDO',
      'SEPARADO': 'AGUARDANDO_COLETA',
      'EM_ROTA': 'EM_ROTA',
      'ENTREGUE': 'ENTREGUE',
      'EXCECAO': 'CANCELADO'
    };
    
    return map[rastreamentoStatus];
  }

  /**
   * Busca todos os rastreamentos com filtros
   */
  async getAll(filters = {}) {
    console.log('[RastreamentosServices] INÍCIO: getAll', { filters });
    
    const {
      page = 1,
      size = 10,
      pedido_id,
      status_atual,
      data_inicio,
      data_fim,
      search,
      orderBy = 'data_status',
      orderDirection = 'DESC'
    } = filters;

    const offset = (page - 1) * size;
    const limit = parseInt(size, 10);

    let whereClause = {};

    if (pedido_id) {
      whereClause.pedido_id = Number(pedido_id);
      console.log('[RastreamentosServices] Filtrando por pedido_id:', pedido_id);
    }

    if (status_atual) {
      const statusValidado = this._validarStatusRastreamento(status_atual);
      whereClause.status_atual = statusValidado;
      console.log('[RastreamentosServices] Filtrando por status_atual:', statusValidado);
    }

    if (data_inicio || data_fim) {
      whereClause.data_status = {};
      if (data_inicio) {
        whereClause.data_status[Op.gte] = new Date(data_inicio);
        console.log('[RastreamentosServices] Data início:', data_inicio);
      }
      if (data_fim) {
        const endDate = new Date(data_fim);
        endDate.setHours(23, 59, 59, 999);
        whereClause.data_status[Op.lte] = endDate;
        console.log('[RastreamentosServices] Data fim:', data_fim);
      }
    }

    if (search) {
      console.log('[RastreamentosServices] Buscando por termo:', search);
      
      const pedidosMatches = await db.Pedidos.findAll({
        where: {
          [Op.or]: [
            { codigo_pedido: { [Op.like]: `%${search}%` } },
            { id: isNaN(Number(search)) ? null : Number(search) }
          ]
        },
        attributes: ['id'],
        raw: true
      });

      const pedidoIds = pedidosMatches.map(p => Number(p.id));
      
      if (pedidoIds.length > 0) {
        whereClause.pedido_id = { [Op.in]: pedidoIds };
        console.log('[RastreamentosServices] Pedidos encontrados para busca:', pedidoIds.length);
      } else if (Object.keys(whereClause).length === 0) {
        // Se não houver outros filtros e nenhum pedido encontrado, retornar vazio
        console.log('[RastreamentosServices] Nenhum pedido encontrado para busca');
        return {
          totalItems: 0,
          totalPages: 0,
          currentPage: parseInt(page, 10),
          rastreamentos: []
        };
      }
    }

    console.log('[RastreamentosServices] Executando consulta com filtros:', whereClause);
    
    try {
      const { count, rows: rastreamentos } = await db.Rastreamentos.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: db.Pedidos,
            as: 'Pedido',
            attributes: ['id', 'codigo_pedido', 'status'],
            required: true
          }
        ],
        distinct: true,
        offset,
        limit,
        order: [[orderBy, orderDirection]],
        subQuery: false,
        logging: (sql) => console.debug('[RastreamentosServices] SQL findAndCountAll:', sql)
      });

      console.log('[RastreamentosServices] FIM: getAll - encontrados', count, 'rastreamentos');
      return {
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page, 10),
        rastreamentos
      };
    } catch (error) {
      console.error('[RastreamentosServices] ERRO em getAll:', error.message);
      throw new Error(`Erro ao buscar rastreamentos: ${error.message}`);
    }
  }

  /**
   * Busca rastreamento por ID
   */
  async getById(id, options = {}) {
    console.log('[RastreamentosServices] INÍCIO: getById', { 
      id,
      transactionId: options.transaction?.id 
    });

    const transaction = options.transaction;

    try {
      const rastreamento = await db.Rastreamentos.findByPk(id, {
        include: [
          {
            model: db.Pedidos,
            as: 'Pedido',
            include: [
              {
                model: db.Clientes,
                as: 'clientes',
                attributes: ['id', 'nome', 'cpf', 'email']
              },
              {
                model: db.Enderecos,
                as: 'enderecos',
                attributes: ['id', 'rua', 'numero', 'cidade', 'estado', 'cep']
              }
            ]
          }
        ],
        transaction,
        logging: (sql) => console.debug('[RastreamentosServices] SQL find by id:', sql)
      });

      if (!rastreamento) {
        console.error('[RastreamentosServices] Rastreamento não encontrado:', id);
        throw new Error('Rastreamento não encontrado');
      }

      console.log('[RastreamentosServices] FIM: getById - rastreamento encontrado');
      return rastreamento;
    } catch (error) {
      console.error('[RastreamentosServices] ERRO em getById:', error.message);
      throw new Error(`Erro ao buscar rastreamento ${id}: ${error.message}`);
    }
  }

  /**
   * Busca rastreamentos por pedido ID
   */
  async getByPedidoId(pedidoId, options = {}) {
    console.log('[RastreamentosServices] INÍCIO: getByPedidoId', { 
      pedidoId,
      transactionId: options.transaction?.id 
    });

    const transaction = options.transaction;

    try {
      const rastreamentos = await db.Rastreamentos.findAll({
        where: { pedido_id: Number(pedidoId) },
        include: [
          {
            model: db.Pedidos,
            as: 'Pedido',
            attributes: ['id', 'codigo_pedido', 'status']
          }
        ],
        order: [['data_status', 'DESC']],
        transaction,
        logging: (sql) => console.debug('[RastreamentosServices] SQL find by pedido:', sql)
      });

      console.log('[RastreamentosServices] FIM: getByPedidoId - encontrados', rastreamentos.length, 'rastreamentos');
      return rastreamentos;
    } catch (error) {
      console.error('[RastreamentosServices] ERRO em getByPedidoId:', error.message);
      throw new Error(`Erro ao buscar rastreamentos do pedido ${pedidoId}: ${error.message}`);
    }
  }

  /**
   * Busca histórico completo de um pedido
   */
  async getHistoricoCompletoPedido(pedidoId, options = {}) {
    console.log('[RastreamentosServices] INÍCIO: getHistoricoCompletoPedido', { 
      pedidoId,
      transactionId: options.transaction?.id 
    });

    try {
      const rastreamentos = await this.getByPedidoId(pedidoId, options);
      
      const historicoFormatado = rastreamentos.map(r => ({
        id: r.id,
        status: r.status_atual,
        data: r.data_status,
        localizacao: r.localizacao,
        pedido: r.Pedido ? {
          id: r.Pedido.id,
          codigo_pedido: r.Pedido.codigo_pedido,
          status: r.Pedido.status
        } : null
      }));

      console.log('[RastreamentosServices] FIM: getHistoricoCompletoPedido - histórico formatado');
      return historicoFormatado;
    } catch (error) {
      console.error('[RastreamentosServices] ERRO em getHistoricoCompletoPedido:', error.message);
      throw new Error(`Erro ao buscar histórico do pedido ${pedidoId}: ${error.message}`);
    }
  }

  /**
   * Busca último status de um pedido
   */
  async getUltimoStatusPedido(pedidoId, options = {}) {
    console.log('[RastreamentosServices] INÍCIO: getUltimoStatusPedido', { 
      pedidoId,
      transactionId: options.transaction?.id 
    });

    try {
      const rastreamentos = await this.getByPedidoId(pedidoId, options);
      
      if (rastreamentos.length === 0) {
        console.log('[RastreamentosServices] Nenhum rastreamento encontrado para pedido:', pedidoId);
        return null;
      }

      const ultimoRastreamento = rastreamentos[0];
      console.log('[RastreamentosServices] FIM: getUltimoStatusPedido - último status:', ultimoRastreamento.status_atual);
      
      return {
        status: ultimoRastreamento.status_atual,
        data: ultimoRastreamento.data_status,
        localizacao: ultimoRastreamento.localizacao,
        rastreamento_id: ultimoRastreamento.id
      };
    } catch (error) {
      console.error('[RastreamentosServices] ERRO em getUltimoStatusPedido:', error.message);
      throw new Error(`Erro ao buscar último status do pedido ${pedidoId}: ${error.message}`);
    }
  }

  /**
   * Atualiza rastreamento
   */
  async updateRastreamento(id, updates = {}, options = {}) {
    console.log('[RastreamentosServices] INÍCIO: updateRastreamento', { 
      id,
      updates,
      transactionId: options.transaction?.id,
      usuario_id: options.usuario_id
    });

    const externalTx = options.transaction;
    let transaction;
    const createdHere = !externalTx;

    try {
      // Configurar transação
      if (!externalTx) {
        console.log('[RastreamentosServices] Criando nova transação para atualização');
        transaction = await db.sequelize.transaction();
        console.log('[RastreamentosServices] Nova transação criada, ID:', transaction.id);
      } else {
        transaction = externalTx;
        console.log('[RastreamentosServices] Usando transação externa, ID:', transaction.id);
        
        const transacaoValida = await this.verificarTransacaoDetalhada(transaction);
        if (!transacaoValida) {
          console.error('[RastreamentosServices] Transação externa fornecida está inválida ou abortada');
          throw new Error('Transação externa inválida. Não é possível atualizar rastreamento.');
        }
      }

      // Buscar rastreamento atual
      const rastreamentoAtual = await db.Rastreamentos.findByPk(id, {
        include: [{
          model: db.Pedidos,
          as: 'Pedido',
          attributes: ['id', 'status']
        }],
        transaction
      });

      if (!rastreamentoAtual) {
        console.error('[RastreamentosServices] Rastreamento não encontrado:', id);
        throw new Error('Rastreamento não encontrado');
      }

      // Validar status se estiver sendo atualizado
      if (updates.status_atual) {
        updates.status_atual = this._validarStatusRastreamento(updates.status_atual);
        console.log('[RastreamentosServices] Status validado para atualização:', updates.status_atual);
      }

      // Atualizar rastreamento
      console.log('[RastreamentosServices] Atualizando rastreamento:', id);
      const [nUpdated, updatedRows] = await db.Rastreamentos.update(updates, {
        where: { id },
        transaction,
        returning: true
      });

      if (!nUpdated) {
        console.error('[RastreamentosServices] Nenhuma linha atualizada para rastreamento:', id);
        throw new Error('Rastreamento não encontrado para atualização');
      }

      const rastreamentoAtualizado = updatedRows[0];

      // Atualizar status do pedido se status foi alterado
      if (updates.status_atual && rastreamentoAtual.Pedido) {
        const novoStatusPedido = this._mapRastreamentoStatusToPedidoStatus(updates.status_atual);
        
        if (novoStatusPedido && novoStatusPedido !== rastreamentoAtual.Pedido.status) {
          console.log('[RastreamentosServices] Atualizando status do pedido associado:', {
            pedido_id: rastreamentoAtual.Pedido.id,
            de: rastreamentoAtual.Pedido.status,
            para: novoStatusPedido
          });
          
          await rastreamentoAtual.Pedido.update({
            status: novoStatusPedido,
            updatedAt: new Date()
          }, { transaction });
        }
      }

      // Se transação foi criada aqui, commitar
      if (createdHere) {
        console.log('[RastreamentosServices] Commit da transação de atualização...');
        try {
          await transaction.commit();
          console.log('[RastreamentosServices] Transação commitada com sucesso');
        } catch (commitError) {
          console.error('[RastreamentosServices] ERRO ao fazer commit:', commitError.message);
          throw commitError;
        }
      }

      console.log('[RastreamentosServices] FIM: updateRastreamento - sucesso');
      return rastreamentoAtualizado;

    } catch (error) {
      console.error('[RastreamentosServices] ERRO em updateRastreamento:', {
        message: error.message,
        id,
        createdHere
      });

      if (createdHere && transaction && !transaction.finished) {
        console.log('[RastreamentosServices] Tentando rollback da transação de atualização...');
        try {
          await transaction.rollback();
          console.log('[RastreamentosServices] Rollback realizado com sucesso');
        } catch (rollbackError) {
          console.error('[RastreamentosServices] ERRO ao fazer rollback:', rollbackError.message);
        }
      } else if (externalTx) {
        console.warn('[RastreamentosServices] Transação externa - não fazendo rollback');
      }

      throw error;
    }
  }

  /**
   * Deleta rastreamento
   */
  async deleteRastreamento(id, options = {}) {
    console.log('[RastreamentosServices] INÍCIO: deleteRastreamento', { 
      id,
      transactionId: options.transaction?.id 
    });

    const externalTx = options.transaction;
    let transaction;
    const createdHere = !externalTx;

    try {
      // Configurar transação
      if (!externalTx) {
        console.log('[RastreamentosServices] Criando nova transação para deleção');
        transaction = await db.sequelize.transaction();
        console.log('[RastreamentosServices] Nova transação criada, ID:', transaction.id);
      } else {
        transaction = externalTx;
        console.log('[RastreamentosServices] Usando transação externa, ID:', transaction.id);
        
        const transacaoValida = await this.verificarTransacaoDetalhada(transaction);
        if (!transacaoValida) {
          console.error('[RastreamentosServices] Transação externa fornecida está inválida ou abortada');
          throw new Error('Transação externa inválida. Não é possível deletar rastreamento.');
        }
      }

      // Verificar existência
      const rastreamento = await db.Rastreamentos.findByPk(id, { transaction });
      if (!rastreamento) {
        console.error('[RastreamentosServices] Rastreamento não encontrado:', id);
        throw new Error('Rastreamento não encontrado');
      }

      // Deletar
      console.log('[RastreamentosServices] Deletando rastreamento:', id);
      await rastreamento.destroy({ transaction });

      // Se transação foi criada aqui, commitar
      if (createdHere) {
        console.log('[RastreamentosServices] Commit da transação de deleção...');
        try {
          await transaction.commit();
          console.log('[RastreamentosServices] Transação commitada com sucesso');
        } catch (commitError) {
          console.error('[RastreamentosServices] ERRO ao fazer commit:', commitError.message);
          throw commitError;
        }
      }

      console.log('[RastreamentosServices] FIM: deleteRastreamento - sucesso');
      return { success: true, message: 'Rastreamento deletado com sucesso' };

    } catch (error) {
      console.error('[RastreamentosServices] ERRO em deleteRastreamento:', {
        message: error.message,
        id,
        createdHere
      });

      if (createdHere && transaction && !transaction.finished) {
        console.log('[RastreamentosServices] Tentando rollback da transação de deleção...');
        try {
          await transaction.rollback();
          console.log('[RastreamentosServices] Rollback realizado com sucesso');
        } catch (rollbackError) {
          console.error('[RastreamentosServices] ERRO ao fazer rollback:', rollbackError.message);
        }
      } else if (externalTx) {
        console.warn('[RastreamentosServices] Transação externa - não fazendo rollback');
      }

      throw error;
    }
  }

  /**
   * Cria múltiplos eventos de rastreamento em lote
   */
  async criarEventosEmLote(eventos = [], options = {}) {
    console.log('[RastreamentosServices] INÍCIO: criarEventosEmLote', {
      quantidadeEventos: eventos.length,
      transactionId: options.transaction?.id,
      usuario_id: options.usuario_id
    });

    const externalTx = options.transaction;
    let transaction;
    const createdHere = !externalTx;

    try {
      // Configurar transação
      if (!externalTx) {
        console.log('[RastreamentosServices] Criando nova transação para lote');
        transaction = await db.sequelize.transaction();
        console.log('[RastreamentosServices] Nova transação criada, ID:', transaction.id);
      } else {
        transaction = externalTx;
        console.log('[RastreamentosServices] Usando transação externa, ID:', transaction.id);
        
        const transacaoValida = await this.verificarTransacaoDetalhada(transaction);
        if (!transacaoValida) {
          console.error('[RastreamentosServices] Transação externa fornecida está inválida ou abortada');
          throw new Error('Transação externa inválida. Não é possível criar eventos em lote.');
        }
      }

      // Validar e preparar eventos
      const eventosPreparados = eventos.map(evento => {
        const statusValidado = this._validarStatusRastreamento(evento.status_atual);
        
        return {
          pedido_id: Number(evento.pedido_id),
          status_atual: statusValidado,
          data_status: new Date(),
          localizacao: evento.localizacao || 'Sistema',
          createdAt: new Date(),
          updatedAt: new Date()
        };
      });

      console.log('[RastreamentosServices] Eventos preparados:', eventosPreparados.length);

      // Criar em lote
      const eventosCriados = await db.Rastreamentos.bulkCreate(eventosPreparados, { 
        transaction,
        returning: true,
        logging: (sql) => console.debug('[RastreamentosServices] SQL bulkCreate eventos:', sql)
      });

      // Atualizar status dos pedidos associados
      const pedidoIds = [...new Set(eventos.map(e => Number(e.pedido_id)))];
      
      for (const pedidoId of pedidoIds) {
        const eventosDoPedido = eventos.filter(e => Number(e.pedido_id) === pedidoId);
        const ultimoEvento = eventosDoPedido[eventosDoPedido.length - 1];
        
        if (ultimoEvento) {
          const pedido = await db.Pedidos.findByPk(pedidoId, { transaction });
          if (pedido) {
            const novoStatusPedido = this._mapRastreamentoStatusToPedidoStatus(
              this._validarStatusRastreamento(ultimoEvento.status_atual)
            );
            
            if (novoStatusPedido && novoStatusPedido !== pedido.status) {
              console.log('[RastreamentosServices] Atualizando status do pedido em lote:', {
                pedido_id: pedidoId,
                de: pedido.status,
                para: novoStatusPedido
              });
              
              await pedido.update({
                status: novoStatusPedido,
                updatedAt: new Date()
              }, { transaction });
            }
          }
        }
      }

      // Se transação foi criada aqui, commitar
      if (createdHere) {
        console.log('[RastreamentosServices] Commit da transação de lote...');
        try {
          await transaction.commit();
          console.log('[RastreamentosServices] Transação commitada com sucesso');
        } catch (commitError) {
          console.error('[RastreamentosServices] ERRO ao fazer commit:', commitError.message);
          throw commitError;
        }
      }

      console.log('[RastreamentosServices] FIM: criarEventosEmLote - sucesso', {
        eventosCriados: eventosCriados.length
      });
      
      return {
        success: true,
        message: `${eventosCriados.length} evento(s) de rastreamento criado(s) com sucesso`,
        eventos: eventosCriados
      };

    } catch (error) {
      console.error('[RastreamentosServices] ERRO em criarEventosEmLote:', {
        message: error.message,
        quantidadeEventos: eventos.length,
        createdHere
      });

      if (createdHere && transaction && !transaction.finished) {
        console.log('[RastreamentosServices] Tentando rollback da transação de lote...');
        try {
          await transaction.rollback();
          console.log('[RastreamentosServices] Rollback realizado com sucesso');
        } catch (rollbackError) {
          console.error('[RastreamentosServices] ERRO ao fazer rollback:', rollbackError.message);
        }
      } else if (externalTx) {
        console.warn('[RastreamentosServices] Transação externa - não fazendo rollback');
      }

      throw error;
    }
  }

  /**
   * Busca estatísticas de rastreamento
   */
  async getEstatisticas(filters = {}) {
    console.log('[RastreamentosServices] INÍCIO: getEstatisticas', { filters });

    try {
      const { data_inicio, data_fim } = filters;

      let whereClause = {};

      if (data_inicio || data_fim) {
        whereClause.data_status = {};
        if (data_inicio) {
          whereClause.data_status[Op.gte] = new Date(data_inicio);
        }
        if (data_fim) {
          const endDate = new Date(data_fim);
          endDate.setHours(23, 59, 59, 999);
          whereClause.data_status[Op.lte] = endDate;
        }
      }

      // Contagem por status
      const contagemPorStatus = await db.Rastreamentos.findAll({
        where: whereClause,
        attributes: [
          'status_atual',
          [db.sequelize.fn('COUNT', db.sequelize.col('status_atual')), 'count']
        ],
        group: ['status_atual'],
        raw: true,
        logging: (sql) => console.debug('[RastreamentosServices] SQL estatísticas por status:', sql)
      });

      // Total de rastreamentos
      const totalRastreamentos = await db.Rastreamentos.count({
        where: whereClause
      });

      // Últimos 7 dias
      const seteDiasAtras = new Date();
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

      const ultimos7Dias = await db.Rastreamentos.count({
        where: {
          ...whereClause,
          data_status: { [Op.gte]: seteDiasAtras }
        }
      });

      // Pedidos com múltiplos rastreamentos
      const pedidosComMultiplosRastreamentos = await db.sequelize.query(`
        SELECT pedido_id, COUNT(*) as quantidade
        FROM "Rastreamentos"
        ${data_inicio || data_fim ? 'WHERE' : ''}
        ${data_inicio ? `data_status >= '${new Date(data_inicio).toISOString()}'` : ''}
        ${data_inicio && data_fim ? ' AND ' : ''}
        ${data_fim ? `data_status <= '${new Date(data_fim).setHours(23, 59, 59, 999)}'` : ''}
        GROUP BY pedido_id
        HAVING COUNT(*) > 1
        ORDER BY quantidade DESC
        LIMIT 10
      `, {
        type: db.sequelize.QueryTypes.SELECT
      });

      const estatisticas = {
        totalRastreamentos,
        contagemPorStatus: contagemPorStatus.reduce((acc, item) => {
          acc[item.status_atual] = parseInt(item.count);
          return acc;
        }, {}),
        ultimos7Dias,
        pedidosComMultiplosRastreamentos: pedidosComMultiplosRastreamentos.map(p => ({
          pedido_id: p.pedido_id,
          quantidadeRastreamentos: parseInt(p.quantidade)
        })),
        periodo: {
          data_inicio: data_inicio || 'não especificado',
          data_fim: data_fim || 'não especificado'
        }
      };

      console.log('[RastreamentosServices] FIM: getEstatisticas - estatísticas calculadas');
      return estatisticas;
    } catch (error) {
      console.error('[RastreamentosServices] ERRO em getEstatisticas:', error.message);
      throw new Error(`Erro ao calcular estatísticas: ${error.message}`);
    }
  }

  /**
   * Cria evento de rastreamento automático baseado no status do pedido
   */
  async criarEventoAutomatico(pedidoId, options = {}) {
    console.log('[RastreamentosServices] INÍCIO: criarEventoAutomatico', { 
      pedidoId,
      transactionId: options.transaction?.id 
    });

    try {
      // Buscar pedido
      const pedido = await db.Pedidos.findByPk(pedidoId, {
        attributes: ['id', 'status', 'codigo_pedido']
      });

      if (!pedido) {
        console.error('[RastreamentosServices] Pedido não encontrado para evento automático:', pedidoId);
        throw new Error(`Pedido ${pedidoId} não encontrado`);
      }

      // Mapear status do pedido para status de rastreamento
      const statusRastreamento = this._mapPedidoStatusToRastreamentoStatus(pedido.status);
      
      // Determinar localização baseada no status
      let localizacao = 'Sistema';
      if (pedido.status === 'EM_ROTA') localizacao = 'Centro de distribuição';
      if (pedido.status === 'ENTREGUE') localizacao = 'Destino final';
      if (pedido.status === 'CANCELADO') localizacao = 'Cancelamento automático';

      // Criar evento
      const resultado = await this.criarEvento(
        pedidoId,
        statusRastreamento,
        localizacao,
        options
      );

      console.log('[RastreamentosServices] FIM: criarEventoAutomatico - sucesso');
      return resultado;
    } catch (error) {
      console.error('[RastreamentosServices] ERRO em criarEventoAutomatico:', error.message);
      throw new Error(`Erro ao criar evento automático para pedido ${pedidoId}: ${error.message}`);
    }
  }
}

module.exports = RastreamentosServices;
