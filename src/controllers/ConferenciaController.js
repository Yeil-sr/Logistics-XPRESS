const { ConferenciaServices } = require('../services');
const conferenciaServices = new ConferenciaServices();

class ConferenciaController {
  static async getAll(req, res) {
    try {
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'DESC', ...filters } = req.query;
      
      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder: sortOrder.toUpperCase(),
        filters
      };

      const data = await conferenciaServices.getAllWithFilters(options);
      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const conferencia = await conferenciaServices.getById(id);
      if (!conferencia) return res.status(404).json({ message: "Conferência não encontrada" });
      res.status(200).json(conferencia);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async create(req, res) {
    try {
      const conferencia = await conferenciaServices.createComPedidos(req.body);
      res.status(201).json(conferencia);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const updated = await conferenciaServices.updateRegister(req.body, id);
      res.status(200).json(updated);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      await conferenciaServices.deleteRegister(id);
      res.status(200).json({ message: `Conferência ${id} removida com sucesso.` });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async concluirConferencia(req, res) {
    try {
      const { id } = req.params;
      const dados = req.body || {};
      const conferencia = await conferenciaServices.concluirConferencia(id, dados);
      res.status(200).json({ 
        message: 'Conferência concluída com sucesso', 
        conferencia 
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getPedidos(req, res) {
    try {
      const { id } = req.params;
      const pedidos = await conferenciaServices.getPedidosByConferencia(id);
      res.status(200).json(pedidos);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async validarPedido(req, res) {
    try {
      const { id, pedidoId } = req.params;
      const result = await conferenciaServices.validarPedido(id, pedidoId);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async invalidarPedido(req, res) {
    try {
      const { id, pedidoId } = req.params;
      const result = await conferenciaServices.invalidarPedido(id, pedidoId);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async getPedidosValidados(req, res) {
    try {
      const { id } = req.params;
      const pedidosValidados = await conferenciaServices.getPedidosValidados(id);
      return res.status(200).json(pedidosValidados);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async associarPedido(req, res) {
    try {
      const { id } = req.params;
      const { pedidoId } = req.body;
      const result = await conferenciaServices.associarPedido(id, pedidoId);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async search(req, res) {
    try {
      const { query, page = 1, limit = 10 } = req.query;
      const result = await conferenciaServices.searchConferencias(query, parseInt(page), parseInt(limit));
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = ConferenciaController;