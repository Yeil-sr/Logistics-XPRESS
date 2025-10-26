const Services = require('./Services');
const db = require('../models');

class RastreamentoServices extends Services {
  constructor() {
    super('Rastreamento');
  }

  async criarEvento(pedido_id, status_atual, localizacao) {
    return db.Rastreamento.create({
      pedido_id,
      status_atual,
      localizacao,
      data_status: new Date()
    });
  }
}

module.exports = RastreamentoServices;
