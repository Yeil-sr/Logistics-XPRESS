const { PedidoItensServices } = require('../services');
const pedidoItensService = new PedidoItensServices();

class PedidoItensController {
  static async getAll(req, res) {
    try {
      const filters = {};
      if (req.query.pedido_id) filters.pedido_id = Number(req.query.pedido_id);
      if (req.query.produto_id) filters.produto_id = Number(req.query.produto_id);

      const itens = await pedidoItensService.getAll(filters);
      return res.status(200).json(itens);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async getOne(req, res) {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'id inválido' });
      const item = await pedidoItensService.getById(id);
      if (!item) return res.status(404).json({ error: 'Item não encontrado' });
      return res.status(200).json(item);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async getByPedido(req, res) {
    try {
      const pedidoId = Number(req.params.pedidoId);
      if (Number.isNaN(pedidoId)) return res.status(400).json({ error: 'pedidoId inválido' });
      const itens = await pedidoItensService.getByPedidoId(pedidoId);
      return res.status(200).json(itens);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async create(req, res) {
    try {
      const payload = req.body;
      const item = await pedidoItensService.createItem(payload);
      return res.status(201).json(item);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async bulkCreate(req, res) {
    try {
      const pedidoId = Number(req.params.pedidoId);
      const { itens } = req.body;
      
      if (!Array.isArray(itens)) {
        return res.status(400).json({ error: 'itens precisa ser um array' });
      }

      const payload = itens.map(i => ({
        pedido_id: pedidoId,
        produto_id: i.produto_id,
        descricao: i.descricao || null,
        quantidade: i.quantidade || 1,
        valor_unitario: i.valor_unitario || 0,
        valor_total: (Number(i.quantidade || 0) * Number(i.valor_unitario || 0))
      }));

      const created = await pedidoItensService.bulkCreateItens(payload);
      return res.status(201).json(created);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async update(req, res) {
    try {
      const id = Number(req.params.id);
      const updates = req.body;
      const updated = await pedidoItensService.updateItem(id, updates);
      return res.status(200).json(updated);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async remove(req, res) {
    try {
      const id = Number(req.params.id);
      await pedidoItensService.deleteItem(id);
      return res.status(200).json({ success: true, message: 'Item deletado com sucesso' });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }
}

module.exports = PedidoItensController;