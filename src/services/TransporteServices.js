const Services = require('./Services');
const db = require('../models');
const { Op } = require('sequelize');

class TransporteServices extends Services {
  constructor() {
    super('Transporte');
  }

  async getAllTransportes(filters = {}) {
    const { status, tipo, direcao, numero } = filters;
    const where = {};

    if (status) where.status_transporte = status;
    if (tipo) where.tipo_transporte = tipo;
    if (direcao) where.direcao = direcao;
    if (numero) where.numero_transporte = { [Op.like]: `%${numero}%` };

    return await db.Transporte.findAll({
      where,
      include: [
        { model: db.Hubs, as: 'hubOrigem', attributes: ['id', 'nome'] },
        { model: db.Hubs, as: 'hubDestino', attributes: ['id', 'nome'] },
        { model: db.Motorista, as: 'motorista', attributes: ['id', 'nome', 'veiculo'] },
        { model: db.Conferencia, as: 'conferencia', attributes: ['id', 'status', 'nome_estacao'] },
        { model: db.Rota, as: 'rota' }
      ],
      order: [['data_criacao', 'DESC']]
    });
  }

  async getById(id) {
    return await db.Transporte.findByPk(id, {
      include: [
        { model: db.Motorista, as: 'motorista' },
        { model: db.Hubs, as: 'hubOrigem' },
        { model: db.Hubs, as: 'hubDestino' },
        { model: db.Conferencia, as: 'conferencia', attributes: ['id', 'status', 'nome_estacao'] },
        { model: db.Rota, as: 'rota' }
      ]
    });
  }

  async createTransporteComTransferencia(dados) {
    const transaction = await db.sequelize.transaction();
    try {
      const numeroTransporte = "TO" + Date.now();

      const transferencia = await db.Transferencia.create({
        numero_TO: numeroTransporte,
        motorista_id: dados.motorista_id,
        origem_hub_id: dados.origem_hub_id,
        destino_hub_id: dados.destino_hub_id,
        tipo_recebedor: dados.tipo_recebedor || 'HUB',
        quantidade: dados.quantidade || 0,
        peso_kg: dados.peso_kg || 0,
        direcao: dados.direcao || 'OUTBOUND',
        operador_id: dados.operador_id,
        status: 'CRIADO',
        data_criacao: new Date()
      }, { transaction });

      const transporte = await db.Transporte.create({
        ...dados,
        numero_transporte: numeroTransporte,
        id_transferencia: transferencia.id,
        status_transporte: 'CRIADO',
        data_criacao: new Date()
      }, { transaction });

      const rota = await db.Rota.create({
        id_motorista: dados.motorista_id,
        cluster: 'A DEFINIR',
        status_rota: 'CRIADA',
        data_criacao: new Date()
      }, { transaction });

      transporte.rota_id = rota.id;
      await transporte.save({ transaction });

      await transaction.commit();
      return { transporte, transferencia, rota };

    } catch (error) {
      if (transaction && !transaction.finished) await transaction.rollback();
      throw error;
    }
  }

  async updateTransporte(id, dados) {
    return await this.updateRegister(dados, id);
  }

  async deleteTransporte(id) {
    return await this.deleteRegister(id);
  }

  async getPedidos(idTransporte) {
    const transporte = await db.Transporte.findByPk(idTransporte, {
      include: [
        {
          model: db.Pedidos,
          as: 'pedidos',
          include: [
            { model: db.Clientes, as: 'cliente' },
            { model: db.Produtos, as: 'produto' },
            { model: db.Endereco, as: 'endereco' }
          ]
        }
      ]
    });

    if (!transporte) throw new Error('Transporte não encontrado');
    return transporte.pedidos;
  }

  async atribuirMotorista(idTransporte, idMotorista) {
    const transporte = await db.Transporte.findByPk(idTransporte);
    if (!transporte) throw new Error('Transporte não encontrado');

    const motorista = await db.Motorista.findByPk(idMotorista);
    if (!motorista) throw new Error('Motorista não encontrado');

    transporte.motorista_id = idMotorista;
    await transporte.save();
    return transporte;
  }

  async atualizarStatus(idTransporte, statusNovo) {
    const transaction = await db.sequelize.transaction();

    try {
      const transporte = await db.Transporte.findByPk(idTransporte, {
        include: [{ model: db.Rota, as: 'rota' }],
        transaction
      });
      if (!transporte) throw new Error('Transporte não encontrado');

      this.validarTransicaoStatus(transporte.status_transporte, statusNovo);

      transporte.status_transporte = statusNovo;

      if (statusNovo === 'EM_TRANSPORTE') {
        transporte.data_inicio = new Date();
      } else if (['RECEBIDO', 'ENTREGUE', 'CANCELADO'].includes(statusNovo)) {
        transporte.data_conclusao = new Date();
      }

      await transporte.save({ transaction });

      if (transporte.rota) {
        await this.atualizarStatusRota(transporte.rota, statusNovo, transaction);
      }

      await this.atualizarStatusPedidos(idTransporte, statusNovo, transaction);

      await transaction.commit();
      return transporte;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
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

  async atualizarStatusRota(rota, statusTransporte, transaction) {
    if (statusTransporte === 'EM_TRANSPORTE') {
      rota.status_rota = 'EM_ANDAMENTO';
      rota.data_inicio = new Date();
    } else if (['RECEBIDO', 'ENTREGUE'].includes(statusTransporte)) {
      rota.status_rota = 'FINALIZADA';
      rota.data_conclusao = new Date();
    } else if (statusTransporte === 'CANCELADO') {
      rota.status_rota = 'CANCELADA';
      rota.data_conclusao = new Date();
    }
    await rota.save({ transaction });
  }

  async atualizarStatusPedidos(idTransporte, statusNovo, transaction) {
    const pedidos = await db.Pedidos.findAll({
      where: { transporte_id: idTransporte },
      transaction
    });

    for (const pedido of pedidos) {
      const { novoStatusPedido, statusRastreamento, localizacao, observacao } = 
        this.mapearStatusPedido(statusNovo, idTransporte, pedido.id);

      await pedido.update({ status: novoStatusPedido }, { transaction });

      await db.Rastreamento.create({
        id_pedido: pedido.id,
        status_atual: statusRastreamento,
        data_status: new Date(),
        localizacao,
        observacao
      }, { transaction });

      if (statusNovo === 'CANCELADO') {
        await this.criarExcecaoCancelamento(pedido.id, idTransporte, transaction);
      }
    }
  }

  mapearStatusPedido(statusTransporte, idTransporte, pedidoId) {
    const mapeamento = {
      'EM_TRANSPORTE': {
        statusPedido: 'EM_ROTA',
        rastreamento: 'IN_TRANSIT',
        localizacao: 'Em transporte',
        observacao: `Transporte ${idTransporte} iniciado`
      },
      'RECEBIDO': {
        statusPedido: 'ENTREGUE',
        rastreamento: 'DELIVERED',
        localizacao: 'Cliente',
        observacao: `Transporte ${idTransporte} finalizado`
      },
      'ENTREGUE': {
        statusPedido: 'ENTREGUE',
        rastreamento: 'DELIVERED',
        localizacao: 'Cliente',
        observacao: `Transporte ${idTransporte} finalizado`
      },
      'CANCELADO': {
        statusPedido: 'CANCELADO',
        rastreamento: 'CANCELLED',
        localizacao: 'Hub',
        observacao: `Transporte ${idTransporte} cancelado`
      }
    };

    return mapeamento[statusTransporte] || {
      statusPedido: 'PENDENTE',
      rastreamento: 'PENDING',
      localizacao: 'Hub',
      observacao: `Status do transporte atualizado para ${statusTransporte}`
    };
  }

  async criarExcecaoCancelamento(pedidoId, transporteId, transaction) {
    const numeroOcorrencia = "EXC-" + Date.now();
    await db.Excecao.create({
      numero_ocorrencia: numeroOcorrencia,
      tipo: 'TRANSPORTE',
      gravidade: 'MEDIA',
      titulo: `Cancelamento do transporte ${transporteId}`,
      descricao: `Pedido ${pedidoId} impactado pelo cancelamento`,
      pedido_id: pedidoId,
      transporte_id: transporteId,
      criador_id: 1, // sistema
      data_ocorrencia: new Date(),
      status: 'ABERTA'
    }, { transaction });
  }

  async iniciarTransporte(idTransporte) {
    const transaction = await db.sequelize.transaction();
    try {
      const transporte = await db.Transporte.findByPk(idTransporte, {
        include: [
          { model: db.Motorista, as: 'motorista' },
          { model: db.Pedidos, as: 'pedidos' },
          { model: db.Transferencia, as: 'transferencia' },
          { model: db.Rota, as: 'rota' }
        ],
        transaction
      });

      if (!transporte) throw new Error('Transporte não encontrado');
      this.validarInicioTransporte(transporte);

      transporte.status_transporte = 'EM_TRANSPORTE';
      transporte.data_inicio = new Date();
      await transporte.save({ transaction });

      if (transporte.transferencia) {
        transporte.transferencia.status = 'EM_TRANSPORTE';
        transporte.transferencia.data_inicio = new Date();
        await transporte.transferencia.save({ transaction });
      }

      if (!transporte.rota) throw new Error('Rota não encontrada para o transporte');
      transporte.rota.status_rota = 'EM_ANDAMENTO';
      transporte.rota.data_inicio = new Date();
      await transporte.rota.save({ transaction });

      await this.criarParadasRota(transporte, transaction);

      await transaction.commit();
      return transporte;
    } catch (error) {
      if (transaction && !transaction.finished) await transaction.rollback();
      throw error;
    }
  }

  validarInicioTransporte(transporte) {
    if (transporte.status_transporte !== 'CRIADO') {
      throw new Error('Só é possível iniciar transportes com status CRIADO');
    }
    if (!transporte.motorista) {
      throw new Error('Não é possível iniciar transporte sem motorista atribuído');
    }
  }

  async criarParadasRota(transporte, transaction) {
    let ordem = await db.Parada.count({ where: { id_rota: transporte.rota.id }, transaction }) + 1;
    
    for (const pedido of transporte.pedidos) {
      if (pedido.status !== 'VALIDADO') continue;

      const paradaExistente = await db.Parada.findOne({
        where: { id_rota: transporte.rota.id, id_pedido: pedido.id },
        transaction
      });

      if (!paradaExistente) {
        await pedido.update({ status: 'EM_ROTA' }, { transaction });

        await db.Rastreamento.create({
          id_pedido: pedido.id,
          status_atual: 'EM_ROTA',
          data_status: new Date(),
          localizacao: 'Em transporte'
        }, { transaction });

        await db.Parada.create({
          id_rota: transporte.rota.id,
          id_pedido: pedido.id,
          ordem_entrega: ordem++,
          status_parada: 'PENDENTE'
        }, { transaction });
      }
    }

    await transporte.rota.update({ numero_paradas: ordem - 1 }, { transaction });
  }

  async associarConferencia(idTransporte, idConferencia) {
    const transaction = await db.sequelize.transaction();

    try {
      const transporte = await db.Transporte.findByPk(idTransporte, { transaction });
      if (!transporte) throw new Error('Transporte não encontrado');

      const conferencia = await db.Conferencia.findByPk(idConferencia, { transaction });
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
      await transaction.rollback();
      throw error;
    }
  }

  async validarAssociacaoConferencia(conferencia, idTransporte, transaction) {
    if (conferencia.transporte_id && conferencia.transporte_id !== parseInt(idTransporte)) {
      throw new Error('Esta conferência já está associada a outro transporte');
    }

    const conferenciasExistentes = await db.Conferencia.findAll({
      where: { transporte_id: idTransporte },
      transaction
    });

    if (conferenciasExistentes.length > 0) {
      throw new Error(`Já existe uma conferência associada a este transporte`);
    }
  }

  async removerAssociacaoConferencia(idTransporte, idConferencia) {
    const transaction = await db.sequelize.transaction();

    try {
      const transporte = await db.Transporte.findByPk(idTransporte, { transaction });
      if (!transporte) throw new Error('Transporte não encontrado');

      const conferencia = await db.Conferencia.findByPk(idConferencia, { transaction });
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
      await transaction.rollback();
      throw error;
    }
  }

  async getConferenciasAssociadas(idTransporte) {
    return await db.Conferencia.findAll({
      where: { transporte_id: idTransporte },
      include: [
        {
          model: db.Usuario,
          as: 'operador',
          attributes: ['id', 'nome']
        }
      ]
    });
  }

  async getConferenciasDisponiveis() {
    return await db.Conferencia.findAll({
      where: {
        transporte_id: null,
      },
      attributes: ['id', 'status', 'nome_estacao']
    });
  }

  async getHubs() {
    return await db.Hubs.findAll({
      attributes: ['id', 'nome']
    });
  }

  async atribuirRota(idTransporte, idRota) {
    const transaction = await db.sequelize.transaction();
    
    try {
      const transporte = await db.Transporte.findByPk(idTransporte, { transaction });
      if (!transporte) throw new Error('Transporte não encontrado');

      const rota = await db.Rota.findByPk(idRota, { transaction });
      if (!rota) throw new Error('Rota não encontrada');

      await this.validarAssociacaoRota(rota, idTransporte, transaction);

      transporte.rota_id = idRota;
      await transporte.save({ transaction });

      await transaction.commit();
      return transporte;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async validarAssociacaoRota(rota, idTransporte, transaction) {
    const transporteComRota = await db.Transporte.findOne({
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
    
    try {
      const transporte = await db.Transporte.findByPk(transporteId, { transaction });
      if (!transporte) throw new Error("Transporte não encontrado");

      if (transporte.rota_id) {
        throw new Error("Este transporte já possui uma rota associada");
      }

      const rota = await db.Rota.create({
        cluster: dados.cluster || `Rota-${transporte.numero_transporte}`,
        id_motorista: dados.id_motorista || transporte.motorista_id,
        status_rota: "CRIADA",
        numero_paradas: 0,
        data_criacao: new Date()
      }, { transaction });

      if (dados.pedidos && Array.isArray(dados.pedidos) && dados.pedidos.length > 0) {
        await this.criarParadas(rota.id, dados.pedidos, transaction);
        await rota.update({ numero_paradas: dados.pedidos.length }, { transaction });
      }

      await transporte.update({ rota_id: rota.id }, { transaction });

      const transporteAtualizado = await db.Transporte.findByPk(transporteId, {
        include: [
          { model: db.Motorista, as: 'motorista' },
          { model: db.Hubs, as: 'hubOrigem' },
          { model: db.Hubs, as: 'hubDestino' },
          { model: db.Rota, as: 'rota' }
        ],
        transaction
      });

      await transaction.commit();
      return {
        transporte: transporteAtualizado,
        rota
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async criarParadas(rotaId, pedidosIds, transaction) {
    let ordem = 1;
    for (const pedidoId of pedidosIds) {
      await db.Parada.create({
        id_rota: rotaId,
        id_pedido: pedidoId,
        ordem_entrega: ordem++,
        status_parada: "PENDENTE"
      }, { transaction });
    }
  }

  async getMotoristasDisponiveis() {
    return await db.Motorista.findAll({
      attributes: ['id', 'nome', 'veiculo', 'status']
    });
  }

  async getPedidosParaRota(transporteId) {
    const transporte = await db.Transporte.findByPk(transporteId, {
      include: [{
        model: db.Pedidos,
        as: 'pedidos',
        attributes: ['id']
      }]
    });

    if (!transporte) throw new Error("Transporte não encontrado");

    const pedidosAssociados = transporte.pedidos.map(p => p.id);

    return await db.Pedidos.findAll({
      where: {
        id: pedidosAssociados.length > 0 ? pedidosAssociados : { [Op.ne]: null },
        status: 'VALIDADO'
      },
      include: [
        {
          model: db.Clientes,
          as: 'cliente',
          attributes: ['id', 'nome']
        },
        {
          model: db.Produtos,
          as: 'produto',
          attributes: ['id', 'nome']
        },
        {
          model: db.Endereco,
          as: 'endereco',
          attributes: ['id', 'cidade', 'estado']
        }
      ],
      attributes: ['id', 'codigo_pedido', 'status']
    });
  }

  async getRotasDisponiveis() {
    return await db.Rota.findAll({
      where: {
        status_rota: ['CRIADA', 'EM_ANDAMENTO']
      },
      include: [
        {
          model: db.Motorista,
          as: 'motorista',
          attributes: ['id', 'nome', 'veiculo']
        }
      ],
      attributes: ['id', 'cluster', 'status_rota', 'numero_paradas', 'data_criacao']
    });
  }
}

module.exports = TransporteServices;