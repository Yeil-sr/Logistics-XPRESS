const { NotasItensServices } = require('../services');
const notasItensService = new NotasItensServices();

class NotasItensController {
  static async getAll(req, res) {
    try {
      const filters = {};
      if (req.query.nota_id) filters.nota_id = Number(req.query.nota_id);
      if (req.query.produto_id) filters.produto_id = Number(req.query.produto_id);

      const itens = await notasItensService.getAll(filters);
      return res.status(200).json(itens);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async getOne(req, res) {
    try {
      const id = Number(req.params.id);
      const item = await notasItensService.getById(id);
      if (!item) return res.status(404).json({ error: 'Item não encontrado' });
      return res.status(200).json(item);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async create(req, res) {
    try {
      const payload = req.body;
      const item = await notasItensService.createItem(payload);
      return res.status(201).json(item);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async update(req, res) {
    try {
      const id = Number(req.params.id);
      const updates = req.body;
      const updated = await notasItensService.updateItem(id, updates);
      return res.status(200).json(updated);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async remove(req, res) {
    try {
      const id = Number(req.params.id);
      await notasItensService.deleteItem(id);
      return res.status(200).json({ success: true, message: 'Item deletado com sucesso' });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async getByNota(req, res) {
    try {
      const notaId = Number(req.params.notaId);
      const itens = await notasItensService.getByNotaId(notaId);
      return res.status(200).json(itens);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async bulkCreate(req, res) {
    try {
      const { itens } = req.body;
      if (!Array.isArray(itens)) {
        return res.status(400).json({ error: 'itens deve ser um array' });
      }

      const created = await notasItensService.bulkCreate(itens);
      return res.status(201).json(created);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }
}

module.exports = NotasItensController;