const { RotaServices, ParadasServices } = require('../services');
const rotaServices = new RotaServices();
const paradaServices = new ParadasServices();

class RotaController {
  static async getAll(req, res) {
    try {
      const data = await rotaServices.getAllRegisters();
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const data = await rotaServices.getById(id);
      if (!data) return res.status(404).json({ message: "Rota não encontrada" });
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async getPedidosDisponiveis(req, res) {
  try {
    const pedidos = await rotaServices.getPedidosDisponiveis();
    return res.status(200).json(pedidos);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

  static async create(req, res) {
    try {
      const newRegister = await rotaServices.createComParadas(req.body);
      return res.status(201).json(newRegister);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const updated = await rotaServices.updateRegister(req.body, id);
      return res.status(200).json(updated);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      await rotaServices.deleteRegister(id);
      return res.status(200).json({ message: `Rota ${id} removida com sucesso.` });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async finalizarRota(req, res) {
    try {
      const { id } = req.params;
      const rota = await rotaServices.atualizarStatus(id, 'FINALIZADA');
      return res.status(200).json({ message: "Rota finalizada com sucesso", rota });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async getParadas(req, res) {
    try {
      const { id } = req.params;
      const rota = await rotaServices.getById(id);
      if (!rota) return res.status(404).json({ message: "Rota não encontrada" });
      return res.status(200).json(rota.paradas || []);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
  static async getRotasDisponiveisParaTransportes(req, res) {
    try {
        const rotasDisponiveis = await rotaServices.getRotasDisponiveisParaTransportes();
        return res.status(200).json(rotasDisponiveis);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
async getRotasDisponiveisParaTransportes() {
    return db.Rota.findAll({
        where: {
            status_rota: ['CRIADA', 'EM_ANDAMENTO'],
            id: {
                [db.Sequelize.Op.notIn]: db.sequelize.literal(
                    `(SELECT rota_id FROM Transporte WHERE rota_id IS NOT NULL)`
                )
            }
        },
        include: [
            { model: db.Motorista, as: 'motorista', attributes: ['id', 'nome'] }
        ],
        order: [['createdAt', 'DESC']]
    });
}

}

module.exports = RotaController;
