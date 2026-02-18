const { TransporteServices } = require('../services');

class TransporteController {
  constructor() {
    this.transporteServices = new TransporteServices();
  }

  static async getAll(req, res) {
    try {
      const { status, tipo, direcao, numero } = req.query;
      const data = await TransporteController.getTransporteServices().getAllTransportes({
        status, tipo, direcao, numero
      });
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const data = await TransporteController.getTransporteServices().getById(id);
      if (!data) return res.status(404).json({ message: "Transporte não encontrado" });
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async create(req, res) {
    try {
      const dados = req.body;
      const result = await TransporteController.getTransporteServices().createTransporteComTransferencia(dados);
      
      return res.status(201).json({
        message: "Transporte e transferência criados com sucesso",
        numero_transporte: result.transporte.numero_transporte,
        ...result
      });
    } catch (error) {
      return res.status(400).json({
        error: "Erro ao criar transporte e transferência",
        details: error.message
      });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const updated = await TransporteController.getTransporteServices().updateTransporte(id, req.body);
      return res.status(200).json(updated);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      await TransporteController.getTransporteServices().deleteTransporte(id);
      return res.status(200).json({ message: `Transporte ${id} removido com sucesso.` });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async getPedidos(req, res) {
    try {
      const { id } = req.params;
      const pedidos = await TransporteController.getTransporteServices().getPedidos(id);
      return res.status(200).json(pedidos);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async atribuirMotorista(req, res) {
    try {
      const { id } = req.params;
      const { motorista_id } = req.body;
      const updated = await TransporteController.getTransporteServices().atribuirMotorista(id, motorista_id);
      return res.status(200).json(updated);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async atualizarStatus(req, res) {
    try {
      const { id } = req.params;
      const { status_transporte } = req.body;
      const updated = await TransporteController.getTransporteServices().atualizarStatus(id, status_transporte);
      return res.status(200).json(updated);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async iniciarTransporte(req, res) {
    try {
      const { id } = req.params;
      const transporte = await TransporteController.getTransporteServices().iniciarTransporte(id);
      return res.status(200).json({
        message: 'Transporte iniciado com sucesso',
        transporte
      });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async associarConferencia(req, res) {
    try {
      const { id } = req.params;
      const { conferencia_id } = req.body;
      const result = await TransporteController.getTransporteServices().associarConferencia(id, conferencia_id);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async removerAssociacaoConferencia(req, res) {
    try {
      const { id } = req.params;
      const { conferencia_id } = req.body;
      const result = await TransporteController.getTransporteServices().removerAssociacaoConferencia(id, conferencia_id);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async getConferenciasAssociadas(req, res) {
    try {
      const { id } = req.params;
      const conferencias = await TransporteController.getTransporteServices().getConferenciasAssociadas(id);
      return res.status(200).json(conferencias);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async getConferenciasDisponiveis(req, res) {
    try {
      const conferencias = await TransporteController.getTransporteServices().getConferenciasDisponiveis();
      return res.status(200).json(conferencias);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async atribuirRota(req, res) {
    try {
      const { id } = req.params;
      const { rota_id } = req.body;
      const transporte = await TransporteController.getTransporteServices().atribuirRota(id, rota_id);
      return res.status(200).json(transporte);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async criarRota(req, res) {
    try {
      const { id } = req.params;
      const { cluster, id_motorista, pedidos } = req.body;
      const result = await TransporteController.getTransporteServices().criarRota(id, { cluster, id_motorista, pedidos });
      
      return res.status(201).json({
        message: "Rota criada e associada ao transporte com sucesso",
        ...result
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async getMotoristasDisponiveis(req, res) {
    try {
      const motoristas = await TransporteController.getTransporteServices().getMotoristasDisponiveis();
      return res.status(200).json(motoristas);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async getPedidosParaRota(req, res) {
    try {
      const { id } = req.params;
      const pedidos = await TransporteController.getTransporteServices().getPedidosParaRota(id);
      return res.status(200).json(pedidos);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async getRotasDisponiveis(req, res) {
    try {
      const rotas = await TransporteController.getTransporteServices().getRotasDisponiveis();
      return res.status(200).json(rotas);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async getHubs(req, res) {
    try {
      const hubs = await TransporteController.getTransporteServices().getHubs();
      return res.status(200).json(hubs);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static getTransporteServices() {
    if (!this._transporteServices) {
      this._transporteServices = new TransporteServices();
    }
    return this._transporteServices;
  }
}

module.exports = TransporteController;