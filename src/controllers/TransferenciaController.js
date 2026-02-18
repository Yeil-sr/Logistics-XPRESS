const { TransferenciaServices } = require('../services');
const transferenciaService = new TransferenciaServices();

class TransferenciaController {
  static async getAllTransferencias(req, res) {
    try {
      const { status, direcao, numero_TO } = req.query;
      const filters = {};
      
      if (status) filters.status = status;
      if (direcao) filters.direcao = direcao;
      if (numero_TO) filters.numero_TO = { [db.Sequelize.Op.like]: `%${numero_TO}%` };

      const transferencias = await transferenciaService.getAllTransferencias(filters);
      return res.status(200).json(transferencias);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  static async getTransferenciaByID(req, res) {
    const { id } = req.params;
    try {
      const transferencia = await transferenciaService.getById(Number(id));
      if (!transferencia) {
        return res.status(404).json({ message: 'Transferência não encontrada.' });
      }
      return res.status(200).json(transferencia);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

static async createTransferenciaIsolada(req, res) {
  try {
    const transferencia = await transferenciaService.createRegister(req.body);
    return res.status(201).json({
      message: 'Transferência isolada criada com sucesso (teste)',
      transferencia
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}
  static async createTransferencia(req, res) {
    try {
      const novo = await transferenciaService.createWithPedidos(req.body);
      return res.status(201).json(novo);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async createFromRecebimento(req, res) {
    const { recebimentoId } = req.params;
    try {
      const transferencia = await transferenciaService.createFromRecebimento(Number(recebimentoId));
      return res.status(201).json(transferencia);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  }

  static async getPedidos(req, res) {
    const { id } = req.params;
    try {
      const pedidos = await transferenciaService.getPedidosByTransferencia(Number(id));
      return res.status(200).json(pedidos);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  static async updateTransferencia(req, res) {
    const { id } = req.params;
    const dadosAtualizados = req.body;
    try {
      const transferencia = await transferenciaService.updateRegister(dadosAtualizados, id);
      if (!transferencia) {
        return res.status(404).json({ message: 'Transferência não encontrada.' });
      }
      return res.status(200).json(transferencia);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  static async deleteTransferencia(req, res) {
    const { id } = req.params;
    try {
      const transferencia = await transferenciaService.getOneRegister({ id: Number(id) });
      if (!transferencia) {
        return res.status(404).json({ message: 'Transferência não encontrada.' });
      }
      await transferenciaService.deleteRegister(id);
      return res.status(200).json({ message: `Transferência ${id} removida com sucesso.` });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  static async concluirTransferencia(req, res) {
    const { id } = req.params;
    try {
      const transferencia = await transferenciaService.concluirTransferencia(Number(id));
      return res.status(200).json(transferencia);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  }

  static async iniciarTransporte(req, res) {
    const { id } = req.params;
    try {
      const transferencia = await transferenciaService.iniciarTransporte(Number(id));
      return res.status(200).json(transferencia);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  }

  static async cancelarTransferencia(req, res) {
    const { id } = req.params;
    const { motivo } = req.body;
    try {
      const transferencia = await transferenciaService.cancelarTransferencia(Number(id), motivo);
      return res.status(200).json(transferencia);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  }

  static async getTransferenciasPorPeriodo(req, res) {
    const { dataInicio, dataFim } = req.query;
    try {
      const transferencias = await transferenciaService.getTransferenciasPorPeriodo(dataInicio, dataFim);
      return res.status(200).json(transferencias);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  static async getEstatisticas(req, res) {
    try {
      const estatisticas = await transferenciaService.getEstatisticas();
      return res.status(200).json(estatisticas);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  static async associarMotorista(req, res) {
    const { id } = req.params;
    const { motorista_id } = req.body;
    try {
      const transferencia = await transferenciaService.associarMotorista(Number(id), Number(motorista_id));
      return res.status(200).json(transferencia);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  }

  static async adicionarPedidos(req, res) {
    const { id } = req.params;
    const { pedidosIds } = req.body;
    try {
      const transferencia = await transferenciaService.adicionarPedidos(Number(id), pedidosIds);
      return res.status(200).json(transferencia);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  }

  static async removerPedidos(req, res) {
    const { id } = req.params;
    const { pedidosIds } = req.body;
    try {
      const transferencia = await transferenciaService.removerPedidos(Number(id), pedidosIds);
      return res.status(200).json(transferencia);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  }

  static async getHubsDisponiveis(req, res) {
    try {
      const hubs = await transferenciaService.getHubsDisponiveis();
      return res.status(200).json(hubs);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  static async getMotoristasDisponiveis(req, res) {
    try {
      const motoristas = await transferenciaService.getMotoristasDisponiveis();
      return res.status(200).json(motoristas);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
}

module.exports = TransferenciaController;