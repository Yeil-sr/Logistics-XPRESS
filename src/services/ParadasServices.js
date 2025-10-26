const Services = require('./Services');
const db = require('../models');

class ParadasServices extends Services {
  constructor() {
    super('Parada');
  }

  async getParadaByID(id) {
    return this.getOneRegister({ id: Number(id) });
  }

  async atualizarStatus(idParada, statusNovo) {
    const parada = await db.Parada.findByPk(idParada, {
      include: [{ model: db.Pedidos, as: 'pedido' }]
    });
    if (!parada) throw new Error('Parada não encontrada');

    const statusPermitidos = ['PENDENTE', 'EM_ANDAMENTO', 'ENTREGUE', 'CANCELADA'];
    if (!statusPermitidos.includes(statusNovo)) {
      throw new Error(`Status inválido. Permitidos: ${statusPermitidos.join(', ')}`);
    }

    parada.status_parada = statusNovo;
    await parada.save();

    if (parada.pedido) {
      let statusRastreamento = statusNovo === 'ENTREGUE' ? 'DELIVERED' : statusNovo;
      await db.Rastreamento.create({
        id_pedido: parada.pedido.id,
        status_atual: statusRastreamento,
        data_status: new Date(),
        localizacao: statusNovo === 'ENTREGUE' ? 'Cliente' : 'Em transporte'
      });
    }

    return parada;
  }

  async getParadasByPedido(idPedido) {
    return db.Parada.findAll({
      where: { id_pedido: idPedido },
      include: [
        { model: db.Rota, as: 'rota' },
        { model: db.Pedidos, as: 'pedido' }
      ]
    });
  }

  gerarCodigoGaiola(tipoVeiculo, tamanhoProduto) {
    let letra;

    if (tamanhoProduto === 'pequeno') {
      letra = tipoVeiculo.toLowerCase() === 'moto' ? 'A' : 'B';
    } else if (tamanhoProduto === 'medio') {
      letra = tipoVeiculo.toLowerCase() === 'carro' ? 'C' : 'D';
    } else {
      letra = 'E';
    }

    const numero = Math.floor(Math.random() * 40) + 1;
    return `${letra}${numero < 10 ? '0' + numero : numero}`;
  }
}

module.exports = ParadasServices;
