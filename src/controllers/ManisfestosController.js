const { ManifestosServices } = require('../services');
const manifestosService = new ManifestosServices();

class ManifestosController {
  static async getAll(req, res) {
    try {
      const { numero_manifesto } = req.query;
      const filtros = {};
      if (numero_manifesto) filtros.numero_manifesto = numero_manifesto;
      
      const manifestos = await manifestosService.getAll(filtros);
      return res.status(200).json(manifestos);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async getOne(req, res) {
    try {
      const id = Number(req.params.id);
      const manifesto = await manifestosService.getById(id);
      if (!manifesto) return res.status(404).json({ error: 'Manifesto não encontrado' });
      return res.status(200).json(manifesto);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async create(req, res) {
    try {
      const payload = req.body;
      const manifesto = await manifestosService.createManifestoComNotas(payload);
      return res.status(201).json(manifesto);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async createFromPedidos(req, res) {
    try {
      const payload = req.body || {};

      // Verificar se temos algum formato de pedidos válido
      const hasPedidosIds = Array.isArray(payload.pedidosIds) && payload.pedidosIds.length > 0;
      const hasPedidosCodigos = Array.isArray(payload.pedidosCodigos) && payload.pedidosCodigos.length > 0;
      const hasPedidosArray = Array.isArray(payload.pedidos) && payload.pedidos.length > 0;

      if (!hasPedidosIds && !hasPedidosCodigos && !hasPedidosArray) {
        return res.status(400).json({ 
          error: 'Payload inválido: deve conter pedidosIds, pedidosCodigos ou pedidos array com pelo menos 1 item' 
        });
      }

      // Se tem pedidosIds, usar o método antigo para compatibilidade
      if (hasPedidosIds && !hasPedidosCodigos && !hasPedidosArray) {
        const manifesto = await manifestosService.createManifestoFromPedidos({
          pedidosIds: payload.pedidosIds.map(id => Number(id)),
          ...payload
        });
        return res.status(201).json(manifesto);
      }

      // Para outros formatos, usar o novo método completo
      const manifesto = await manifestosService.createManifestoAndProcess(payload);
      return res.status(201).json(manifesto);

    } catch (error) {
      console.error('Erro createFromPedidos ManifestosController:', error);
      return res.status(400).json({ error: error.message || 'Erro ao criar manifesto a partir de pedidos' });
    }
  }

  static async update(req, res) {
    try {
      const id = Number(req.params.id);
      const updates = req.body;
      const manifesto = await manifestosService.updateManifesto(id, updates);
      return res.status(200).json(manifesto);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async delete(req, res) {
    try {
      const id = Number(req.params.id);
      await manifestosService.deleteManifesto(id);
      return res.status(200).json({ success: true, message: 'Manifesto deletado com sucesso' });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async associateNotas(req, res) {
    try {
      const id = Number(req.params.id);
      const { notasIds } = req.body;
      
      if (!notasIds || !Array.isArray(notasIds)) {
        return res.status(400).json({ error: 'notasIds deve ser um array' });
      }

      await db.NotasFiscais.update(
        { manifesto_id: id },
        { where: { id: notasIds } }
      );

      const manifesto = await manifestosService.getById(id);
      return res.status(200).json(manifesto);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async getNotas(req, res) {
    try {
      const id = Number(req.params.id);
      const manifesto = await manifestosService.getById(id);
      if (!manifesto) return res.status(404).json({ error: 'Manifesto não encontrado' });
      
      return res.status(200).json(manifesto.NotasFiscais);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}

module.exports = ManifestosController;