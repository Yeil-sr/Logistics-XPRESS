const {ProdutosServices} = require('../services');
const produtosServices = new ProdutosServices();

class ProdutoController {

  static async getAllProdutos(req, res) {
    try {
      const produtos = await produtosServices.getAllRegisters();
      return res.status(200).json(produtos);
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }

  static async getProdutoByID(req, res) {
    const { id } = req.params;
    try {
      const produto = await produtosServices.getOneRegister({ id: Number(id) });
      return res.status(200).json(produto);
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }

  static async createProduto(req, res) {
    const produtoData = req.body;
    try {
      const newProduto = await produtosServices.createRegister(produtoData);
      return res.status(201).json(newProduto);
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }

  static async updateProduto(req, res) {
    const { id } = req.params;
    const produtoInfo = req.body;
    try {
      const updatedProduto = await produtosServices.updateRegister(produtoInfo, id);
      return res.status(200).json({ message: `Produto atualizado com sucesso`, data: updatedProduto });
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }

  static async deleteProduto(req, res) {
    const { id } = req.params;
    try {
      await produtosServices.deleteRegister(id);
      return res.status(200).json({ message: `Produto excluído com sucesso!` });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async getPedidoByProduto(req, res) {
    const { pedidoId } = req.params;
    const produtos = req.body;

    try {
      const produto = await produtosServices.getPedidoByProduto(pedidoId, produtos);
      if (!produto) {
        return res.status(404).json({ message: 'Produto não encontrado!' });
      }
      return res.status(200).json(produto);
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }
}

module.exports = ProdutoController;
