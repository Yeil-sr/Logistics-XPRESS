const {ColetasServices} = require('../services');
const coletasServices = new ColetasServices();

class ColetaController {
  static async getAllColetas(req, res) {
    try {
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'DESC', ...filters } = req.query;
      
      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder: sortOrder.toUpperCase(),
        filters
      };

      const data = await coletasServices.getAllWithFilters(options);
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  static async getColetaByID(req, res) {
    try {
      const { id } = req.params;
      const coleta = await coletasServices.getOneRegister({ id: Number(id) });

      if (!coleta) return res.status(404).json({ message: 'Coleta não encontrada.' });
      return res.status(200).json(coleta);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  static async createColeta(req, res) {
    try {
      const novaColeta = await coletasServices.createRegister(req.body);
      return res.status(201).json(novaColeta);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  }

  static async marcarComoColetado(req, res) {
    const { id } = req.params;

    try {
      const coleta = await coletasServices.marcarComoColetado(id);
      return res.status(200).json({
        message: 'Coleta realizada com sucesso',
        coleta
      });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  static async getPendentes(req, res) {
    try {
      const coletas = await coletasServices.getColetasPendentes();
      return res.status(200).json(coletas);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  static async updateColeta(req, res) {
    try {
      const { id } = req.params;
      const coletaAtualizada = await coletasServices.updateRegister(req.body, id);

      if (!coletaAtualizada) return res.status(404).json({ message: 'Coleta não encontrada.' });
      return res.status(200).json(coletaAtualizada);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  static async deleteColeta(req, res) {
    try {
      const { id } = req.params;
      const coleta = await coletasServices.deleteRegister(id);

      if (!coleta) return res.status(404).json({ message: 'Coleta não encontrada.' });
      return res.status(200).json({ message: `Coleta ID ${id} removida com sucesso.` });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
}

module.exports = ColetaController;