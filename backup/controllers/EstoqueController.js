const { EstoquesServices } = require('../services'); 
const estoqueService = new EstoquesServices();

class EstoqueController {
  // GET /estoques?produto_id=&hub_id=
  static async getAll(req, res) {
    try {
      const filters = {};
      if (req.query.produto_id) filters.produto_id = Number(req.query.produto_id);
      if (req.query.hub_id) filters.hub_id = Number(req.query.hub_id);
      // passe outros filtros conforme necessidade
      const registros = await estoqueService.getAll(filters);
      return res.status(200).json(registros);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // GET /estoques/:id
  static async getOne(req, res) {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'id inválido' });

      const registro = await estoqueService.getById(id);
      if (!registro) return res.status(404).json({ error: 'Estoque não encontrado' });
      return res.status(200).json(registro);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // POST /estoques/entrada
  // body: { produto_id, hub_id, quantidade, usuario_id?, localizacao?, referencia? }
  static async entrada(req, res) {
    try {
      const { produto_id, hub_id, quantidade, usuario_id, localizacao, referencia } = req.body;
      if (typeof produto_id === 'undefined' || typeof hub_id === 'undefined' || typeof quantidade === 'undefined') {
        return res.status(400).json({ error: 'produto_id, hub_id e quantidade são obrigatórios' });
      }

      const registro = await estoqueService.entradaEstoque({
        produto_id: Number(produto_id),
        hub_id: Number(hub_id),
        quantidade: Number(quantidade),
        usuario_id: usuario_id ? Number(usuario_id) : null,
        localizacao: localizacao || null,
        referencia: referencia || null
      });

      return res.status(201).json(registro);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  // POST /estoques/reservar
  // body: { produto_id, hub_id, quantidade, usuario_id?, referencia? }
  static async reservar(req, res) {
    try {
      const { produto_id, hub_id, quantidade, usuario_id, referencia } = req.body;
      if (typeof produto_id === 'undefined' || typeof hub_id === 'undefined' || typeof quantidade === 'undefined') {
        return res.status(400).json({ error: 'produto_id, hub_id e quantidade são obrigatórios' });
      }

      const registro = await estoqueService.reservarProduto({
        produto_id: Number(produto_id),
        hub_id: Number(hub_id),
        quantidade: Number(quantidade),
        usuario_id: usuario_id ? Number(usuario_id) : null,
        referencia: referencia || null
      });

      return res.status(200).json(registro);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  // POST /estoques/liberar-reserva
  // body: { produto_id, hub_id, quantidade, usuario_id?, referencia? }
  static async liberarReserva(req, res) {
    try {
      const { produto_id, hub_id, quantidade, usuario_id, referencia } = req.body;
      if (typeof produto_id === 'undefined' || typeof hub_id === 'undefined' || typeof quantidade === 'undefined') {
        return res.status(400).json({ error: 'produto_id, hub_id e quantidade são obrigatórios' });
      }

      const registro = await estoqueService.liberarReserva({
        produto_id: Number(produto_id),
        hub_id: Number(hub_id),
        quantidade: Number(quantidade),
        usuario_id: usuario_id ? Number(usuario_id) : null,
        referencia: referencia || null
      });

      return res.status(200).json(registro);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  // POST /estoques/saida
  // body: { produto_id, hub_id, quantidade, usuario_id?, referencia?, consumirReservas? }
  static async saida(req, res) {
    try {
      const { produto_id, hub_id, quantidade, usuario_id, referencia, consumirReservas = true } = req.body;
      if (typeof produto_id === 'undefined' || typeof hub_id === 'undefined' || typeof quantidade === 'undefined') {
        return res.status(400).json({ error: 'produto_id, hub_id e quantidade são obrigatórios' });
      }

      const registro = await estoqueService.saidaEstoque({
        produto_id: Number(produto_id),
        hub_id: Number(hub_id),
        quantidade: Number(quantidade),
        usuario_id: usuario_id ? Number(usuario_id) : null,
        referencia: referencia || null,
        consumirReservas: consumirReservas === false ? false : true
      });

      return res.status(200).json(registro);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  // POST /estoques/transferir
  // body: { produto_id, origem_hub_id, destino_hub_id, quantidade, usuario_id?, referencia? }
  static async transferir(req, res) {
    try {
      const { produto_id, origem_hub_id, destino_hub_id, quantidade, usuario_id, referencia } = req.body;
      if (typeof produto_id === 'undefined' || typeof origem_hub_id === 'undefined' || typeof destino_hub_id === 'undefined' || typeof quantidade === 'undefined') {
        return res.status(400).json({ error: 'produto_id, origem_hub_id, destino_hub_id e quantidade são obrigatórios' });
      }

      const result = await estoqueService.transferirEstoque({
        produto_id: Number(produto_id),
        origem_hub_id: Number(origem_hub_id),
        destino_hub_id: Number(destino_hub_id),
        quantidade: Number(quantidade),
        usuario_id: usuario_id ? Number(usuario_id) : null,
        referencia: referencia || null
      });

      return res.status(200).json(result);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  // POST /estoques/ajustar
  // body: { produto_id, hub_id, nova_quantidade_total, usuario_id?, referencia? }
  static async ajustar(req, res) {
    try {
      const { produto_id, hub_id, nova_quantidade_total, usuario_id, referencia } = req.body;
      if (typeof produto_id === 'undefined' || typeof hub_id === 'undefined' || typeof nova_quantidade_total === 'undefined') {
        return res.status(400).json({ error: 'produto_id, hub_id e nova_quantidade_total são obrigatórios' });
      }

      const registro = await estoqueService.ajustarEstoque({
        produto_id: Number(produto_id),
        hub_id: Number(hub_id),
        nova_quantidade_total: Number(nova_quantidade_total),
        usuario_id: usuario_id ? Number(usuario_id) : null,
        referencia: referencia || null
      });

      return res.status(200).json(registro);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  // GET /estoques/low-stock?threshold=&hub_id=
  static async lowStock(req, res) {
    try {
      const threshold = req.query.threshold ? Number(req.query.threshold) : null;
      const hub_id = req.query.hub_id ? Number(req.query.hub_id) : null;
      const itens = await estoqueService.getLowStock({ threshold, hub_id });
      return res.status(200).json(itens);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // GET /estoques/summary?produto_id=&hub_id=
  static async summary(req, res) {
    try {
      const produto_id = req.query.produto_id ? Number(req.query.produto_id) : null;
      const hub_id = req.query.hub_id ? Number(req.query.hub_id) : null;
      if (!produto_id) return res.status(400).json({ error: 'produto_id obrigatório' });

      const summary = await estoqueService.getSummary(produto_id, hub_id);
      return res.status(200).json(summary);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

    static async getMovimentacoes(req, res) {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'id inválido' });

      const movimentacoes = await estoqueService.getMovimentacoesByEstoqueId(id);
      return res.status(200).json(movimentacoes);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

    static async getMovimentacoesByQuery(req, res) {
      try {
        const produto_id = req.query.produto_id ? Number(req.query.produto_id) : null;
        const hub_id = req.query.hub_id ? Number(req.query.hub_id) : null;

        if (!produto_id || !hub_id) {
          return res.status(400).json({ error: 'produto_id e hub_id são obrigatórios' });
        }

        const movimentacoes = await estoqueService.getMovimentacoesByProductHub(produto_id, hub_id);
        return res.status(200).json(movimentacoes);
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    }

}

module.exports = EstoqueController;
