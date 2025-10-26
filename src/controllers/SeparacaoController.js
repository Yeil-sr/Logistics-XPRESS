const db = require('../models');
const {SeparacoesServices} = require('../services');
const separacoesServices = new SeparacoesServices();

class SeparacaoController {
  static async getAllSeparacoes(req, res) {
    try {
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'DESC', ...filters } = req.query;
      
      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder: sortOrder.toUpperCase(),
        filters
      };

      const data = await separacoesServices.getAllWithFilters(options);
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }

  static async getSeparacaoByID(req, res) {
    const { id } = req.params;

    try {
      const separacao = await separacoesServices.getOneRegister({ id: Number(id) });
      return res.status(200).json(separacao);
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }

  static async getPedidosBySeparacao(req, res) {
    try {
      const { id } = req.params;
      const pedidos = await separacoesServices.getPedidosBySeparacao(id);
      return res.status(200).json(pedidos);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async createSeparacao(req, res) {
    const { pedidoId } = req.params;

    try {
      const novaSeparacao = await separacoesServices.criarSeparacaoComPedido(pedidoId, db.Pedidos);
      return res.status(201).json({
        message: 'Pedido separado com sucesso!',
        separacao: novaSeparacao
      });
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }

  static async marcarComoSeparado(req, res) {
    const { id } = req.params;

    try {
      const separacao = await separacoesServices.marcarComoSeparado(id);
      return res.status(200).json({
        message: 'Separação concluída e coleta criada',
        separacao
      });
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }

  static async getPendentes(req, res) {
    try {
      const separacoes = await separacoesServices.getPedidosPendentes();
      return res.status(200).json(separacoes);
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }

  static async updateSeparacao(req, res) {
    const { id } = req.params;
    const separacaoInfo = req.body;

    try {
      const separacaoAtualizada = await separacoesServices.updateRegister(separacaoInfo, id);
      return res.status(200).json(separacaoAtualizada);
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }

  static async deleteSeparacao(req, res) {
    const { id } = req.params;

    try {
      await separacoesServices.deleteRegister(id);
      return res.status(200).json({ message: `Separação ${id} deletada com sucesso.` });
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }
}

module.exports = SeparacaoController;