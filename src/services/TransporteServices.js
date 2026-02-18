'use strict';

const Services = require('./Services');
const db = require('../models');
const { Op } = require('sequelize');

class TransporteServices extends Services {
  constructor() {
    super('Transportes');
  }

  // ------------------------------------------------------------------------
  //  LOGS
  // ------------------------------------------------------------------------
  _log(step, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [TransporteServices] ${step}`);
    if (data) {
      console.log(`[${timestamp}] [TransporteServices] Dados:`, 
        typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
    }
  }

  _error(context, error) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [TransporteServices] ERRO em ${context}:`, error.message);
    console.error(`[${timestamp}] [TransporteServices] Stack:`, error.stack);
    if (error.original) {
      console.error(`[${timestamp}] [TransporteServices] Erro original:`, {
        code: error.original.code,
        detail: error.original.detail,
        constraint: error.original.constraint,
        table: error.original.table,
        column: error.original.column
      });
    }
  }

  // ------------------------------------------------------------------------
  //  MAPEAMENTO DE STATUS
  // ------------------------------------------------------------------------
  mapearStatusPedido(statusTransporte) {
    const mapeamento = {
      'CRIADO': 'VALIDADO',
      'EM_TRANSPORTE': 'EM_ROTA',
      'RECEBIDO': 'ENTREGUE',
      'CANCELADO': 'CANCELADO'
    };
    return mapeamento[statusTransporte] || 'VALIDADO';
  }

  // ------------------------------------------------------------------------
  //  VALIDAÇÕES
  // ------------------------------------------------------------------------
  async validarDadosTransporte(dados) {
    const erros = [];

    if (!dados.origem_hub_id && !dados.hub_origem_id) {
      erros.push('Hub de origem é obrigatório');
    }
    if (!dados.destino_hub_id && !dados.hub_destino_id) {
      erros.push('Hub de destino é obrigatório');
    }
    if (!dados.operador_id) {
      erros.push('Operador é obrigatório');
    }

    const hubOrigemId = dados.origem_hub_id || dados.hub_origem_id;
    if (hubOrigemId) {
      const hubOrigem = await db.Hubs.findByPk(hubOrigemId);
      if (!hubOrigem) erros.push(`Hub de origem (ID: ${hubOrigemId}) não encontrado`);
    }

    const hubDestinoId = dados.destino_hub_id || dados.hub_destino_id;
    if (hubDestinoId) {
      const hubDestino = await db.Hubs.findByPk(hubDestinoId);
      if (!hubDestino) erros.push(`Hub de destino (ID: ${hubDestinoId}) não encontrado`);
    }

    if (dados.pedidosIds && dados.pedidosIds.length > 0) {
      const pedidosExistentes = await db.Pedidos.count({
        where: { id: dados.pedidosIds }
      });
      if (pedidosExistentes !== dados.pedidosIds.length) {
        erros.push('Um ou mais pedidos não foram encontrados');
      }
    }

    return erros;
  }

  async _todosPedidosValidados(transporte, transaction = null) {
    const pedidos = await db.Pedidos.findAll({
      where: { transporte_id: transporte.id },
      transaction
    });
    if (pedidos.length === 0) return false;
    return pedidos.every(pedido => pedido.status === 'VALIDADO');
  }

  async _getConferenciaAssociada(transporteId, transaction = null) {
    return db.Conferencias.findOne({
      where: { transporte_id: transporteId },
      transaction
    });
  }

  async validarInicioTransporte(transporte, transaction = null) {
    if (transporte.status_transporte !== 'CRIADO') {
      throw new Error('Só é possível iniciar transportes com status CRIADO');
    }

    const conferencia = await this._getConferenciaAssociada(transporte.id, transaction);
    const todosValidados = await this._todosPedidosValidados(transporte, transaction);

    if (conferencia && conferencia.status === 'CONCLUIDO') {
      return;
    }
    if (todosValidados) {
      return;
    }

    throw new Error('Não é possível iniciar o transporte — conferência não concluída e existem pedidos não validados');
  }

  validarTransicaoStatus(statusAtual, statusNovo) {
    const statusPermitidos = ['CRIADO', 'EM_TRANSPORTE', 'RECEBIDO', 'ENTREGUE', 'CANCELADO'];
    if (!statusPermitidos.includes(statusNovo)) {
      throw new Error(`Status inválido. Permitidos: ${statusPermitidos.join(', ')}`);
    }

    const transicoesValidas = {
      'CRIADO': ['EM_TRANSPORTE', 'CANCELADO'],
      'EM_TRANSPORTE': ['RECEBIDO', 'ENTREGUE', 'CANCELADO'],
      'RECEBIDO': [],
      'ENTREGUE': [],
      'CANCELADO': []
    };

    if (!transicoesValidas[statusAtual].includes(statusNovo)) {
      throw new Error(`Transição de status inválida. Não é possível mudar de ${statusAtual} para ${statusNovo}`);
    }
  }

  // ------------------------------------------------------------------------
  //  CONSULTAS BÁSICAS
  // ------------------------------------------------------------------------
  async getAllTransportes(filters = {}) {
    const { status, tipo, direcao, numero } = filters;
    const where = {};

    if (status) where.status_transporte = status;
    if (tipo) where.tipo_transporte = tipo;
    if (direcao) where.direcao = direcao;
    if (numero) where.numero_transporte = { [Op.like]: `%${numero}%` };

    return await db.Transportes.findAll({
      where,
      include: [
        { model: db.Hubs, as: 'hubOrigem', attributes: ['id', 'nome'] },
        { model: db.Hubs, as: 'hubDestino', attributes: ['id', 'nome'] },
        { model: db.Motoristas, attributes: ['id', 'nome', 'veiculo'] },
        { model: db.Conferencias, as: 'conferencias', attributes: ['id', 'status', 'nome_estacao'] },
        { model: db.Rotas, as: 'rotas' }
      ],
      order: [['data_criacao', 'DESC']]
    });
  }

  async getById(id) {
    return db.Transportes.findByPk(id, {
      include: [
        { model: db.Transferencias, as: 'transferencias' },
        {
          model: db.Rotas, as: 'rotas',
          include: [
            {
              model: db.Paradas, as: 'paradas',
              include: [{ model: db.Pedidos }]
            }
          ]
        },
        { model: db.Pedidos, as: 'pedidos' },
        { model: db.Motoristas },
        { model: db.Conferencias, as: 'conferencias' }
      ]
    });
  }

  async getPedidos(idTransporte) {
    const transporte = await db.Transportes.findByPk(idTransporte, {
      include: [
        {
          model: db.Pedidos,
          as: 'pedidos',
          include: [
            { model: db.Clientes, as: 'clientes' },
            { model: db.Produtos, as: 'produtos' },
            { model: db.Enderecos, as: 'enderecos' }
          ]
        }
      ]
    });
    if (!transporte) throw new Error('Transporte não encontrado');
    return transporte.pedidos;
  }

  async getPedidosParaRota(idTransporte) {
    const transporte = await db.Transportes.findByPk(idTransporte, {
      include: [
        {
          model: db.Pedidos,
          as: 'pedidos',
          where: { status: 'VALIDADO' },
          required: false,
          include: [
            { model: db.Clientes, as: 'clientes', attributes: ['id', 'nome', 'telefone'] },
            { model: db.Produtos, as: 'produtos', attributes: ['id', 'nome', 'peso_kg'] },
            { model: db.Enderecos, as: 'enderecos', attributes: ['id', 'rua', 'bairro', 'cidade', 'estado', 'cep'] }
          ]
        }
      ]
    });
    if (!transporte) throw new Error('Transporte não encontrado');
    return transporte.pedidos || [];
  }

  async getAllWithFilters(options = {}) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'data_criacao',
      sortOrder = 'DESC',
      filters = {}
    } = options;

    const offset = (page - 1) * limit;
    const whereConditions = {};

    if (filters.status_transporte) whereConditions.status_transporte = filters.status_transporte;
    if (filters.direcao) whereConditions.direcao = filters.direcao;
    if (filters.data_inicio && filters.data_fim) {
      whereConditions.data_criacao = {
        [Op.between]: [new Date(filters.data_inicio), new Date(filters.data_fim)]
      };
    }
    if (filters.numero_transporte) {
      whereConditions.numero_transporte = { [Op.iLike]: `%${filters.numero_transporte}%` };
    }

    try {
      const { count, rows } = await db.Transportes.findAndCountAll({
        where: whereConditions,
        include: [
          { model: db.Transferencias, as: 'transferencias' },
          { model: db.Motoristas, as: 'motorista', attributes: ['nome'] }
        ],
        order: [[sortBy, sortOrder]],
        limit: parseInt(limit),
        offset,
        distinct: true
      });

      return {
        transportes: rows,
        total: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit
      };
    } catch (error) {
      this._error('getAllWithFilters', error);
      throw new Error(`Erro ao buscar transportes: ${error.message}`);
    }
  }

  async searchTransportes(query, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    try {
      const { count, rows } = await db.Transportes.findAndCountAll({
        where: {
          [Op.or]: [
            { id: { [Op.eq]: !isNaN(query) ? parseInt(query) : 0 } },
            { numero_transporte: { [Op.iLike]: `%${query}%` } },
            { nome_transportador: { [Op.iLike]: `%${query}%` } },
            { placa_veiculo: { [Op.iLike]: `%${query}%` } },
            { cnpj_transportador: { [Op.iLike]: `%${query}%` } }
          ]
        },
        include: [
          { model: db.Transferencias, as: 'transferencias' },
          { model: db.Motoristas, as: 'motorista', attributes: ['nome'] }
        ],
        order: [['data_criacao', 'DESC']],
        limit: parseInt(limit),
        offset,
        distinct: true
      });

      return {
        transportes: rows,
        total: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit
      };
    } catch (error) {
      this._error('searchTransportes', error);
      throw new Error(`Erro na busca de transportes: ${error.message}`);
    }
  }

  // ------------------------------------------------------------------------
  //  CRIAÇÃO
  // ------------------------------------------------------------------------
  async createTransporteTeste(dados) {
    try {
      if (!dados.hub_origem_id) throw new Error('hub_origem_id é obrigatório');
      if (!dados.hub_destino_id) throw new Error('hub_destino_id é obrigatório');
      if (!dados.operador_id) throw new Error('operador_id é obrigatório');

      const payload = {
        numero_transporte: `TEST-${Date.now()}`,
        tipo_transporte: dados.tipo_transporte || 'TO',
        hub_origem_id: dados.hub_origem_id,
        hub_destino_id: dados.hub_destino_id,
        motorista_id: dados.motorista_id || null,
        operador_id: dados.operador_id,
        status_transporte: 'CRIADO',
        data_criacao: new Date(),
        direcao: dados.direcao || 'OUTBOUND',
        ...(dados.nome_transportador && { nome_transportador: dados.nome_transportador }),
        ...(dados.cnpj_transportador && { cnpj_transportador: dados.cnpj_transportador }),
      };

      const transporte = await this.createRegister(payload);
      this._log('Transporte de teste criado com sucesso', transporte.id);
      return transporte;
    } catch (error) {
      this._error('createTransporteTeste', error);
      throw new Error(`Erro ao criar transporte de teste: ${error.message}`);
    }
  }

  async createSimples(dados) {
    const transaction = await db.sequelize.transaction();
    let rollbackAttempted = false;
    let originalError = null;

    try {
      this._log('Criando transporte simples', dados);

      if (!dados.hub_origem_id) throw new Error('Hub origem é obrigatório');
      if (!dados.hub_destino_id) throw new Error('Hub destino é obrigatório');

      const numeroTransporte = `TR-SIMPLE-${Date.now()}`;

      const transporte = await db.Transportes.create({
        numero_transporte: numeroTransporte,
        tipo_transporte: dados.tipo_transporte || 'TO',
        hub_origem_id: dados.hub_origem_id,
        hub_destino_id: dados.hub_destino_id,
        motorista_id: dados.motorista_id || null,
        operador_id: dados.operador_id,
        status_transporte: 'CRIADO',
        data_criacao: new Date(),
        direcao: dados.direcao || 'OUTBOUND'
      }, { transaction });

      await transaction.commit();

      return {
        message: "Transporte criado com sucesso",
        transporte
      };
    } catch (error) {
      originalError = error;
      this._error('createSimples', error);
      if (!rollbackAttempted && transaction && !transaction.finished) {
        try {
          rollbackAttempted = true;
          await transaction.rollback();
        } catch (rollbackError) {
          this._error('Rollback da transação', rollbackError);
        }
      }
      throw new Error(`Erro ao criar transporte simples: ${originalError.message}`);
    }
  }

  async createTransporteComTransferencia(dados) {
    const transaction = await db.sequelize.transaction();
    let rollbackAttempted = false;
    let originalError = null;

    try {
      this._log('Iniciando criação de transporte com transferência', dados);

      const errosValidacao = await this.validarDadosTransporte(dados);
      if (errosValidacao.length > 0) {
        throw new Error(`Erros de validação: ${errosValidacao.join(', ')}`);
      }

      const numeroTransporte = `TR-${Date.now()}`;
      const hubOrigemId = dados.origem_hub_id || dados.hub_origem_id;
      const hubDestinoId = dados.destino_hub_id || dados.hub_destino_id;

      // Criar transferência
      this._log('Criando transferência...');
      const transferencia = await db.Transferencias.create({
        numero_TO: numeroTransporte,
        origem_hub_id: hubOrigemId,
        destino_hub_id: hubDestinoId,
        quantidade: dados.quantidade || 0,
        peso_kg: dados.peso_kg || 0,
        direcao: dados.direcao || 'OUTBOUND',
        operador_id: dados.operador_id,
        status: 'CRIADO',
        data_criacao: new Date()
      }, { transaction });

      this._log(`Transferência criada: ${transferencia.id}`);

      // Preparar dados do transporte
      const transporteData = {
        tipo_transporte: dados.tipo_transporte || 'TO',
        numero_transporte: numeroTransporte,
        transferencia_id: transferencia.id,
        hub_origem_id: hubOrigemId,
        hub_destino_id: hubDestinoId,
        motorista_id: dados.motorista_id || null,
        operador_id: dados.operador_id,
        quantidade_total: dados.quantidade_total || 0,
        peso_total_kg: dados.peso_total_kg || 0,
        volumetria_total: dados.volumetria_total || 0,
        direcao: dados.direcao || 'OUTBOUND',
        status_transporte: 'CRIADO',
        data_criacao: new Date(),
        ...(dados.transportador_nome && { nome_transportador: dados.transportador_nome }),
        ...(dados.cnpj_transportador && { cnpj_transportador: dados.cnpj_transportador }),
        ...(dados.endereco_transportador && { endereco_transportador: dados.endereco_transportador }),
        ...(dados.placa_veiculo && { placa_veiculo: dados.placa_veiculo }),
        ...(dados.uf_veiculo && { uf_veiculo: dados.uf_veiculo }),
        ...(dados.frete_por_conta && { frete_por_conta: dados.frete_por_conta }),
        ...(dados.quantidade_volume && { quantidade_volume: dados.quantidade_volume }),
        ...(dados.especie_volumes && { especie_volumes: dados.especie_volumes }),
        ...(dados.marca_volumes && { marca_volumes: dados.marca_volumes }),
        ...(dados.numero_volumes && { numero_volumes: dados.numero_volumes }),
        ...(dados.peso_bruto && { peso_bruto: dados.peso_bruto }),
        ...(dados.peso_liquido && { peso_liquido: dados.peso_liquido }),
        ...(dados.informacoes_transporte && { informacoes_transporte: dados.informacoes_transporte })
      };

      this._log('Criando transporte...');
      const transporte = await db.Transportes.create(transporteData, { transaction });
      this._log(`Transporte criado: ${transporte.id}`);

      // Criar rota e processar pedidos
      let rota = null;
      if (dados.pedidosIds && dados.pedidosIds.length > 0) {
        rota = await this._criarRotaEProcessarPedidos(transporte, dados.pedidosIds, transaction);
      }

      await transaction.commit();
      this._log('Transação commitada com sucesso');

      const transporteCompleto = await db.Transportes.findByPk(transporte.id, {
        include: [
          { model: db.Transferencias, as: 'transferencias' },
          { model: db.Rotas, as: 'rotas' }
        ]
      });

      return {
        message: "Transporte e transferência criados com sucesso",
        transporte: transporteCompleto,
        transferencia,
        rota
      };

    } catch (error) {
      originalError = error;
      this._error('createTransporteComTransferencia', error);

      if (!rollbackAttempted && transaction && !transaction.finished) {
        try {
          rollbackAttempted = true;
          await transaction.rollback();
          this._log('Transação revertida devido a erro');
        } catch (rollbackError) {
          this._error('Rollback da transação', rollbackError);
        }
      }

      let mensagemErro = originalError.message;
      if (originalError.original && originalError.original.code) {
        if (originalError.original.code === '23502') {
          mensagemErro = `Campo obrigatório não preenchido: ${originalError.original.column}`;
        } else if (originalError.original.code === '23503') {
          mensagemErro = `Referência inválida: ${originalError.original.detail}`;
        } else if (originalError.original.code === '23505') {
          mensagemErro = `Registro duplicado: ${originalError.original.detail}`;
        }
      }

      throw new Error(`Erro ao criar transporte com transferência: ${mensagemErro}`);
    }
  }

  async _criarRotaEProcessarPedidos(transporte, pedidosIds, transaction) {
    try {
      this._log(`Criando rota para ${pedidosIds.length} pedidos`);

      const rota = await db.Rotas.create({
        status_rota: 'CRIADA',
        motorista_id: transporte.motorista_id,
        cluster: `Transporte-${transporte.numero_transporte}`,
        numero_paradas: 0,
        distancia_total_km: 0
      }, { transaction });

      this._log(`Rota criada: ${rota.id}`);

      await transporte.update({ rota_id: rota.id }, { transaction });

      await this._processarPedidosParaTransporte(transporte, rota, pedidosIds, transaction);

      return rota;
    } catch (error) {
      this._error('_criarRotaEProcessarPedidos', error);
      throw error;
    }
  }

  async _processarPedidosParaTransporte(transporte, rota, pedidosIds, transaction) {
    try {
      this._log(`Processando ${pedidosIds.length} pedidos para transporte`);

      const [updatedCount] = await db.Pedidos.update(
        { transporte_id: transporte.id },
        { where: { id: pedidosIds }, transaction }
      );

      this._log(`${updatedCount} pedidos atualizados com transporte_id`);

      const pedidosValidados = await db.Pedidos.findAll({
        where: {
          id: pedidosIds,
          status: 'VALIDADO'
        },
        transaction
      });

      this._log(`${pedidosValidados.length} pedidos validados encontrados`);

      let ordem = 1;
      for (const pedido of pedidosValidados) {
        await db.Paradas.create({
          rota_id: rota.id,
          pedido_id: pedido.id,
          ordem_entrega: ordem++,
          status_parada: 'PENDENTE',
          gaiola_codigo: `GAI${ordem}`
        }, { transaction });
      }

      await rota.update({
        numero_paradas: pedidosValidados.length,
        distancia_total_km: pedidosValidados.length * 5
      }, { transaction });

      this._log(`Rota atualizada com ${pedidosValidados.length} paradas`);
    } catch (error) {
      this._error('_processarPedidosParaTransporte', error);
      throw error;
    }
  }

  async criarParadas(rotaId, pedidosIds, transaction) {
    try {
      let ordem = 1;
      for (const pedidoId of pedidosIds) {
        await db.Paradas.create({
          rota_id: rotaId,
          pedido_id: pedidoId,
          ordem_entrega: ordem++,
          status_parada: 'PENDENTE'
        }, { transaction });
      }
    } catch (error) {
      throw error;
    }
  }

  // ------------------------------------------------------------------------
  //  INICIAR / FINALIZAR / CANCELAR
  // ------------------------------------------------------------------------
  /**
   * Inicia um transporte (fluxo de expedição)
   * CORREÇÃO: 
   * - status alterado para 'EM_TRANSPORTE'
   * - removidos data_inicio e data_conclusao (campos inexistentes)
   * - tratativa opcional para modelo Expedicoes
   */
  async iniciarTransporte(id, dados = {}) {
    const transaction = await db.sequelize.transaction();
    let rollbackAttempted = false;
    let originalError = null;

    try {
      const transporte = await db.Transportes.findByPk(id, {
        include: [
          { model: db.Transferencias, as: 'transferencias' },
          { model: db.Pedidos, as: 'pedidos' }
        ],
        transaction
      });

      if (!transporte) throw new Error('Transporte não encontrado');

      // Valida se pode iniciar
      await this.validarInicioTransporte(transporte, transaction);

      // Fechar conferência associada quando aplicável
      const conferencia = await this._getConferenciaAssociada(transporte.id, transaction);
      if (conferencia && conferencia.status !== 'CONCLUIDO') {
        await conferencia.update({ status: 'CONCLUIDO', data_termino: new Date() }, { transaction });
      }

      // CORREÇÃO: status correto e remoção de data_inicio / data_conclusao
      await transporte.update({
        status_transporte: 'EM_TRANSPORTE',
        ...dados
      }, { transaction });

      // Normalizar transferências
      let transferencias = transporte.transferencias || [];
      if (!Array.isArray(transferencias)) transferencias = [transferencias];

      // Atualizar transferências associadas para EM_TRANSPORTE
      for (const transferenciaInstance of transferencias) {
        if (transferenciaInstance && transferenciaInstance.id) {
          await db.Transferencias.update({
            status: 'EM_TRANSPORTE',
            data_inicio: new Date()   // campo válido em Transferencias
          }, { where: { id: transferenciaInstance.id }, transaction });
        }
      }

      // Modelo de Expedições (pode não existir)
      const ExpedicoesModel = db.Expedicoes || db.Expedicao || db.Expediacao || null;
      if (!ExpedicoesModel) {
        console.warn('[TransporteServices] Modelo de Expedições não encontrado. Pulando criação de expedição.');
      }

      // Processar pedidos do transporte
      const pedidosAssociados = transporte.pedidos || [];
      const dataEnvioISO = new Date().toISOString();

      for (const pedido of pedidosAssociados) {
        // Criar/atualizar expedição (se o modelo existir)
        if (ExpedicoesModel) {
          const expedicaoExistente = await ExpedicoesModel.findOne({ where: { pedido_id: pedido.id }, transaction });
          if (!expedicaoExistente) {
            await ExpedicoesModel.create({
              pedido_id: pedido.id,
              nota_fiscal: pedido.nota_fiscal || null,
              codigo_rastreamento: null,
              data_envio: dataEnvioISO
            }, { transaction });
          } else {
            await expedicaoExistente.update({ data_envio: dataEnvioISO }, { transaction });
          }
        }

        // Criar rastreamento de saída
        if (db.Rastreamentos) {
          await db.Rastreamentos.create({
            pedido_id: pedido.id,
            status_atual: 'EM_ROTA',
            data_status: new Date(),
            localizacao: `Saída do Hub ${transporte.hub_origem_id || 'desconhecido'}`
          }, { transaction });
        }

        // Atualizar status do pedido para EM_ROTA
        await db.Pedidos.update(
          { status: 'EM_ROTA' },
          { where: { id: pedido.id }, transaction }
        );
      }

      await transaction.commit();

      const transporteAtualizado = await db.Transportes.findByPk(id, {
        include: [
          { model: db.Transferencias, as: 'transferencias' },
          { model: db.Pedidos, as: 'pedidos' }
        ]
      });

      return {
        message: "Transporte iniciado com sucesso (status: EM_TRANSPORTE)",
        transporte: transporteAtualizado
      };

    } catch (error) {
      originalError = error;
      this._error('iniciarTransporte', error);

      if (!rollbackAttempted && transaction && !transaction.finished) {
        try {
          rollbackAttempted = true;
          await transaction.rollback();
        } catch (rollbackError) {
          this._error('Rollback da transação', rollbackError);
        }
      }

      throw new Error(`Erro ao iniciar transporte: ${originalError.message}`);
    }
  }

  /**
   * Finaliza um transporte
   * CORREÇÃO: usa data_conclusao (campo válido) em vez de data_fim
   */
  async finalizarTransporte(id) {
    const transaction = await db.sequelize.transaction();
    let rollbackAttempted = false;
    let originalError = null;

    try {
      const transporte = await db.Transportes.findByPk(id, {
        include: [
          { model: db.Transferencias, as: 'transferencias' },
          { model: db.Rotas, as: 'rotas' }
        ],
        transaction
      });
      if (!transporte) throw new Error('Transporte não encontrado');
      if (transporte.status_transporte !== 'EM_TRANSPORTE') {
        throw new Error('Só é possível finalizar transportes em transporte');
      }

      await transporte.update({
        status_transporte: 'RECEBIDO',
        data_conclusao: new Date()    // ← campo válido
      }, { transaction });

      if (transporte.transferencias && transporte.transferencias.length > 0) {
        for (const transferencia of transporte.transferencias) {
          await transferencia.update({
            status: 'RECEBIDO',
            data_conclusao: new Date() // campo válido em Transferencias
          }, { transaction });
        }
      }

      if (transporte.rotas && transporte.rotas.length > 0) {
        for (const rota of transporte.rotas) {
          await rota.update({
            status_rota: 'FINALIZADA',
            data_conclusao: new Date()
          }, { transaction });

          await db.Paradas.update(
            { status_parada: 'CONCLUIDA' },
            { where: { rota_id: rota.id, status_parada: 'PENDENTE' }, transaction }
          );
        }
      }

      await this.atualizarStatusPedidos(transporte.id, 'ENTREGUE', transaction);

      const pedidos = await db.Pedidos.findAll({
        where: { transporte_id: transporte.id },
        transaction
      });

      for (const pedido of pedidos) {
        await db.Rastreamentos.create({
          pedido_id: pedido.id,
          status_atual: 'ENTREGUE',
          data_status: new Date(),
          localizacao: 'Entregue no destino',
          observacao: `Transporte ${transporte.numero_transporte} finalizado`
        }, { transaction });
      }

      await transaction.commit();

      return {
        message: "Transporte finalizado com sucesso",
        transporte: await db.Transportes.findByPk(id, {
          include: [
            { model: db.Transferencias, as: 'transferencias' },
            { model: db.Rotas, as: 'rotas' },
            { model: db.Pedidos, as: 'pedidos' }
          ]
        })
      };
    } catch (error) {
      originalError = error;
      this._error('finalizarTransporte', error);
      if (!rollbackAttempted && transaction && !transaction.finished) {
        try {
          rollbackAttempted = true;
          await transaction.rollback();
        } catch (rollbackError) {
          this._error('Rollback da transação', rollbackError);
        }
      }
      throw new Error(`Erro ao finalizar transporte: ${originalError.message}`);
    }
  }

  /**
   * Cancela um transporte
   * CORREÇÃO: usa data_conclusao (campo válido) em vez de data_fim
   */
  async cancelarTransporte(id, motivo) {
    const transaction = await db.sequelize.transaction();
    let rollbackAttempted = false;
    let originalError = null;

    try {
      const transporte = await db.Transportes.findByPk(id, {
        include: [
          { model: db.Transferencias, as: 'transferencias' },
          { model: db.Rotas, as: 'rotas' }
        ],
        transaction
      });
      if (!transporte) throw new Error('Transporte não encontrado');
      if (transporte.status_transporte === 'RECEBIDO') {
        throw new Error('Não é possível cancelar um transporte já recebido');
      }

      await transporte.update({
        status_transporte: 'CANCELADO',
        data_conclusao: new Date()    // ← campo válido
      }, { transaction });

      if (transporte.transferencias && transporte.transferencias.length > 0) {
        for (const transferencia of transporte.transferencias) {
          await transferencia.update({
            status: 'CANCELADO',
            data_conclusao: new Date()
          }, { transaction });
        }
      }

      if (transporte.rotas && transporte.rotas.length > 0) {
        for (const rota of transporte.rotas) {
          await rota.update({
            status_rota: 'CANCELADA',
            data_conclusao: new Date()
          }, { transaction });
        }
      }

      await this.atualizarStatusPedidos(transporte.id, 'CANCELADO', transaction);

      await db.Excecao.create({
        numero_ocorrencia: `TR-CANC-${Date.now()}`,
        tipo: 'CANCELAMENTO_TRANSPORTE',
        gravidade: 'MEDIA',
        titulo: `Transporte ${transporte.numero_transporte} cancelado`,
        descricao: motivo || 'Cancelamento solicitado pelo operador',
        transporte_id: transporte.id,
        criador_id: transporte.operador_id,
        data_ocorrencia: new Date(),
        status: 'FECHADA'
      }, { transaction });

      await transaction.commit();

      return {
        message: "Transporte cancelado com sucesso",
        transporte
      };
    } catch (error) {
      originalError = error;
      this._error('cancelarTransporte', error);
      if (!rollbackAttempted && transaction && !transaction.finished) {
        try {
          rollbackAttempted = true;
          await transaction.rollback();
        } catch (rollbackError) {
          this._error('Rollback da transação', rollbackError);
        }
      }
      throw new Error(`Erro ao cancelar transporte: ${originalError.message}`);
    }
  }

  // ------------------------------------------------------------------------
  //  ATUALIZAÇÕES DE STATUS
  // ------------------------------------------------------------------------
  async atualizarStatus(idTransporte, statusNovo) {
    const transaction = await db.sequelize.transaction();
    let rollbackAttempted = false;
    let originalError = null;

    try {
      const transporte = await db.Transportes.findByPk(idTransporte, {
        include: [{ model: db.Rotas, as: 'rotas' }],
        transaction
      });
      if (!transporte) throw new Error('Transporte não encontrado');

      this.validarTransicaoStatus(transporte.status_transporte, statusNovo);

      const updateData = { status_transporte: statusNovo };

      // Apenas seta data_conclusao quando o status for final
      if (['RECEBIDO', 'ENTREGUE', 'CANCELADO'].includes(statusNovo)) {
        updateData.data_conclusao = new Date();
      }

      await transporte.update(updateData, { transaction });

      if (transporte.rotas && transporte.rotas.length > 0) {
        await this.atualizarStatusRota(transporte.rotas[0], statusNovo, transaction);
      }

      const statusPedido = this.mapearStatusPedido(statusNovo);
      await this.atualizarStatusPedidos(idTransporte, statusPedido, transaction);

      await transaction.commit();
      return transporte;
    } catch (error) {
      originalError = error;
      this._error('atualizarStatus', error);
      if (!rollbackAttempted && transaction && !transaction.finished) {
        try {
          rollbackAttempted = true;
          await transaction.rollback();
        } catch (rollbackError) {
          this._error('Rollback da transação', rollbackError);
        }
      }
      throw new Error(`Erro ao atualizar status: ${originalError.message}`);
    }
  }

  async atualizarStatusRota(rota, statusTransporte, transaction) {
    if (statusTransporte === 'EM_TRANSPORTE') {
      rota.status_rota = 'EM_ANDAMENTO';
    } else if (['RECEBIDO', 'ENTREGUE'].includes(statusTransporte)) {
      rota.status_rota = 'FINALIZADA';
      rota.data_conclusao = new Date();
    } else if (statusTransporte === 'CANCELADO') {
      rota.status_rota = 'CANCELADA';
      rota.data_conclusao = new Date();
    }
    await rota.save({ transaction });
  }

  async atualizarStatusPedidos(transporteId, status, transaction = null) {
    const opcoes = transaction
      ? { where: { transporte_id: transporteId }, transaction }
      : { where: { transporte_id: transporteId } };
    await db.Pedidos.update({ status }, opcoes);
  }

  // ------------------------------------------------------------------------
  //  ASSOCIAÇÕES
  // ------------------------------------------------------------------------
  async associarConferencia(idTransporte, idConferencia) {
    const transaction = await db.sequelize.transaction();
    let rollbackAttempted = false;
    let originalError = null;

    try {
      const transporte = await db.Transportes.findByPk(idTransporte, { transaction });
      if (!transporte) throw new Error('Transporte não encontrado');

      const conferencia = await db.Conferencias.findByPk(idConferencia, { transaction });
      if (!conferencia) throw new Error('Conferência não encontrada');

      await this.validarAssociacaoConferencia(conferencia, idTransporte, transaction);

      conferencia.transporte_id = idTransporte;
      await conferencia.save({ transaction });

      await transaction.commit();

      return {
        message: 'Conferência associada com sucesso',
        transporte,
        conferencia
      };
    } catch (error) {
      originalError = error;
      this._error('associarConferencia', error);
      if (!rollbackAttempted && transaction && !transaction.finished) {
        try {
          rollbackAttempted = true;
          await transaction.rollback();
        } catch (rollbackError) {
          this._error('Rollback da transação', rollbackError);
        }
      }
      throw originalError;
    }
  }

  async validarAssociacaoConferencia(conferencia, idTransporte, transaction) {
    if (conferencia.transporte_id && conferencia.transporte_id !== parseInt(idTransporte)) {
      throw new Error('Esta conferência já está associada a outro transporte');
    }

    const conferenciasExistentes = await db.Conferencias.findAll({
      where: { transporte_id: idTransporte },
      transaction
    });

    if (conferenciasExistentes.length > 0) {
      throw new Error(`Já existe uma conferência associada a este transporte`);
    }
  }

  async removerAssociacaoConferencia(idTransporte, idConferencia) {
    const transaction = await db.sequelize.transaction();
    let rollbackAttempted = false;
    let originalError = null;

    try {
      const transporte = await db.Transportes.findByPk(idTransporte, { transaction });
      if (!transporte) throw new Error('Transporte não encontrado');

      const conferencia = await db.Conferencias.findByPk(idConferencia, { transaction });
      if (!conferencia) throw new Error('Conferência não encontrada');

      if (conferencia.transporte_id !== parseInt(idTransporte)) {
        throw new Error('Esta conferência não está associada a este transporte');
      }

      conferencia.transporte_id = null;
      await conferencia.save({ transaction });

      await transaction.commit();

      return {
        message: 'Associação removida com sucesso',
        conferencia
      };
    } catch (error) {
      originalError = error;
      this._error('removerAssociacaoConferencia', error);
      if (!rollbackAttempted && transaction && !transaction.finished) {
        try {
          rollbackAttempted = true;
          await transaction.rollback();
        } catch (rollbackError) {
          this._error('Rollback da transação', rollbackError);
        }
      }
      throw originalError;
    }
  }

  async getConferenciasAssociadas(idTransporte) {
    return await db.Conferencias.findAll({
      where: { transporte_id: idTransporte },
      include: [
        {
          model: db.Usuarios,
          as: 'operador',
          attributes: ['id', 'nome']
        }
      ]
    });
  }

  async getConferenciasDisponiveis() {
    return await db.Conferencias.findAll({
      where: {
        transporte_id: null,
      },
      attributes: ['id', 'status', 'nome_estacao']
    });
  }

  async atribuirMotorista(transporteId, motoristaId) {
    const transaction = await db.sequelize.transaction();
    let rollbackAttempted = false;
    let originalError = null;

    try {
      const transporte = await db.Transportes.findByPk(transporteId, { transaction });
      if (!transporte) throw new Error('Transporte não encontrado');

      const motorista = await db.Motoristas.findByPk(motoristaId, { transaction });
      if (!motorista) throw new Error('Motorista não encontrado');

      await transporte.update({ motorista_id: motoristaId }, { transaction });

      await transaction.commit();

      return {
        message: "Motorista atribuído com sucesso",
        transporte,
        motorista
      };
    } catch (error) {
      originalError = error;
      this._error('atribuirMotorista', error);
      if (!rollbackAttempted && transaction && !transaction.finished) {
        try {
          rollbackAttempted = true;
          await transaction.rollback();
        } catch (rollbackError) {
          this._error('Rollback da transação', rollbackError);
        }
      }
      throw originalError;
    }
  }

  async atribuirRota(idTransporte, idRota) {
    const transaction = await db.sequelize.transaction();
    let rollbackAttempted = false;
    let originalError = null;

    try {
      const transporte = await db.Transportes.findByPk(idTransporte, { transaction });
      if (!transporte) throw new Error('Transporte não encontrado');

      const rota = await db.Rotas.findByPk(idRota, { transaction });
      if (!rota) throw new Error('Rota não encontrada');

      await this.validarAssociacaoRota(rota, idTransporte, transaction);

      transporte.rota_id = idRota;
      await transporte.save({ transaction });

      await transaction.commit();
      return transporte;
    } catch (error) {
      originalError = error;
      this._error('atribuirRota', error);
      if (!rollbackAttempted && transaction && !transaction.finished) {
        try {
          rollbackAttempted = true;
          await transaction.rollback();
        } catch (rollbackError) {
          this._error('Rollback da transação', rollbackError);
        }
      }
      throw originalError;
    }
  }

  async validarAssociacaoRota(rota, idTransporte, transaction) {
    const transporteComRota = await db.Transportes.findOne({
      where: { rota_id: rota.id },
      transaction
    });

    if (transporteComRota && transporteComRota.id !== parseInt(idTransporte)) {
      throw new Error('Esta rota já está associada a outro transporte');
    }

    if (!['CRIADA', 'EM_ANDAMENTO'].includes(rota.status_rota)) {
      throw new Error('Só é possível associar rotas com status CRIADA ou EM_ANDAMENTO');
    }
  }

  async criarRota(transporteId, dados) {
    const transaction = await db.sequelize.transaction();
    let rollbackAttempted = false;
    let originalError = null;

    try {
      const transporte = await db.Transportes.findByPk(transporteId, { transaction });
      if (!transporte) throw new Error('Transporte não encontrado');

      if (transporte.rota_id) {
        throw new Error('Este transporte já possui uma rota associada');
      }

      const rota = await db.Rotas.create({
        cluster: dados.cluster || `Rota-${transporte.numero_transporte}`,
        motorista_id: dados.motorista_id || transporte.motorista_id,
        status_rota: 'CRIADA',
        numero_paradas: 0,
        data_criacao: new Date()
      }, { transaction });

      if (dados.pedidos && Array.isArray(dados.pedidos) && dados.pedidos.length > 0) {
        await this.criarParadas(rota.id, dados.pedidos, transaction);
        await rota.update({ numero_paradas: dados.pedidos.length }, { transaction });
      }

      await transporte.update({ rota_id: rota.id }, { transaction });

      const transporteAtualizado = await db.Transportes.findByPk(transporteId, {
        include: [
          { model: db.Motoristas },
          { model: db.Hubs, as: 'hubOrigem' },
          { model: db.Hubs, as: 'hubDestino' },
          { model: db.Rotas, as: 'rotas' }
        ],
        transaction
      });

      await transaction.commit();
      return {
        transporte: transporteAtualizado,
        rota
      };
    } catch (error) {
      originalError = error;
      this._error('criarRota', error);
      if (!rollbackAttempted && transaction && !transaction.finished) {
        try {
          rollbackAttempted = true;
          await transaction.rollback();
        } catch (rollbackError) {
          this._error('Rollback da transação', rollbackError);
        }
      }
      throw originalError;
    }
  }

  async criarParadasRota(transporte, transaction) {
    // Este método não é mais utilizado (mantido por compatibilidade)
    console.warn('[TransporteServices] criarParadasRota está obsoleto, utilize criarParadas diretamente');
  }

  // ------------------------------------------------------------------------
  //  DADOS DO TRANSPORTADOR
  // ------------------------------------------------------------------------
  async atualizarDadosTransportador(id, dados) {
    const transaction = await db.sequelize.transaction();
    let rollbackAttempted = false;
    let originalError = null;

    try {
      const transporte = await db.Transportes.findByPk(id, { transaction });
      if (!transporte) throw new Error('Transporte não encontrado');

      const camposTransportador = [
        'nome_transportador',
        'cnpj_transportador',
        'endereco_transportador',
        'placa_veiculo',
        'uf_veiculo',
        'frete_por_conta',
        'quantidade_volume',
        'especie_volumes',
        'marca_volumes',
        'numero_volumes',
        'peso_bruto',
        'peso_liquido',
        'informacoes_transporte'
      ];

      const dadosAtualizacao = {};
      camposTransportador.forEach(campo => {
        if (dados[campo] !== undefined) dadosAtualizacao[campo] = dados[campo];
      });

      await transporte.update(dadosAtualizacao, { transaction });

      if (transporte.transferencia_id) {
        const transferencia = await db.Transferencias.findByPk(transporte.transferencia_id, { transaction });
        if (transferencia) {
          await transferencia.update(dadosAtualizacao, { transaction });
        }
      }

      await transaction.commit();

      return {
        message: "Dados do transportador atualizados com sucesso",
        transporte
      };
    } catch (error) {
      originalError = error;
      this._error('atualizarDadosTransportador', error);
      if (!rollbackAttempted && transaction && !transaction.finished) {
        try {
          rollbackAttempted = true;
          await transaction.rollback();
        } catch (rollbackError) {
          this._error('Rollback da transação', rollbackError);
        }
      }
      throw originalError;
    }
  }

  // ------------------------------------------------------------------------
  //  DASHBOARD E ESTATÍSTICAS
  // ------------------------------------------------------------------------
  async getTransportesDashboard(dataInicio, dataFim) {
    try {
      const whereConditions = {
        data_criacao: { [Op.between]: [new Date(dataInicio), new Date(dataFim)] }
      };

      const totalTransportes = await db.Transportes.count({ where: whereConditions });

      const transportesPorStatus = await db.Transportes.findAll({
        attributes: [
          'status_transporte',
          [db.sequelize.fn('COUNT', 'status_transporte'), 'count']
        ],
        where: whereConditions,
        group: ['status_transporte'],
        raw: true
      });

      const transportesPorDirecao = await db.Transportes.findAll({
        attributes: [
          'direcao',
          [db.sequelize.fn('COUNT', 'direcao'), 'count']
        ],
        where: whereConditions,
        group: ['direcao'],
        raw: true
      });

      const topTransportadoras = await db.Transportes.findAll({
        attributes: [
          'nome_transportador',
          [db.sequelize.fn('COUNT', 'nome_transportador'), 'total_transportes']
        ],
        where: { ...whereConditions, nome_transportador: { [Op.not]: null } },
        group: ['nome_transportador'],
        order: [[db.sequelize.literal('total_transportes'), 'DESC']],
        limit: 5
      });

      return {
        totalTransportes,
        transportesPorStatus,
        transportesPorDirecao,
        topTransportadoras
      };
    } catch (error) {
      this._error('getTransportesDashboard', error);
      throw new Error(`Erro ao buscar dados do dashboard: ${error.message}`);
    }
  }

  async getHubs() {
    return await db.Hubs.findAll({
      attributes: ['id', 'nome']
    });
  }

  async getMotoristasDisponiveis() {
    return await db.Motoristas.findAll({
      attributes: ['id', 'nome', 'veiculo']
    });
  }

  async getRotasDisponiveis() {
    return await db.Rotas.findAll({
      where: {
        status_rota: ['CRIADA', 'EM_ANDAMENTO']
      },
      include: [
        {
          model: db.Motoristas,
          attributes: ['id', 'nome', 'veiculo'],
        }
      ],
      attributes: ['id', 'cluster', 'status_rota', 'numero_paradas'],
      order: [['id', 'DESC']]
    });
  }

  async criarExcecaoCancelamento(pedidoId, transporteId, transaction) {
    const numeroOcorrencia = "EXC-" + Date.now();
    await db.Excecoes.create({
      numero_ocorrencia: numeroOcorrencia,
      tipo: 'TRANSPORTE',
      gravidade: 'MEDIA',
      titulo: `Cancelamento do transporte ${transporteId}`,
      descricao: `Pedido ${pedidoId} impactado pelo cancelamento`,
      pedido_id: pedidoId,
      transporte_id: transporteId,
      criador_id: 1,
      data_ocorrencia: new Date(),
      status: 'ABERTA'
    }, { transaction });
  }
}

module.exports = TransporteServices;