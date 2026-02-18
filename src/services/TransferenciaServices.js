'use strict';

const Services = require('./Services');
const db = require('../models');
const { Op } = require('sequelize');

// Status de pedido válidos para associação a uma transferência
const PEDIDO_STATUS_VALIDOS_PARA_TRANSFERENCIA = ['VALIDADO'];

class TransferenciaServices extends Services {
  constructor() {
    super('Transferencias');
  }

  /**
   * Log detalhado com timestamp
   */
  _log(step, data = null, level = 'info') {
    const timestamp = new Date().toISOString();
    const logFn = level === 'error' ? console.error : (level === 'warn' ? console.warn : console.log);
    logFn(`[${timestamp}] [TransferenciaServices] ${step}`);
    if (data) {
      const safeData = { ...data };
      const sensitiveFields = ['senha', 'password', 'token', 'chave', 'secret'];
      sensitiveFields.forEach(field => {
        if (safeData[field]) safeData[field] = '***REDACTED***';
      });
      logFn(`[${timestamp}] [TransferenciaServices] Dados:`, JSON.stringify(safeData, null, 2));
    }
  }

  /**
   * Log de erro detalhado
   */
  _error(context, error, extra = {}) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [TransferenciaServices] ERRO em ${context}:`);
    console.error(`[${timestamp}] [TransferenciaServices] Mensagem: ${error.message}`);
    console.error(`[${timestamp}] [TransferenciaServices] Stack:`, error.stack);
    if (error.original) {
      console.error(`[${timestamp}] [TransferenciaServices] Erro original:`, {
        code: error.original.code,
        detail: error.original.detail,
        constraint: error.original.constraint,
        table: error.original.table,
        column: error.original.column,
        schema: error.original.schema,
        routine: error.original.routine,
        severity: error.original.severity,
        sql: error.original.sql || error.sql
      });
    }
    if (Object.keys(extra).length > 0) {
      console.error(`[${timestamp}] [TransferenciaServices] Extra:`, extra);
    }
  }

  /**
   * Valida dados básicos da transferência
   */
  async _validarDadosBasicos(dados) {
    const erros = [];

    if (!dados.operador_id && !dados.usuario_id) {
      erros.push('Operador não especificado (operador_id ou usuario_id)');
    } else {
      const operadorId = dados.operador_id || dados.usuario_id;
      try {
        const operador = await db.Usuarios.findByPk(operadorId);
        if (!operador) erros.push(`Operador (ID: ${operadorId}) não encontrado`);
        else if (operador.status !== 'ATIVO') erros.push(`Operador (ID: ${operadorId}) não está ativo`);
      } catch (error) {
        erros.push(`Erro ao validar operador: ${error.message}`);
      }
    }

    if (!dados.origem_hub_id) {
      erros.push('Hub de origem não especificado');
    } else {
      try {
        const hubOrigem = await db.Hubs.findByPk(dados.origem_hub_id);
        if (!hubOrigem) erros.push(`Hub de origem (ID: ${dados.origem_hub_id}) não encontrado`);
      } catch (error) {
        erros.push(`Erro ao validar hub de origem: ${error.message}`);
      }
    }

    if (!dados.destino_hub_id) {
      erros.push('Hub de destino não especificado');
    } else {
      try {
        const hubDestino = await db.Hubs.findByPk(dados.destino_hub_id);
        if (!hubDestino) erros.push(`Hub de destino (ID: ${dados.destino_hub_id}) não encontrado`);
      } catch (error) {
        erros.push(`Erro ao validar hub de destino: ${error.message}`);
      }
    }

    if (dados.motorista_id) {
      try {
        const motorista = await db.Motoristas.findByPk(dados.motorista_id);
        if (!motorista) erros.push(`Motorista (ID: ${dados.motorista_id}) não encontrado`);
        else if (motorista.ativo !== true) erros.push(`Motorista (ID: ${dados.motorista_id}) não está ativo`);
      } catch (error) {
        erros.push(`Erro ao validar motorista: ${error.message}`);
      }
    }

    if (dados.pedidosIds && !Array.isArray(dados.pedidosIds)) {
      erros.push('pedidosIds deve ser um array');
    }

    return erros;
  }

  /**
   * Extrai e normaliza dados de transporte (apenas campos existentes no model Transportes)
   */
  _extrairDadosTransporte(dados) {
    if (!dados.transporte && !dados.transportador_nome) return null;
    const fonte = dados.transporte || dados;
    return {
      nome_transportador: fonte.transportador_nome || null,
      cnpj_transportador: fonte.cnpj_transportador || null,
      endereco_transportador: fonte.endereco_transportador || null,
      placa_veiculo: fonte.placa_veiculo || null,
      uf_veiculo: fonte.uf_veiculo || null,
      frete_por_conta: fonte.frete_por_conta || null,
      quantidade_volume: fonte.quantidade_volume || null,
      especie_volumes: fonte.especie_volumes || null,
      marca_volumes: fonte.marca_volumes || null,
      numero_volumes: fonte.numero_volumes || null,
      peso_bruto: fonte.peso_bruto || null,
      peso_liquido: fonte.peso_liquido || null,
      informacoes_transporte: fonte.informacoes_transporte || null
    };
  }

  /**
   * Validação pré-transação para evitar conflitos
   */
  async _validarPreTransacao(dados) {
    const erros = [];

    if (dados.numero_TO) {
      try {
        const existe = await db.Transferencias.findOne({ where: { numero_TO: dados.numero_TO } });
        if (existe) erros.push(`Número de transferência ${dados.numero_TO} já existe`);
      } catch (error) {
        erros.push(`Erro ao verificar número_TO: ${error.message}`);
      }
    }

    if (dados.pedidosIds && dados.pedidosIds.length > 0) {
      try {
        const pedidosComTransferencia = await db.Pedidos.findAll({
          where: {
            id: dados.pedidosIds,
            transferencia_id: { [Op.not]: null }
          },
          attributes: ['id', 'transferencia_id']
        });
        if (pedidosComTransferencia.length > 0) {
          erros.push(`Pedidos já associados a outra transferência: ${pedidosComTransferencia.map(p => p.id).join(', ')}`);
        }
      } catch (error) {
        erros.push(`Erro ao verificar pedidos: ${error.message}`);
      }
    }

    return erros;
  }

  /**
   * Associa pedidos a uma transferência
   * Apenas status VALIDADO são aceitos; não altera o status do pedido.
   */
  async _associarPedidosATransferencia(transferenciaId, pedidosIds, transporteId = null, transaction) {
    const pedidosAssociados = [];

    for (const pedidoId of pedidosIds) {
      const pedido = await db.Pedidos.findByPk(pedidoId, { transaction });
      if (!pedido) throw new Error(`Pedido ${pedidoId} não encontrado`);

      if (!PEDIDO_STATUS_VALIDOS_PARA_TRANSFERENCIA.includes(pedido.status)) {
        throw new Error(`Pedido ${pedidoId} com status inválido: ${pedido.status}. Permitidos: ${PEDIDO_STATUS_VALIDOS_PARA_TRANSFERENCIA.join(', ')}`);
      }

      if (pedido.transferencia_id && pedido.transferencia_id !== transferenciaId) {
        const outraTransferencia = await db.Transferencias.findByPk(pedido.transferencia_id, { transaction });
        if (outraTransferencia && ['CRIADO', 'EM_TRANSPORTE'].includes(outraTransferencia.status)) {
          throw new Error(`Pedido ${pedidoId} já está na transferência ${outraTransferencia.numero_TO} (Status: ${outraTransferencia.status})`);
        }
      }

      await pedido.update({
        transferencia_id: transferenciaId,
        transporte_id: transporteId
      }, { transaction });

      pedidosAssociados.push(pedido);
    }

    this._log(`Associados ${pedidosAssociados.length} pedidos à transferência ${transferenciaId}`);
    return pedidosAssociados;
  }

  /**
   * Cria transferência simplificada (sem pedidos)
   */
  async createSimples(dados) {
    const transaction = await db.sequelize.transaction();
    let rollbackAttempted = false;

    try {
      this._log('Criando transferência simples', dados);

      const erros = await this._validarDadosBasicos(dados);
      if (erros.length) throw new Error(`Erros de validação: ${erros.join(', ')}`);

      const errosPre = await this._validarPreTransacao(dados);
      if (errosPre.length) throw new Error(`Erros de validação pré-transação: ${errosPre.join(', ')}`);

      const operador_id = dados.operador_id || dados.usuario_id;
      const numero_TO = dados.numero_TO || `TO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const transferencia = await db.Transferencias.create({
        numero_TO,
        origem_hub_id: dados.origem_hub_id,
        destino_hub_id: dados.destino_hub_id,
        motorista_id: dados.motorista_id || null,
        tipo_recebedor: dados.tipo_recebedor || 'HUB',
        quantidade: 0,
        peso_kg: 0,
        direcao: dados.direcao || 'OUTBOUND',
        operador_id,
        status: 'CRIADO',
        data_criacao: new Date()
      }, { transaction });

      this._log(`Transferência criada: ${transferencia.id}`);

      let transporte = null;
      const dadosTransporte = this._extrairDadosTransporte(dados);
      if (dadosTransporte) {
        transporte = await db.Transportes.create({
          tipo_transporte: 'TO',
          numero_transporte: numero_TO,
          transferencia_id: transferencia.id,
          hub_origem_id: dados.origem_hub_id,
          hub_destino_id: dados.destino_hub_id,
          motorista_id: dados.motorista_id || null,
          operador_id,
          quantidade_total: 0,
          volumetria_total: 0,
          direcao: dados.direcao || 'OUTBOUND',
          status_transporte: 'CRIADO',
          data_criacao: new Date(),
          ...dadosTransporte
        }, { transaction });

        this._log(`Transporte criado: ${transporte.id}`);
      }

      let pedidosAssociados = [];
      if (dados.pedidosIds && dados.pedidosIds.length > 0) {
        pedidosAssociados = await this._associarPedidosATransferencia(
          transferencia.id,
          dados.pedidosIds,
          transporte ? transporte.id : null,
          transaction
        );
      }

      await transferencia.update({
        quantidade: pedidosAssociados.length,
        peso_kg: dados.peso_kg || 0
      }, { transaction });

      if (transporte) {
        await transporte.update({
          quantidade_total: pedidosAssociados.length
        }, { transaction });
      }

      await transaction.commit();
      this._log('Transação commitada com sucesso');

      const resultado = {
        message: "Transferência criada com sucesso",
        transferencia: await this.getById(transferencia.id),
        totalPedidos: pedidosAssociados.length
      };
      if (transporte) resultado.transporte = transporte;

      return resultado;

    } catch (error) {
      this._error('createSimples', error, dados);

      if (!rollbackAttempted && transaction && !transaction.finished) {
        rollbackAttempted = true;
        try { await transaction.rollback(); } catch (rollbackError) {
          this._error('Rollback da transação', rollbackError);
        }
      }

      throw new Error(`Erro ao criar transferência: ${error.message}`);
    }
  }

  /**
   * Cria transferência com pedidos
   */
  async createWithPedidos(dados, options = {}) {
    let externalTx = options.transaction;
    let transaction = externalTx;
    let createdHere = !externalTx;
    let rollbackAttempted = false;

    try {
      this._log('Iniciando createWithPedidos', {
        dadosLength: Object.keys(dados).length,
        hasExternalTx: !!externalTx
      });

      if (!transaction) transaction = await db.sequelize.transaction();

      const erros = await this._validarDadosBasicos(dados);
      if (erros.length) throw new Error(`Erros de validação: ${erros.join(', ')}`);

      const errosPre = await this._validarPreTransacao(dados);
      if (errosPre.length) throw new Error(`Erros de validação pré-transação: ${errosPre.join(', ')}`);

      const operador_id = dados.operador_id || dados.usuario_id || options.usuario_id || process.env.SYSTEM_USER_ID || 1;
      const numero_TO = dados.numero_TO || `TO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      this._log(`Criando transferência: ${numero_TO}, operador: ${operador_id}`);

      const transferencia = await db.Transferencias.create({
        numero_TO,
        origem_hub_id: dados.origem_hub_id,
        destino_hub_id: dados.destino_hub_id,
        motorista_id: dados.motorista_id || null,
        tipo_recebedor: dados.tipo_recebedor || 'HUB',
        quantidade: 0,
        peso_kg: 0,
        direcao: dados.direcao || 'OUTBOUND',
        operador_id,
        status: 'CRIADO',
        data_criacao: new Date()
      }, { transaction, returning: true });

      this._log(`Transferência criada: ${transferencia.id}`);

      let transporte = null;
      const dadosTransporte = this._extrairDadosTransporte(dados);
      if (dadosTransporte) {
        transporte = await db.Transportes.create({
          tipo_transporte: 'TO',
          numero_transporte: numero_TO,
          transferencia_id: transferencia.id,
          hub_origem_id: dados.origem_hub_id,
          hub_destino_id: dados.destino_hub_id,
          motorista_id: dados.motorista_id || null,
          operador_id,
          quantidade_total: 0,
          volumetria_total: 0,
          direcao: dados.direcao || 'OUTBOUND',
          status_transporte: 'CRIADO',
          data_criacao: new Date(),
          ...dadosTransporte
        }, { transaction, returning: true });

        this._log(`Transporte criado: ${transporte.id}`);
      }

      let pedidosAssociados = [];
      if (dados.pedidosIds && dados.pedidosIds.length > 0) {
        pedidosAssociados = await this._associarPedidosATransferencia(
          transferencia.id,
          dados.pedidosIds,
          transporte ? transporte.id : null,
          transaction
        );
      } else if (dados.pedidosCodigos && dados.pedidosCodigos.length > 0) {
        const pedidosIds = [];
        for (const codigo of dados.pedidosCodigos) {
          let pedido = await db.Pedidos.findOne({ where: { codigo_pedido: codigo }, transaction });
          if (!pedido) {
            this._log(`Pedido com código ${codigo} não encontrado, criando com status VALIDADO`);
            pedido = await db.Pedidos.create({
              codigo_pedido: codigo,
              status: 'VALIDADO',
              cliente_id: dados.cliente_id || 1,
              usuario_id: operador_id
            }, { transaction });
          }
          pedidosIds.push(pedido.id);
        }
        pedidosAssociados = await this._associarPedidosATransferencia(
          transferencia.id,
          pedidosIds,
          transporte ? transporte.id : null,
          transaction
        );
      }

      await transferencia.update({
        quantidade: pedidosAssociados.length,
        peso_kg: dados.peso_kg || 0
      }, { transaction });

      if (transporte) {
        await transporte.update({
          quantidade_total: pedidosAssociados.length
        }, { transaction });
      }

      if (createdHere) {
        await transaction.commit();
        transaction = null;
        this._log('Transação commitada com sucesso');
      }

      const transferenciaCompleta = await this.getById(transferencia.id);

      const resultado = {
        message: "Transferência criada com sucesso",
        transferencia: transferenciaCompleta,
        totalPedidos: pedidosAssociados.length
      };
      if (transporte) resultado.transporte = transporte;

      return resultado;

    } catch (error) {
      this._error('createWithPedidos', error, { numero_TO: dados?.numero_TO, origem: dados?.origem_hub_id, destino: dados?.destino_hub_id });

      if (createdHere && transaction && !transaction.finished && !rollbackAttempted) {
        rollbackAttempted = true;
        try { await transaction.rollback(); } catch (rollbackError) {
          this._error('Rollback da transação', rollbackError);
        }
      }

      throw new Error(`Erro ao criar transferência: ${error.message}`);
    }
  }

  /**
   * Inicia transporte da transferência
   * Altera pedidos para EM_ROTA (status válido)
   */
  async iniciarTransporte(id) {
    const transaction = await db.sequelize.transaction();
    let rollbackAttempted = false;

    try {
      this._log(`Iniciando transporte da transferência: ${id}`);

      const transferencia = await db.Transferencias.findByPk(id, {
        include: [
          { model: db.Pedidos, as: 'pedidos' },
          { model: db.Transportes, as: 'transportes' }
        ],
        transaction
      });

      if (!transferencia) throw new Error(`Transferência ${id} não encontrada`);
      if (transferencia.status !== 'CRIADO') {
        throw new Error(`Só é possível iniciar transporte de transferências com status CRIADO. Status atual: ${transferencia.status}`);
      }
      if (!transferencia.pedidos || transferencia.pedidos.length === 0) {
        throw new Error('Não é possível iniciar transporte sem pedidos associados');
      }

      const pedidosInvalidos = transferencia.pedidos.filter(p => !PEDIDO_STATUS_VALIDOS_PARA_TRANSFERENCIA.includes(p.status));
      if (pedidosInvalidos.length > 0) {
        throw new Error(`Pedidos com status inválido: ${pedidosInvalidos.map(p => p.id).join(', ')}`);
      }

      transferencia.status = 'EM_TRANSPORTE';
      transferencia.data_inicio = new Date();
      await transferencia.save({ transaction });

      if (transferencia.transportes && transferencia.transportes.length > 0) {
        for (const transporte of transferencia.transportes) {
          transporte.status_transporte = 'EM_TRANSPORTE';
          transporte.data_inicio = new Date();
          await transporte.save({ transaction });
        }
      }

      await db.Pedidos.update(
        { status: 'EM_ROTA' },
        { where: { transferencia_id: id }, transaction }
      );

      this._log(`${transferencia.pedidos.length} pedidos atualizados para EM_ROTA`);

      await transaction.commit();
      this._log(`Transporte iniciado para transferência ${id}`);

      return await this.getById(id);

    } catch (error) {
      this._error('iniciarTransporte', error, { transferenciaId: id });

      if (!rollbackAttempted && transaction && !transaction.finished) {
        rollbackAttempted = true;
        try { await transaction.rollback(); } catch (rollbackError) {
          this._error('Rollback da transação', rollbackError);
        }
      }

      throw new Error(`Erro ao iniciar transporte: ${error.message}`);
    }
  }

  /**
   * Conclui transferência
   */
  async concluirTransferencia(id) {
    const transaction = await db.sequelize.transaction();
    let rollbackAttempted = false;

    try {
      this._log(`Concluindo transferência: ${id}`);

      const transferencia = await db.Transferencias.findByPk(id, {
        include: [
          { model: db.Pedidos, as: 'pedidos' },
          { model: db.Transportes, as: 'transportes' }
        ],
        transaction
      });

      if (!transferencia) throw new Error(`Transferência ${id} não encontrada`);
      if (transferencia.status === 'RECEBIDO') throw new Error('Transferência já está concluída');
      if (transferencia.status !== 'EM_TRANSPORTE') {
        throw new Error(`Só é possível concluir transferências em transporte. Status atual: ${transferencia.status}`);
      }

      transferencia.status = 'RECEBIDO';
      transferencia.data_conclusao = new Date();
      await transferencia.save({ transaction });

      if (transferencia.transportes && transferencia.transportes.length > 0) {
        for (const transporte of transferencia.transportes) {
          transporte.status_transporte = 'RECEBIDO';
          transporte.data_conclusao = new Date();
          await transporte.save({ transaction });
        }
      }

      if (transferencia.pedidos && transferencia.pedidos.length > 0) {
        const pedidoIds = transferencia.pedidos.map(p => p.id);
        await db.Pedidos.update(
          { status: 'ENTREGUE' },
          { where: { id: pedidoIds }, transaction }
        );

        for (const pedido of transferencia.pedidos) {
          await db.Rastreamentos.create({
            pedido_id: pedido.id,
            status_atual: 'ENTREGUE',
            data_status: new Date(),
            localizacao: `Hub ${transferencia.destino_hub_id}`,
            observacao: 'Transferência concluída'
          }, { transaction });
        }
      }

      await transaction.commit();
      this._log(`Transferência ${id} concluída com sucesso`);

      return {
        message: "Transferência concluída com sucesso",
        transferencia: await this.getById(id),
        totalPedidos: transferencia.pedidos?.length || 0
      };

    } catch (error) {
      this._error('concluirTransferencia', error, { transferenciaId: id });

      if (!rollbackAttempted && transaction && !transaction.finished) {
        rollbackAttempted = true;
        try { await transaction.rollback(); } catch (rollbackError) {
          this._error('Rollback da transação', rollbackError);
        }
      }

      throw new Error(`Erro ao concluir transferência: ${error.message}`);
    }
  }

  /**
   * Cancela transferência
   */
  async cancelarTransferencia(id, motivo) {
    const transaction = await db.sequelize.transaction();
    let rollbackAttempted = false;

    try {
      this._log(`Cancelando transferência: ${id}, motivo: ${motivo || 'Não informado'}`);

      const transferencia = await db.Transferencias.findByPk(id, {
        include: [
          { model: db.Pedidos, as: 'pedidos' },
          { model: db.Transportes, as: 'transportes' }
        ],
        transaction
      });

      if (!transferencia) throw new Error(`Transferência ${id} não encontrada`);
      if (['RECEBIDO', 'CANCELADO'].includes(transferencia.status)) {
        throw new Error(`Não é possível cancelar uma transferência com status ${transferencia.status}`);
      }

      transferencia.status = 'CANCELADO';
      await transferencia.save({ transaction });

      if (transferencia.transportes && transferencia.transportes.length > 0) {
        for (const transporte of transferencia.transportes) {
          transporte.status_transporte = 'CANCELADO';
          await transporte.save({ transaction });
        }
      }

      if (transferencia.pedidos && transferencia.pedidos.length > 0) {
        const pedidoIds = transferencia.pedidos.map(p => p.id);
        await db.Pedidos.update(
          {
            status: 'VALIDADO',
            transferencia_id: null,
            transporte_id: null
          },
          { where: { id: pedidoIds }, transaction }
        );
      }

      await transaction.commit();
      this._log(`Transferência ${id} cancelada`);

      return await this.getById(id);

    } catch (error) {
      this._error('cancelarTransferencia', error, { transferenciaId: id });

      if (!rollbackAttempted && transaction && !transaction.finished) {
        rollbackAttempted = true;
        try { await transaction.rollback(); } catch (rollbackError) {
          this._error('Rollback da transação', rollbackError);
        }
      }

      throw new Error(`Erro ao cancelar transferência: ${error.message}`);
    }
  }

  /**
   * Adiciona pedidos a uma transferência existente
   */
  async adicionarPedidos(id, pedidosIds) {
    const transaction = await db.sequelize.transaction();
    let rollbackAttempted = false;

    try {
      this._log(`Adicionando ${pedidosIds.length} pedidos à transferência ${id}`);

      const transferencia = await db.Transferencias.findByPk(id, {
        include: [{ model: db.Transportes, as: 'transportes' }],
        transaction
      });
      if (!transferencia) throw new Error(`Transferência ${id} não encontrada`);
      if (!['CRIADO'].includes(transferencia.status)) {
        throw new Error(`Só é possível adicionar pedidos a transferências com status CRIADO. Status atual: ${transferencia.status}`);
      }

      const pedidos = await db.Pedidos.findAll({
        where: { id: pedidosIds.map(id => Number(id)) },
        transaction
      });
      if (pedidos.length !== pedidosIds.length) {
        const encontrados = pedidos.map(p => p.id);
        const naoEncontrados = pedidosIds.filter(id => !encontrados.includes(Number(id)));
        throw new Error(`Pedidos não encontrados: ${naoEncontrados.join(', ')}`);
      }

      const pedidosEmOutraTransferencia = await db.Pedidos.findAll({
        where: {
          id: pedidosIds.map(id => Number(id)),
          transferencia_id: { [Op.not]: null, [Op.ne]: id }
        },
        transaction
      });
      if (pedidosEmOutraTransferencia.length > 0) {
        throw new Error(`Pedidos já associados a outra transferência: ${pedidosEmOutraTransferencia.map(p => p.id).join(', ')}`);
      }

      const pedidosInvalidos = pedidos.filter(p => !PEDIDO_STATUS_VALIDOS_PARA_TRANSFERENCIA.includes(p.status));
      if (pedidosInvalidos.length > 0) {
        throw new Error(`Pedidos com status inválido: ${pedidosInvalidos.map(p => p.id).join(', ')}`);
      }

      await db.Pedidos.update(
        { transferencia_id: id },
        { where: { id: pedidosIds.map(id => Number(id)) }, transaction }
      );

      if (transferencia.transportes && transferencia.transportes.length > 0) {
        const transporte = transferencia.transportes[0];
        await db.Pedidos.update(
          { transporte_id: transporte.id },
          { where: { id: pedidosIds.map(id => Number(id)) }, transaction }
        );
      }

      const totalPedidos = await db.Pedidos.count({ where: { transferencia_id: id }, transaction });
      transferencia.quantidade = totalPedidos;
      await transferencia.save({ transaction });

      if (transferencia.transportes && transferencia.transportes.length > 0) {
        const transporte = transferencia.transportes[0];
        transporte.quantidade_total = totalPedidos;
        await transporte.save({ transaction });
      }

      await transaction.commit();
      return await this.getById(id);

    } catch (error) {
      this._error('adicionarPedidos', error, { transferenciaId: id, pedidosIds });

      if (!rollbackAttempted && transaction && !transaction.finished) {
        rollbackAttempted = true;
        try { await transaction.rollback(); } catch (rollbackError) {
          this._error('Rollback da transação', rollbackError);
        }
      }

      throw new Error(`Erro ao adicionar pedidos: ${error.message}`);
    }
  }

  /**
   * Remove pedidos de uma transferência
   */
  async removerPedidos(id, pedidosIds) {
    const transaction = await db.sequelize.transaction();
    let rollbackAttempted = false;

    try {
      this._log(`Removendo ${pedidosIds.length} pedidos da transferência ${id}`);

      const transferencia = await db.Transferencias.findByPk(id, { transaction });
      if (!transferencia) throw new Error(`Transferência ${id} não encontrada`);
      if (!['CRIADO'].includes(transferencia.status)) {
        throw new Error(`Só é possível remover pedidos de transferências com status CRIADO. Status atual: ${transferencia.status}`);
      }

      await db.Pedidos.update(
        {
          transferencia_id: null,
          transporte_id: null,
          status: 'VALIDADO'
        },
        {
          where: {
            id: pedidosIds.map(id => Number(id)),
            transferencia_id: id
          },
          transaction
        }
      );

      const totalPedidos = await db.Pedidos.count({ where: { transferencia_id: id }, transaction });
      transferencia.quantidade = totalPedidos;
      await transferencia.save({ transaction });

      const transportes = await db.Transportes.findAll({ where: { transferencia_id: id }, transaction });
      for (const transporte of transportes) {
        transporte.quantidade_total = totalPedidos;
        await transporte.save({ transaction });
      }

      await transaction.commit();
      return await this.getById(id);

    } catch (error) {
      this._error('removerPedidos', error, { transferenciaId: id, pedidosIds });

      if (!rollbackAttempted && transaction && !transaction.finished) {
        rollbackAttempted = true;
        try { await transaction.rollback(); } catch (rollbackError) {
          this._error('Rollback da transação', rollbackError);
        }
      }

      throw new Error(`Erro ao remover pedidos: ${error.message}`);
    }
  }

  /**
   * Cria transferência a partir de um recebimento
   */
  async createFromRecebimento(recebimentoId) {
    const transaction = await db.sequelize.transaction();
    let rollbackAttempted = false;

    try {
      this._log(`Criando transferência a partir do recebimento ${recebimentoId}`);

      const recebimento = await db.Recebimentos.findByPk(recebimentoId, {
        include: [{ model: db.Pedidos, as: 'pedidos' }],
        transaction
      });
      if (!recebimento) throw new Error(`Recebimento ${recebimentoId} não encontrado`);

      const transferencia = await db.Transferencias.create({
        numero_TO: `TO-REC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        origem_hub_id: recebimento.hub_id,
        destino_hub_id: null,
        motorista_id: null,
        quantidade: recebimento.pedidos?.length || 0,
        direcao: 'OUTBOUND',
        status: 'CRIADO',
        data_criacao: new Date()
      }, { transaction });

      if (recebimento.pedidos && recebimento.pedidos.length > 0) {
        const pedidoIds = recebimento.pedidos.map(p => p.id);
        await db.Pedidos.update(
          { transferencia_id: transferencia.id },
          { where: { id: pedidoIds }, transaction }
        );
      }

      await transaction.commit();
      return await this.getById(transferencia.id);

    } catch (error) {
      this._error('createFromRecebimento', error, { recebimentoId });

      if (!rollbackAttempted && transaction && !transaction.finished) {
        rollbackAttempted = true;
        try { await transaction.rollback(); } catch (rollbackError) {
          this._error('Rollback da transação', rollbackError);
        }
      }

      throw new Error(`Erro ao criar transferência a partir do recebimento: ${error.message}`);
    }
  }

  /**
   * Busca todas as transferências com filtros
   */
  async getAllTransferencias(filters = {}) {
    try {
      this._log('Buscando todas as transferências', { filters });

      const { status, direcao, numero_TO, data_inicio, data_fim, origem_hub_id, destino_hub_id } = filters;
      const where = {};

      if (status) where.status = status;
      if (direcao) where.direcao = direcao;
      if (numero_TO) where.numero_TO = { [Op.iLike]: `%${numero_TO}%` };
      if (origem_hub_id) where.origem_hub_id = origem_hub_id;
      if (destino_hub_id) where.destino_hub_id = destino_hub_id;
      if (data_inicio && data_fim) {
        where.data_criacao = { [Op.between]: [new Date(data_inicio), new Date(data_fim)] };
      }

      const transferencias = await db.Transferencias.findAll({
        where,
        include: [
          { model: db.Hubs, as: 'origemHub', attributes: ['id', 'nome', 'codigo_hub'] },
          { model: db.Hubs, as: 'destinoHub', attributes: ['id', 'nome', 'codigo_hub'] },
          { model: db.Motoristas, attributes: ['id', 'nome', 'veiculo'] },
          { model: db.Usuarios, as: 'operador', attributes: ['id', 'nome', 'email'] },
          { model: db.Conferencias, as: 'conferencias', attributes: ['id', 'status', 'data_criacao'] },
          {
            model: db.Pedidos,
            as: 'pedidos',
            attributes: ['id', 'codigo_pedido', 'status'],
            include: [
              { model: db.Clientes, as: 'clientes', attributes: ['id', 'nome'] },
              { model: db.Produtos, as: 'produtos', attributes: ['id', 'nome'] } // ✅ apenas campos existentes
            ]
          },
          { model: db.Transportes, as: 'transportes', attributes: ['id', 'numero_transporte', 'status_transporte'] },
          { model: db.Manifestos, as: 'manifestos', attributes: ['id', 'numero_manifesto'] }
        ],
        order: [['data_criacao', 'DESC']]
      });

      this._log(`Encontradas ${transferencias.length} transferências`);
      return transferencias;
    } catch (error) {
      this._error('getAllTransferencias', error, { filters });
      throw new Error(`Erro ao buscar transferências: ${error.message}`);
    }
  }

  /**
   * Busca transferência por ID com relacionamentos
   */
  async getById(id) {
    try {
      this._log(`Buscando transferência por ID: ${id}`);

      const transferencia = await db.Transferencias.findByPk(id, {
        include: [
          {
            model: db.Hubs,
            as: 'origemHub',
            attributes: ['id', 'nome', 'codigo_hub'],
            include: [
              {
                model: db.Enderecos,
                as: 'enderecos',
                attributes: ['rua', 'numero', 'bairro', 'cidade', 'estado', 'cep'],
                required: false
              }
            ]
          },
          {
            model: db.Hubs,
            as: 'destinoHub',
            attributes: ['id', 'nome', 'codigo_hub'],
            include: [
              {
                model: db.Enderecos,
                as: 'enderecos',
                attributes: ['rua', 'numero', 'bairro', 'cidade', 'estado', 'cep'],
                required: false
              }
            ]
          },
          { model: db.Motoristas, attributes: ['id', 'nome', 'veiculo', 'telefone'] },
          { model: db.Usuarios, as: 'operador', attributes: ['id', 'nome', 'email', 'status'] },
          { model: db.Conferencias, as: 'conferencias', attributes: ['id', 'status', 'data_criacao', 'data_termino'] },
          {
            model: db.Pedidos,
            as: 'pedidos',
            attributes: ['id', 'codigo_pedido', 'status'],
            include: [
              { model: db.Clientes, as: 'clientes', attributes: ['id', 'nome', 'telefone', 'email'] },
              { model: db.Produtos, as: 'produtos', attributes: ['id', 'nome', 'peso_kg'] }, // ✅ 'codigo' removido
              { model: db.Enderecos, as: 'enderecos', attributes: ['id', 'rua', 'numero', 'bairro', 'cidade', 'estado', 'cep'] }
            ]
          },
          {
            model: db.Transportes,
            as: 'transportes',
            include: [
              { model: db.Motoristas, attributes: ['id', 'nome', 'veiculo'] }
            ]
          },
          {
            model: db.Manifestos,
            as: 'manifestos',
            include: [
              {
                model: db.NotasFiscais,
                as: 'nota',
                include: [
                  {
                    model: db.NotasItens,
                    as: 'notaItens',
                    include: [
                      { model: db.Produtos, as: 'produtos', attributes: ['id', 'nome'] } // ✅ 'codigo' removido
                    ]
                  }
                ]
              }
            ]
          }
        ]
      });

      if (!transferencia) {
        this._log(`Transferência ${id} não encontrada`, null, 'warn');
        throw new Error(`Transferência ${id} não encontrada`);
      }

      this._log(`Transferência ${id} encontrada com ${transferencia.pedidos?.length || 0} pedidos`);
      return transferencia;
    } catch (error) {
      this._error('getById', error, { transferenciaId: id });
      throw new Error(`Erro ao buscar transferência ID ${id}: ${error.message}`);
    }
  }

  /**
   * Busca pedidos de uma transferência
   */
  async getPedidosByTransferencia(id) {
    try {
      this._log(`Buscando pedidos da transferência: ${id}`);

      const transferencia = await db.Transferencias.findByPk(id, {
        include: [{
          model: db.Pedidos,
          as: 'pedidos',
          include: [
            { model: db.Clientes, as: 'clientes', attributes: ['id', 'nome', 'telefone', 'email'] },
            { model: db.Produtos, as: 'produtos', attributes: ['id', 'nome', 'peso_kg'] }, // ✅ 'codigo' removido
            { model: db.Enderecos, as: 'enderecos', attributes: ['id', 'rua', 'bairro', 'cidade', 'estado', 'cep'] }
          ]
        }]
      });

      if (!transferencia) throw new Error(`Transferência ${id} não encontrada`);

      return transferencia.pedidos || [];
    } catch (error) {
      this._error('getPedidosByTransferencia', error, { transferenciaId: id });
      throw new Error(`Erro ao buscar pedidos da transferência: ${error.message}`);
    }
  }

  /**
   * Associa motorista a transferência e aos transportes relacionados
   */
  async associarMotorista(id, motoristaId) {
    const transaction = await db.sequelize.transaction();
    let rollbackAttempted = false;

    try {
      this._log(`Associando motorista ${motoristaId} à transferência ${id}`);

      const transferencia = await db.Transferencias.findByPk(id, { transaction });
      if (!transferencia) throw new Error(`Transferência ${id} não encontrada`);

      const motorista = await db.Motoristas.findByPk(Number(motoristaId), { transaction });
      if (!motorista) throw new Error(`Motorista ${motoristaId} não encontrado`);
      if (motorista.ativo !== true) throw new Error(`Motorista ${motoristaId} não está ativo`);

      transferencia.motorista_id = motoristaId;
      await transferencia.save({ transaction });

      const transportes = await db.Transportes.findAll({ where: { transferencia_id: id }, transaction });
      for (const transporte of transportes) {
        transporte.motorista_id = motoristaId;
        await transporte.save({ transaction });
      }

      await transaction.commit();
      return await this.getById(id);

    } catch (error) {
      this._error('associarMotorista', error, { transferenciaId: id, motoristaId });

      if (!rollbackAttempted && transaction && !transaction.finished) {
        rollbackAttempted = true;
        try { await transaction.rollback(); } catch (rollbackError) {
          this._error('Rollback da transação', rollbackError);
        }
      }

      throw new Error(`Erro ao associar motorista: ${error.message}`);
    }
  }

  /**
   * Busca transferências por período
   */
  async getTransferenciasPorPeriodo(dataInicio, dataFim) {
    try {
      this._log(`Buscando transferências por período: ${dataInicio} até ${dataFim}`);

      const where = {};
      if (dataInicio && dataFim) {
        where.data_criacao = { [Op.between]: [new Date(dataInicio), new Date(dataFim)] };
      }

      const transferencias = await db.Transferencias.findAll({
        where,
        include: [
          { model: db.Hubs, as: 'origemHub', attributes: ['id', 'nome', 'codigo_hub'] },
          { model: db.Hubs, as: 'destinoHub', attributes: ['id', 'nome', 'codigo_hub'] },
          { model: db.Motoristas, attributes: ['id', 'nome', 'veiculo'] },
          { model: db.Usuarios, as: 'operador', attributes: ['id', 'nome', 'email'] }
        ],
        order: [['data_criacao', 'DESC']]
      });

      this._log(`Encontradas ${transferencias.length} transferências no período`);
      return transferencias;
    } catch (error) {
      this._error('getTransferenciasPorPeriodo', error, { dataInicio, dataFim });
      throw new Error(`Erro ao buscar transferências por período: ${error.message}`);
    }
  }

  /**
   * Estatísticas gerais de transferências
   */
  async getEstatisticas() {
    try {
      this._log('Buscando estatísticas de transferências');

      const total = await db.Transferencias.count();

      const porStatus = await db.Transferencias.findAll({
        attributes: ['status', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'quantidade']],
        group: ['status']
      });

      const porDirecao = await db.Transferencias.findAll({
        attributes: ['direcao', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'quantidade']],
        group: ['direcao']
      });

      const porHubOrigem = await db.Transferencias.findAll({
        attributes: [
          'origem_hub_id',
          [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'quantidade']
        ],
        include: [{ model: db.Hubs, as: 'origemHub', attributes: ['nome'] }],
        group: ['origem_hub_id', 'origemHub.nome'],
        limit: 10,
        order: [[db.sequelize.literal('quantidade'), 'DESC']]
      });

      return { total, porStatus, porDirecao, porHubOrigem };
    } catch (error) {
      this._error('getEstatisticas', error);
      throw new Error(`Erro ao buscar estatísticas: ${error.message}`);
    }
  }

  /**
   * Retorna lista de hubs disponíveis (ativos)
   */
  async getHubsDisponiveis() {
    try {
      this._log('Buscando hubs disponíveis');
      const hubs = await db.Hubs.findAll({
        attributes: ['id', 'nome', 'codigo_hub', 'endereco_id', 'status'],
        where: { status: 'ATIVO' }
      });
      this._log(`Encontrados ${hubs.length} hubs disponíveis`);
      return hubs;
    } catch (error) {
      this._error('getHubsDisponiveis', error);
      throw new Error(`Erro ao buscar hubs disponíveis: ${error.message}`);
    }
  }

  /**
   * Retorna lista de motoristas disponíveis (ativos)
   */
  async getMotoristasDisponiveis() {
    try {
      this._log('Buscando motoristas disponíveis');
      const motoristas = await db.Motoristas.findAll({
        attributes: ['id', 'nome', 'veiculo', 'telefone', 'cnh'],
        where: { ativo: true }
      });
      this._log(`Encontrados ${motoristas.length} motoristas disponíveis`);
      return motoristas;
    } catch (error) {
      this._error('getMotoristasDisponiveis', error);
      throw new Error(`Erro ao buscar motoristas disponíveis: ${error.message}`);
    }
  }

  /**
   * Pesquisa transferências por termo (número, status, hub)
   */
  async searchTransferencias(query, page = 1, limit = 10) {
    try {
      this._log(`Buscando transferências: "${query}", página ${page}, limite ${limit}`);

      const offset = (page - 1) * limit;
      const queryNumero = !isNaN(query) ? parseInt(query) : 0;

      const { count, rows } = await db.Transferencias.findAndCountAll({
        where: {
          [Op.or]: [
            { id: { [Op.eq]: queryNumero } },
            { numero_TO: { [Op.iLike]: `%${query}%` } },
            { status: { [Op.iLike]: `%${query}%` } },
            { '$origemHub.nome$': { [Op.iLike]: `%${query}%` } },
            { '$destinoHub.nome$': { [Op.iLike]: `%${query}%` } }
          ]
        },
        include: [
          { model: db.Hubs, as: 'origemHub', attributes: ['id', 'nome', 'codigo_hub'] },
          { model: db.Hubs, as: 'destinoHub', attributes: ['id', 'nome', 'codigo_hub'] }
        ],
        order: [['data_criacao', 'DESC']],
        limit: parseInt(limit),
        offset,
        distinct: true
      });

      return {
        transferencias: rows,
        total: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit
      };
    } catch (error) {
      this._error('searchTransferencias', error, { query, page, limit });
      throw new Error(`Erro na busca de transferências: ${error.message}`);
    }
  }

  /**
   * Atualiza dados parciais de uma transferência (apenas campos permitidos)
   */
  async atualizarTransferencia(id, dados) {
    const transaction = await db.sequelize.transaction();
    let rollbackAttempted = false;

    try {
      this._log(`Atualizando transferência ${id}`, dados);

      const transferencia = await db.Transferencias.findByPk(id, { transaction });
      if (!transferencia) throw new Error(`Transferência ${id} não encontrada`);

      const camposPermitidos = ['motorista_id', 'tipo_recebedor', 'destino_hub_id', 'origem_hub_id'];
      const dadosAtualizacao = {};
      camposPermitidos.forEach(campo => {
        if (dados[campo] !== undefined) dadosAtualizacao[campo] = dados[campo];
      });

      if (dados.motorista_id) {
        const motorista = await db.Motoristas.findByPk(dados.motorista_id, { transaction });
        if (!motorista) throw new Error(`Motorista ${dados.motorista_id} não encontrado`);
        if (motorista.ativo !== true) throw new Error(`Motorista ${dados.motorista_id} não está ativo`);
      }
      if (dados.origem_hub_id) {
        const hubOrigem = await db.Hubs.findByPk(dados.origem_hub_id, { transaction });
        if (!hubOrigem) throw new Error(`Hub de origem ${dados.origem_hub_id} não encontrado`);
      }
      if (dados.destino_hub_id) {
        const hubDestino = await db.Hubs.findByPk(dados.destino_hub_id, { transaction });
        if (!hubDestino) throw new Error(`Hub de destino ${dados.destino_hub_id} não encontrado`);
      }

      await transferencia.update(dadosAtualizacao, { transaction });

      const transportes = await db.Transportes.findAll({ where: { transferencia_id: id }, transaction });
      for (const transporte of transportes) {
        await transporte.update(dadosAtualizacao, { transaction });
      }

      await transaction.commit();
      return await this.getById(id);

    } catch (error) {
      this._error('atualizarTransferencia', error, { transferenciaId: id, dados });

      if (!rollbackAttempted && transaction && !transaction.finished) {
        rollbackAttempted = true;
        try { await transaction.rollback(); } catch (rollbackError) {
          this._error('Rollback da transação', rollbackError);
        }
      }

      throw new Error(`Erro ao atualizar transferência: ${error.message}`);
    }
  }

  /**
   * Busca transferências por status com paginação
   */
  async getByStatus(status, page = 1, limit = 20) {
    try {
      this._log(`Buscando transferências com status: ${status}, página ${page}`);

      const offset = (page - 1) * limit;
      const { count, rows } = await db.Transferencias.findAndCountAll({
        where: { status },
        include: [
          { model: db.Hubs, as: 'origemHub', attributes: ['id', 'nome', 'codigo_hub'] },
          { model: db.Hubs, as: 'destinoHub', attributes: ['id', 'nome', 'codigo_hub'] },
          { model: db.Motoristas, attributes: ['id', 'nome'] }
        ],
        order: [['data_criacao', 'DESC']],
        limit: parseInt(limit),
        offset,
        distinct: true
      });

      return {
        transferencias: rows,
        total: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit
      };
    } catch (error) {
      this._error('getByStatus', error, { status, page, limit });
      throw new Error(`Erro ao buscar transferências por status: ${error.message}`);
    }
  }

  /**
   * Exporta dados de transferências com filtros (para relatórios)
   */
  async exportarTransferencias(filters = {}) {
    try {
      this._log('Exportando transferências', { filters });

      const { data_inicio, data_fim, status, origem_hub_id, destino_hub_id } = filters;
      const where = {};

      if (status) where.status = status;
      if (origem_hub_id) where.origem_hub_id = origem_hub_id;
      if (destino_hub_id) where.destino_hub_id = destino_hub_id;
      if (data_inicio && data_fim) {
        where.data_criacao = { [Op.between]: [new Date(data_inicio), new Date(data_fim)] };
      }

      const transferencias = await db.Transferencias.findAll({
        where,
        include: [
          { model: db.Hubs, as: 'origemHub', attributes: ['id', 'nome', 'codigo_hub', 'endereco_id'] },
          { model: db.Hubs, as: 'destinoHub', attributes: ['id', 'nome', 'codigo_hub', 'endereco_id'] },
          { model: db.Motoristas, attributes: ['id', 'nome', 'veiculo', 'telefone'] },
          { model: db.Usuarios, as: 'operador', attributes: ['id', 'nome', 'email'] },
          {
            model: db.Pedidos,
            as: 'pedidos',
            attributes: ['id', 'codigo_pedido', 'status'],
            include: [
              { model: db.Clientes, as: 'clientes', attributes: ['nome', 'telefone'] }
            ]
          }
        ],
        order: [['data_criacao', 'DESC']]
      });

      const dadosExportacao = transferencias.map(t => ({
        id: t.id,
        numero_TO: t.numero_TO,
        status: t.status,
        origem: t.origemHub ? `${t.origemHub.nome} (${t.origemHub.codigo_hub})` : 'N/A',
        destino: t.destinoHub ? `${t.destinoHub.nome} (${t.destinoHub.codigo_hub})` : 'N/A',
        motorista: t.Motorista ? t.Motorista.nome : 'N/A',
        quantidade_pedidos: t.quantidade,
        data_criacao: t.data_criacao,
        data_inicio: t.data_inicio,
        data_conclusao: t.data_conclusao,
        operador: t.operador ? t.operador.nome : 'N/A',
        pedidos: t.pedidos ? t.pedidos.map(p => ({
          codigo: p.codigo_pedido,
          status: p.status,
          cliente: p.clientes ? p.clientes.nome : 'N/A'
        })) : []
      }));

      this._log(`Exportados dados de ${dadosExportacao.length} transferências`);
      return dadosExportacao;
    } catch (error) {
      this._error('exportarTransferencias', error, { filters });
      throw new Error(`Erro ao exportar transferências: ${error.message}`);
    }
  }
}

module.exports = TransferenciaServices;