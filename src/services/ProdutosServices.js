const Services = require('./Services');

class ProdutosServices extends Services {
  constructor() {
    super('Produtos');
  }

  async getPedidoByProduto(pedidoId, produtos) {
    return await this.db.Pedidos.findOne(produtos, { where: { id_pedido: Number(pedidoId) } });
  }
}

module.exports = ProdutosServices;
