const {HubsServices} = require('../services');
const hubsServices = new HubsServices();

class HubController {
  static async getAllHubs(req, res) {
    try {
      const hubs = await hubsServices.getAllHubs();
      return res.status(200).json(hubs);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async getHubById(req, res) {
    const { id } = req.params;
    try {
      const hub = await hubsServices.getHubById(id);
      
      if (!hub) {
        return res.status(404).json({ message: "Hub não encontrado." });
      }

      return res.status(200).json(hub);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async createHub(req, res) {
    try {
      const novoHub = await hubsServices.createHub(req.body);
      return res.status(201).json(novoHub);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async updateHub(req, res) {
    const { id } = req.params;
    const infoHub = req.body;
    try {
      const hubAtualizado = await hubsServices.updateHub(id, infoHub);
      return res.status(200).json(hubAtualizado);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async deleteHub(req, res) {
    const { id } = req.params;
    try {
      await hubsServices.deleteHub(id);
      return res.status(200).json({ message: `Hub ${id} deletado com sucesso.` });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}

module.exports = HubController;
