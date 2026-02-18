const { ProdutosServices } = require('../services');
const produtosServices = new ProdutosServices();

class ProdutoController {
  // GET /produtos
  static async getAllProdutos(req, res) {
    try {
      const produtos = typeof produtosServices.getAllRegisters === 'function'
        ? await produtosServices.getAllRegisters(req.query)
        : await produtosServices.getAll ? await produtosServices.getAll(req.query) : [];
      return res.status(200).json(produtos);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // GET /produtos/:id
  static async getProdutoByID(req, res) {
    const { id } = req.params;
    try {
      const produto = typeof produtosServices.getOneRegister === 'function'
        ? await produtosServices.getOneRegister({ id: Number(id) })
        : await produtosServices.getById ? await produtosServices.getById(Number(id)) : null;

      if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
      return res.status(200).json(produto);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // POST /produtos
  static async createProduto(req, res) {
    const produtoData = req.body;
    try {
      const novoProduto = await produtosServices.createProduto(produtoData);
      return res.status(201).json(novoProduto);
    } catch (error) {
      const status = /obrig|não encontrado|Hubs não encontrados|Campo nome é obrigatório/i.test(error.message) ? 400 : 500;
      return res.status(status).json({ error: error.message });
    }
  }

  // PUT /produtos/:id
  static async updateProduto(req, res) {
    const { id } = req.params;
    const produtoInfo = req.body;
    try {
      const updatedProduto = await produtosServices.updateProduto(Number(id), produtoInfo);
      return res.status(200).json({ message: 'Produto atualizado com sucesso', data: updatedProduto });
    } catch (error) {
      const status = /não encontrado|Hubs não encontrados/i.test(error.message) ? 404 : 400;
      return res.status(status).json({ error: error.message });
    }
  }

  // DELETE /produtos/:id
  static async deleteProduto(req, res) {
    const { id } = req.params;
    try {
      const result = await produtosServices.deleteProduto(Number(id));
      return res.status(200).json({ message: 'Produto excluído com sucesso', result });
    } catch (error) {
      // se tentativa de deletar com estoque -> 400
      const status = /Não é possível excluir produto com estoque físico/i.test(error.message) ? 400 : 500;
      return res.status(status).json({ error: error.message });
    }
  }

  // GET /produtos/:id/pedido  
  static async getPedidoByProduto(req, res) {
    const { pedidoId } = req.params;
    const produtos = req.body;
    try {
      const produto = await produtosServices.getPedidoByProduto(pedidoId, produtos);
      if (!produto) return res.status(404).json({ message: 'Produto não encontrado!' });
      return res.status(200).json(produto);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  //  GET /produtos/:id/summary -> resumo do estoque para frontend
  static async getSummary(req, res) {
    const { id } = req.params;
    const { hub_id } = req.query;
    try {
      const summary = await produtosServices.getSummary(Number(id), hub_id ? Number(hub_id) : null);
      return res.status(200).json(summary);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}

module.exports = ProdutoController;
