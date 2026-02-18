const {RastreamentosServices} = require('../services');
const rastreamentosServices = new RastreamentosServices();

class RastreamentoController {

  static async getAllRastreamento(req, res) {
    try {
      const rastreamentos = await rastreamentosServices.getAllRegisters();
      return res.status(200).json(rastreamentos);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  static async getRastreamentoByID(req, res) {
    try {
      const { id } = req.params;
      const rastreamento = await rastreamentosServices.getById(id);

      if (!rastreamento) {
        return res.status(404).json({ message: "Rastreamento não encontrado." });
      }

      return res.status(200).json(rastreamento);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  static async createRastreamento(req, res) {
    try {
      const novoRastreamento = await rastreamentosServices.createRegister(req.body);
      return res.status(201).json(novoRastreamento);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  static async updateRastreamento(req, res) {
    try {
      const { id } = req.params;
      const atualizado = await rastreamentosServices.update(id, req.body);

      if (!atualizado) {
        return res.status(404).json({ message: "Rastreamento não encontrado para atualizar." });
      }

      return res.status(200).json({ message: "Rastreamento atualizado com sucesso.", atualizado });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  static async deleteRastreamento(req, res) {
    try {
      const { id } = req.params;
      const deletado = await rastreamentosServices.delete(id);

      if (!deletado) {
        return res.status(404).json({ message: "Rastreamento não encontrado para exclusão." });
      }

      return res.status(200).json({ message: `Rastreamento ${id} excluído com sucesso.` });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

}

module.exports = RastreamentoController;
