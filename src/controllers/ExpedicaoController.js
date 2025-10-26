const {ExpedicoesServices} = require('../services');
const expedicoesServices = new ExpedicoesServices();

class ExpedicaoController {
  static async getAllExpedicoes(req, res) {
    try {
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'DESC', ...filters } = req.query;
      
      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder: sortOrder.toUpperCase(),
        filters
      };

      const data = await expedicoesServices.getAllWithFilters(options);
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }

  static async getExpedicaoByID(req, res) {
    try {
      const { id } = req.params;
      const expedicao = await expedicoesServices.getOneRegister({ id: Number(id) });

      if (!expedicao) {
        return res.status(404).json({ message: 'Expedição não encontrada.' });
      }

      return res.status(200).json(expedicao);
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }

  static async createExpedicao(req, res) {
    try {
      const { pedidoId } = req.params;
      
      const resultado = await expedicoesServices.createExpedicaoComPedido(pedidoId);
      return res.status(201).json(resultado);
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }

  static async updateExpedicao(req, res) {
    try {
      const { id } = req.params;
      const infoAtualizada = req.body;

      const expedicaoAtualizada = await expedicoesServices.updateRegister(infoAtualizada, id);
      return res.status(200).json(expedicaoAtualizada);
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }

  static async deleteExpedicao(req, res) {
    try {
      const { id } = req.params;
      await expedicoesServices.deleteRegister(id);
      return res.status(200).json({ message: `Expedição ${id} deletada com sucesso.` });
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }
}

module.exports = ExpedicaoController;