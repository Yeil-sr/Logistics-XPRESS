const Services = require('./Services');
const db = require('../models');

class TransferenciaServices extends Services {
  constructor() {
    super('Transferencia');
  }

  async getById(id) {
    return db.Transferencia.findByPk(id, {
      include: [
        { model: db.Hubs, as: 'origemHub' },
        { model: db.Hubs, as: 'destinoHub' },
        { model: db.Motorista},
        { model: db.Pedidos, as: 'pedidos' }
      ]
    });
  }

  async getPedidosByTransferencia(id) {
    const transferencia = await db.Transferencia.findByPk(id, {
      include: [{ model: db.Pedidos, as: 'pedidos' }]
    });
    if (!transferencia) throw new Error('Transferência não encontrada');
    return transferencia.pedidos;
  }

  async createTransferencia(){
    const transaction = await db.sequelize.transaction();

    try {
      const { pedidosCodigos = [], ...dadosTransferencia } = dados;

      const newTransferencia = await db.Transferencia.create({
        ...dadosTransferencia,
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
          { transferencia_id: newTransferencia.id },
          { where: { codigo_pedido: pedidosCodigos }, transaction }
        );
      }

      newTransferencia.quantidade_pedidos = pedidos.length;
      await newTransferencia.save({ transaction });

      await transaction.commit();

      return {
        message: "Transferencia criada com sucesso",
        transferencia: newTransferencia,
        pedidosVinculados: pedidos
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async createFromRecebimento(recebimentoId) {
    const recebimento = await db.Recebimento.findByPk(recebimentoId);
    if (!recebimento) throw new Error('Recebimento não encontrado');

    return db.Transferencia.create({
      numero_TO: `TO-${Date.now()}`,
      origem_hub_id: null, 
      destino_hub_id: null, 
      motorista_id: null,
      quantidade: recebimento.quantidade_pedidos,
      direcao: 'INBOUND',
      status: 'CRIADO'
    });
  }

  async concluirTransferencia(id) {
    const transferencia = await db.Transferencia.findByPk(id, {
      include: [{ model: db.Pedidos, as: 'pedidos' }]
    });
    if (!transferencia) throw new Error('Transferência não encontrada');

    transferencia.status = 'RECEBIDO';
    transferencia.data_conclusao = new Date();
    await transferencia.save();

    await db.Pedidos.update(
      { status: 'PROCESSANDO' },
      { where: { transferencia_id: id } }
    );

    for (const pedido of transferencia.pedidos) {
      await db.Rastreamento.create({
        pedido_id: pedido.id,
        status_atual: 'RECEIVED',
        data_status: new Date(),
        localizacao: 'Hub destino'
      });
    }

    return transferencia;
  }
}

module.exports = TransferenciaServices;
