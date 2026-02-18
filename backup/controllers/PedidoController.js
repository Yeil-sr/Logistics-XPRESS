const { PedidosServices, Clientes, Enderecos } = require('../services');
const db = require('../models');
const pedidosServices = new PedidosServices();
const { sequelize } = require('../models');

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
            const pedido = await pedidosServices.getById(id);
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

    // Helper function para criar ou encontrar cliente
    static async criarOuEncontrarCliente(clienteData, transaction) {
        if (!clienteData) return null;
        
        // Se já tem ID, retornar o ID
        if (clienteData.id) {
            return clienteData.id;
        }
        
        // Tentar encontrar cliente existente por CPF ou email
        let clienteExistente = null;
        
        if (clienteData.cpf) {
            clienteExistente = await  db.Clientes.findOne({
                where: { cpf: clienteData.cpf },
                transaction
            });
        }
        
        if (!clienteExistente && clienteData.email) {
            clienteExistente = await db.Clientes.findOne({
                where: { email: clienteData.email },
                transaction
            });
        }
        
        if (clienteExistente) {
            return clienteExistente.id;
        }
        
        // Validar campos obrigatórios
        if (!clienteData.nome) {
            throw new Error('Nome do cliente é obrigatório');
        }
        
        // Criar novo cliente
        const novoCliente = await db.Clientes.create(clienteData, { transaction });
        return novoCliente.id;
    }

    // Helper function para criar endereço
    static async criarEndereco(enderecoData, clienteId, transaction) {
        if (!enderecoData || !clienteId) return null;
        
        // Se já tem ID, retornar o ID
        if (enderecoData.id) {
            return enderecoData.id;
        }
        
        // Validar campos obrigatórios
        const camposObrigatorios = ['rua', 'numero', 'bairro', 'cidade', 'estado', 'cep'];
        for (const campo of camposObrigatorios) {
            if (!enderecoData[campo]) {
                throw new Error(`Campo ${campo} do endereço é obrigatório`);
            }
        }
        
        // Criar novo endereço
        const novoEndereco = await db.Enderecos.create({
            ...enderecoData,
            cliente_id: clienteId
        }, { transaction });
        
        return novoEndereco.id;
    }

    static async createPedido(req, res) {
        const transaction = await sequelize.transaction();
        
        try {
            const payload = req.body || {};
            
            // Extrair usuario_id: prioriza req.user (autenticação), depois payload (fallback)
            const usuarioId = (req.user && req.user.id) ? req.user.id : (payload.usuario_id || null);
            
            console.log('PedidoController.createPedido - usuarioId:', usuarioId, 'req.user:', req.user ? req.user.id : 'null');
            
            // Extrair dados de cliente e endereço do payload
            const { cliente_id, endereco_id, cliente, endereco, ...pedidoData } = payload;
            
            let clienteIdFinal = cliente_id;
            let enderecoIdFinal = endereco_id;
            
            // Processar cliente
            if (cliente && !cliente_id) {
                clienteIdFinal = await PedidoController.criarOuEncontrarCliente(cliente, transaction);
            }
            
            if (!clienteIdFinal) {
                await transaction.rollback();
                return res.status(400).json({ 
                    error: 'É necessário fornecer um cliente válido' 
                });
            }
            
            // Processar endereço
            if (endereco && !endereco_id) {
                enderecoIdFinal = await PedidoController.criarEndereco(endereco, clienteIdFinal, transaction);
            }
            
            if (!enderecoIdFinal) {
                await transaction.rollback();
                return res.status(400).json({ 
                    error: 'É necessário fornecer um endereço válido' 
                });
            }
            
            // Criar payload final para o serviço
            const payloadFinal = {
                ...pedidoData,
                cliente_id: clienteIdFinal,
                endereco_id: enderecoIdFinal,
                usuario_id: usuarioId
            };
            
            const result = await pedidosServices.createPedidoComItensENota(payloadFinal, { 
                usuario_id: usuarioId,
                transaction 
            });
            
            await transaction.commit();
            
            return res.status(201).json(result);
        } catch (error) {
            await transaction.rollback();
            console.error('Erro detalhado ao criar pedido:', error);
            return res.status(400).json({
                error: "Erro ao criar o pedido",
                details: error.message
            });
        }
    }

    static async updatePedido(req, res) {
        const transaction = await sequelize.transaction();
        
        try {
            const { id } = req.params;
            const payload = req.body || {};
            
            // Extrair usuario_id para atualizações que podem gerar movimentações
            const usuarioId = (req.user && req.user.id) ? req.user.id : (payload.usuario_id || null);
            
            // Verificar se pedido existe
            const pedidoExistente = await pedidosServices.getById(id);
            if (!pedidoExistente) {
                await transaction.rollback();
                return res.status(404).json({ error: 'Pedido não encontrado' });
            }
            
            // Extrair dados de cliente e endereço do payload
            const { cliente_id, endereco_id, cliente, endereco, ...pedidoData } = payload;
            
            let clienteIdFinal = cliente_id || pedidoExistente.cliente_id;
            let enderecoIdFinal = endereco_id || pedidoExistente.endereco_id;
            
            // Processar cliente se fornecido
            if (cliente && !cliente_id) {
                clienteIdFinal = await PedidoController.criarOuEncontrarCliente(cliente, transaction);
            }
            
            // Processar endereço se fornecido
            if (endereco && !endereco_id) {
                enderecoIdFinal = await PedidoController.criarEndereco(endereco, clienteIdFinal, transaction);
            }
            
            // Criar payload final para atualização
            const payloadFinal = {
                ...pedidoData,
                cliente_id: clienteIdFinal,
                endereco_id: enderecoIdFinal,
                usuario_id: usuarioId
            };
            
            const pedidoAtualizado = await pedidosServices.updatePedido(id, payloadFinal, { 
                usuario_id: usuarioId,
                transaction 
            });

            await transaction.commit();
            return res.status(200).json(pedidoAtualizado);
        } catch (error) {
            await transaction.rollback();
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

    // ========== MÉTODOS PARA VALIDAÇÃO DE DADOS ==========

    static async validarCliente(req, res) {
        try {
            const { cpf, email } = req.query;
            
            if (!cpf && !email) {
                return res.status(400).json({ error: 'CPF ou email é obrigatório para validação' });
            }
            
            let cliente = null;
            
            if (cpf) {
                cliente = await db.Clientes.findOne({ where: { cpf } });
            }
            
            if (!cliente && email) {
                cliente = await db.Clientes.findOne({ where: { email } });
            }
            
            return res.status(200).json({
                existe: !!cliente,
                cliente: cliente || null
            });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    static async validarEndereco(req, res) {
        try {
            const { cliente_id, cep, rua, numero } = req.query;
            
            if (!cliente_id) {
                return res.status(400).json({ error: 'cliente_id é obrigatório' });
            }
            
            const whereClause = { cliente_id };
            
            if (cep) whereClause.cep = cep;
            if (rua) whereClause.rua = rua;
            if (numero) whereClause.numero = numero;
            
            const endereco = await db.Enderecos.findOne({ where: whereClause });
            
            return res.status(200).json({
                existe: !!endereco,
                endereco: endereco || null
            });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
}

module.exports = PedidoController;