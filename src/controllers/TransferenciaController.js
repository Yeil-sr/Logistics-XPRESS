const { TransferenciaServices } = require('../services');
const transferenciaService = new TransferenciaServices();

class TransferenciaController {
  static async getAllTransferencias(req, res) {
    try {
      const transferencias = await transferenciaService.getAllRegisters();
      return res.status(200).json(transferencias);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  static async getTransferenciaByID(req, res) {
    const { id } = req.params;
    try {
      const transferencia = await transferenciaService.getById(id);
      if (!transferencia) {
        return res.status(404).json({ message: 'Transferência não encontrada.' });
      }
      return res.status(200).json(transferencia);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  static async createTransferencia(req, res) {
     try {
      const novo = await recebimentoServices.createTransferencia(req.body);
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
}

module.exports = TransferenciaController;
