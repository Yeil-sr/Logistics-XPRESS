const { PedidosServices } = require('../services');
const pedidosServices = new PedidosServices();

class PedidoController {
    
    // ========== MÉTODOS DE CONSULTA ==========

    static async getAllPedidos(req, res) {
        try {
            const result = await pedidosServices.getAllPedidos(req.query);
            return res.status(200).json(result);
        } catch (error) {
            console.error('Erro ao buscar pedidos:', error);
            return res.status(500).json({ message: error.message });
        }
    }

    static async getPedidosCountByStatus(req, res) {
        try {
            const statusCounts = await pedidosServices.getPedidosCountByStatus(req.query);
            return res.status(200).json(statusCounts);
        } catch (error) {
            console.error('Erro ao contar pedidos por status:', error);
            return res.status(500).json({ message: error.message });
        }
    }

    static async getPedidoByID(req, res) {
        try {
            const { id } = req.params;
            const pedido = await pedidosServices.getOneRegister({ id });
            if (!pedido) return res.status(404).json({ message: 'Pedido não encontrado' });
            return res.status(200).json(pedido);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    static async getPedidoByCodigo(req, res) {
        try {
            const { codigoPedido } = req.params;
            const pedido = await pedidosServices.getPedidoByCodigo(codigoPedido);

            if (!pedido) {
                return res.status(404).json({ message: 'Pedido não encontrado' });
            }

            return res.status(200).json(pedido);
        } catch (error) {
            console.error('Erro ao buscar pedido por código:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    static async getRastreamentos(req, res) {
        try {
            const { id } = req.params;
            const rastreamentos = await pedidosServices.getRastreamentosByPedido(id);

            if (!rastreamentos || rastreamentos.length === 0) {
                return res.status(404).json({ message: 'Nenhum rastreamento encontrado para este pedido' });
            }

            return res.status(200).json(rastreamentos);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    // ========== MÉTODOS DE CRIAÇÃO E ATUALIZAÇÃO ==========

    static async createPedido(req, res) {
        try {
            const result = await pedidosServices.createPedido(req.body);
            return res.status(201).json(result);
        } catch (error) {
            return res.status(400).json({
                error: "Erro ao criar o pedido",
                details: error.message
            });
        }
    }

    static async updatePedido(req, res) {
        try {
            const { id } = req.params;
            const pedidoAtualizado = await pedidosServices.updatePedido(id, req.body);

            return res.status(200).json(pedidoAtualizado);
        } catch (error) {
            return res.status(400).json({ 
                error: 'Erro ao atualizar o pedido', 
                details: error.message 
            });
        }
    }

    static async deletePedido(req, res) {
        try {
            const { id } = req.params;
            await pedidosServices.deleteRegister(id);
            return res.status(204).send();
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    // ========== MÉTODOS DE ASSOCIAÇÃO INDIVIDUAL ==========

    static async associarRecebimento(req, res) {
        try {
            const { id } = req.params;
            const { pedidoId } = req.body;
            const result = await pedidosServices.associarRecebimento(pedidoId, id);
            return res.status(200).json(result);
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }

    static async removerAssociacaoRecebimento(req, res) {
        try {
            const { pedidoId } = req.body;
            const result = await pedidosServices.removerAssociacaoRecebimento(pedidoId);
            return res.status(200).json(result);
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }

    static async associarTransferencia(req, res) {
        try {
            const { id } = req.params;
            const { pedidoId } = req.body;
            const result = await pedidosServices.associarTransferencia(pedidoId, id);
            return res.status(200).json(result);
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }

    static async removerAssociacaoTransferencia(req, res) {
        try {
            const { pedidoId } = req.body;
            const result = await pedidosServices.removerAssociacaoTransferencia(pedidoId);
            return res.status(200).json(result);
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }

    static async associarConferencia(req, res) {
        try {
            const { id } = req.params;
            const { pedidoId } = req.body;
            const result = await pedidosServices.associarConferencia(pedidoId, id);
            return res.status(200).json(result);
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }

    static async removerAssociacaoConferencia(req, res) {
        try {
            const { pedidoId } = req.body;
            const result = await pedidosServices.removerAssociacaoConferencia(pedidoId);
            return res.status(200).json(result);
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }

    // ========== MÉTODOS DE ASSOCIAÇÃO EM MASSA ==========

    static async associarTransporte(req, res) {
        try {
            const { id } = req.params;
            const { pedidosIds } = req.body;

            if (!pedidosIds || !Array.isArray(pedidosIds) || pedidosIds.length === 0) {
                return res.status(400).json({ error: "Lista de IDs de pedidos é obrigatória" });
            }

            const result = await pedidosServices.associarTransporte(pedidosIds, id);
            return res.status(200).json(result);
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }

    static async removerAssociacaoTransporte(req, res) {
        try {
            const { pedidosIds } = req.body;

            if (!pedidosIds || !Array.isArray(pedidosIds) || pedidosIds.length === 0) {
                return res.status(400).json({ error: "Lista de IDs de pedidos é obrigatória" });
            }

            const result = await pedidosServices.removerAssociacaoTransporte(pedidosIds);
            return res.status(200).json(result);
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }

    static async associarConferenciaEmMassa(req, res) {
        try {
            const { id } = req.params;
            const { pedidosIds } = req.body;

            if (!pedidosIds || !Array.isArray(pedidosIds) || pedidosIds.length === 0) {
                return res.status(400).json({ error: "Lista de IDs de pedidos é obrigatória" });
            }

            const result = await pedidosServices.associarConferenciaEmMassa(pedidosIds, id);
            return res.status(200).json(result);
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }

    static async removerAssociacaoConferenciaEmMassa(req, res) {
        try {
            const { pedidosIds } = req.body;

            if (!pedidosIds || !Array.isArray(pedidosIds) || pedidosIds.length === 0) {
                return res.status(400).json({ error: "Lista de IDs de pedidos é obrigatória" });
            }

            const result = await pedidosServices.removerAssociacaoConferenciaEmMassa(pedidosIds);
            return res.status(200).json(result);
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }

    // ========== MÉTODOS AUXILIARES ==========

    static async getProdutosByPedido(req, res) {
        try {
            const { id } = req.params;
            const produtos = await pedidosServices.getProdutosByPedido(id);
            return res.status(200).json(produtos);
        } catch (error) {
            return res.status(404).json({ error: error.message });
        }
    }

    static async getColetaByPedido(req, res) {
        try {
            const { id } = req.params;
            const coleta = await pedidosServices.getColetaByPedido(id);
            return res.status(200).json(coleta);
        } catch (error) {
            return res.status(404).json({ error: error.message });
        }
    }

    static async getExpedicaoByPedido(req, res) {
        try {
            const { id } = req.params;
            const expedicao = await pedidosServices.getExpedicaoByPedido(id);
            return res.status(200).json(expedicao);
        } catch (error) {
            return res.status(404).json({ error: error.message });
        }
    }
}

module.exports = PedidoController;