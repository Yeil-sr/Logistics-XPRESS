const { RecebimentoServices } = require('../services');
const recebimentoServices = new RecebimentoServices();
const db = require('../models')

class RecebimentoController {
  static async getAllRecebimentos(req, res) {
      try {
       const recebimentos = await db.Recebimento.findAll({
        include: [
          {
            model: db.Usuario, as:'usuarios',
            attributes: ['nome']
          }
        ]
      });
  
        return res.status(200).json(recebimentos);
      } catch (error) {
        return res.status(500).json({ message: error.message });
      }
    }
  static async getById(req, res) {
    try {
      const { id } = req.params;
      const data = await recebimentoServices.getById(id);
      if (!data) return res.status(404).json({ message: "Recebimento não encontrado" });
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

static async create(req, res) {
  try {
    const novo = await recebimentoServices.createWithPedidos(req.body);
    return res.status(201).json(novo);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}


  static async update(req, res) {
    try {
      const { id } = req.params;
      const updated = await recebimentoServices.updateRegister(req.body, id);
      return res.status(200).json(updated);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      await recebimentoServices.deleteRegister(id);
      return res.status(200).json({ message: `Recebimento ${id} removido com sucesso.` });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async concluirRecebimento(req, res) {
    try {
      const { id } = req.params;
      const recebimento = await recebimentoServices.concluirRecebimento(id);
      return res.status(200).json({
        message: 'Recebimento concluído com sucesso',
        recebimento
      });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async getPedidos(req, res) {
    try {
      const { id } = req.params;
      const pedidos = await recebimentoServices.getPedidosByRecebimento(id);
      return res.status(200).json(pedidos);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async countPedidos(req, res) {
      try {
          const { id } = req.params;
          const count = await db.Pedidos.count({
              where: { recebimento_id: id }
          });
          return res.status(200).json({ count });
      } catch (error) {
          return res.status(500).json({ error: error.message });
      }
  }
}

module.exports = RecebimentoController;
