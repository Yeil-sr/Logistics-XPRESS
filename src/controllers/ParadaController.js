const {ParadasServices} = require('../services');
const paradasServices = new ParadasServices();

class ParadaController {

  static async getAllParadas(req, res) {
    try {
      const paradas = await paradasServices.getAllRegisters();
      return res.status(200).json(paradas);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async getParadaByID(req, res) {
    try {
      const { id } = req.params;
      const parada = await paradasServices.getParadaByID(id);

      if (!parada) {
        return res.status(404).json({ message: "Parada não encontrada." });
      }

      return res.status(200).json(parada);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async createParada(req, res) {
    const { pedidoId, rotaId } = req.params;

    try {
      const resultado = await paradasServices.createParadaComValidacao(pedidoId, rotaId);
      return res.status(201).json(resultado);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async updateParada(req, res) {
    const { id } = req.params;
    const paradaAtualizada = req.body;

    try {
      const parada = await paradasServices.updateRegister(paradaAtualizada, id);
      return res.status(200).json(parada);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async deleteParada(req, res) {
    const { id } = req.params;

    try {
      await paradasServices.deleteRegister(id);
      return res.status(200).json({ message: `Parada de ID ${id} removida com sucesso.` });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}

module.exports = ParadaController;
