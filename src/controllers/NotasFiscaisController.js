const { NotasFiscaisServices } = require('../services');
const notasService = new NotasFiscaisServices();

class NotasFiscaisController {
  static async getAll(req, res) {
    try {
      const filters = {};
      if (req.query.pedido_id) filters.pedido_id = Number(req.query.pedido_id);
      if (req.query.numero) filters.numero = req.query.numero;
      if (req.query.manifesto_id) filters.manifesto_id = Number(req.query.manifesto_id);

      const notas = await notasService.getAll(filters);
      return res.status(200).json(notas);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async getOne(req, res) {
    try {
      const id = Number(req.params.id);
      const nota = await notasService.getById(id);
      if (!nota) return res.status(404).json({ error: 'Nota não encontrada' });
      return res.status(200).json(nota);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async create(req, res) {
    try {
      const payload = req.body;
      const nota = await notasService.createNotaComItens(payload);
      return res.status(201).json(nota);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async update(req, res) {
    try {
      const id = Number(req.params.id);
      const updates = req.body;
      const nota = await notasService.updateNota(id, updates);
      return res.status(200).json(nota);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async remove(req, res) {
    try {
      const id = Number(req.params.id);
      await notasService.deleteNota(id);
      return res.status(200).json({ success: true, message: 'Nota fiscal deletada com sucesso' });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async getByPedido(req, res) {
    try {
      const pedidoId = Number(req.params.pedidoId);
      const notas = await notasService.getByPedidoId(pedidoId);
      return res.status(200).json(notas);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async getItens(req, res) {
    try {
      const id = Number(req.params.id);
      const nota = await notasService.getById(id);
      if (!nota) return res.status(404).json({ error: 'Nota não encontrada' });
      
      return res.status(200).json(nota.notasItens);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}

module.exports = NotasFiscaisController;