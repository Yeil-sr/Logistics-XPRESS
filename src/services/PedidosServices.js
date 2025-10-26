const Services = require('./Services');
const db = require('../models');
const { Op } = require('sequelize');

class PedidosServices extends Services {
    constructor() {
        super('Pedidos');
    }


    async getAllPedidos(filters = {}) {
        const {
            page = 1,
            size = 10,
            status,
            cliente_id,
            data_inicio,
            data_fim,
            search
        } = filters;

        const offset = (page - 1) * size;
        const limit = parseInt(size);

        let whereClause = {};
        let includeClause = [
            {
                model: db.Clientes,
                as: 'cliente',
                attributes: ['id', 'nome']
            },
            {
                model: db.Produtos,
                as: 'produto',
                attributes: ['id', 'nome']
            },
            {
                model: db.Endereco,
                as: 'endereco',
                attributes: ['id', 'logradouro', 'bairro', 'cep']
            },
        ];

        if (status) {
            whereClause.status = status;
        }

        if (cliente_id) {
            whereClause.cliente_id = cliente_id;
        }

        if (data_inicio || data_fim) {
            whereClause.data_criacao = {};
            if (data_inicio) {
                whereClause.data_criacao[Op.gte] = new Date(data_inicio);
            }
            if (data_fim) {
                const endDate = new Date(data_fim);
                endDate.setHours(23, 59, 59, 999);
                whereClause.data_criacao[Op.lte] = endDate;
            }
        }

        if (search) {
            const searchCondition = {
                [Op.or]: [
                    { codigo_pedido: { [Op.like]: `%${search}%` } },
                    { '$cliente.nome$': { [Op.like]: `%${search}%` } },
                    { '$produto.nome$': { [Op.like]: `%${search}%` } }
                ]
            };

            whereClause = Object.keys(whereClause).length > 0 
                ? { [Op.and]: [whereClause, searchCondition] }
                : searchCondition;
        }

        const { count, rows: pedidos } = await db.Pedidos.findAndCountAll({
            where: whereClause,
            include: includeClause,
            distinct: true,
            offset,
            limit,
            order: [['data_criacao', 'DESC']],
            subQuery: false
        });

        return {
            totalItems: count,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            pedidos
        };
    }

    async getPedidosCountByStatus(filters = {}) {
        const { cliente_id, data_inicio, data_fim, search } = filters;

        let whereClause = {};

        if (cliente_id) {
            whereClause.cliente_id = cliente_id;
        }

        if (data_inicio || data_fim) {
            whereClause.data_criacao = {};
            if (data_inicio) {
                whereClause.data_criacao[Op.gte] = new Date(data_inicio);
            }
            if (data_fim) {
                const endDate = new Date(data_fim);
                endDate.setHours(23, 59, 59, 999);
                whereClause.data_criacao[Op.lte] = endDate;
            }
        }

        if (search) {
            const searchCondition = {
                [Op.or]: [
                    { codigo_pedido: { [Op.like]: `%${search}%` } },
                    { '$cliente.nome$': { [Op.like]: `%${search}%` } },
                    { '$produto.nome$': { [Op.like]: `%${search}%` } }
                ]
            };

            whereClause = Object.keys(whereClause).length > 0 
                ? { [Op.and]: [whereClause, searchCondition] }
                : searchCondition;
        }

        const includeClause = search ? [
            {
                model: db.Clientes,
                as: 'cliente',
                attributes: []
            },
            {
                model: db.Produtos,
                as: 'produto',
                attributes: []
            }
        ] : [];

        const counts = await db.Pedidos.findAll({
            where: whereClause,
            include: includeClause,
            attributes: ['status', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
            group: ['status'],
            raw: true
        });

        const statusCounts = {
            PENDENTE: 0,
            PROCESSANDO: 0,
            EM_ROTA: 0,
            ENTREGUE: 0,
            CANCELADO: 0
        };

        counts.forEach(item => {
            statusCounts[item.status] = parseInt(item.count);
        });

        return statusCounts;
    }

    async getPedidoCompleto(id) {
        return db.Pedidos.findByPk(id, {
            include: [
                { model: db.Clientes, as: 'cliente' },
                { model: db.Produtos, as: 'produto' },
                { model: db.Endereco, as: 'endereco' },
                { model: db.Recebimento, as: 'recebimento' },
                { model: db.Transferencia, as: 'transferencia' },
                { model: db.Conferencia, as: 'conferencia' },
                { model: db.Rastreamento, as: 'rastreamentos' }
            ]
        });
    }

    async getPedidoByCodigo(codigoPedido) {
        return db.Pedidos.findOne({
            where: { codigo_pedido: codigoPedido.trim() },
            include: [
                { model: db.Clientes, as: 'cliente' },
                { model: db.Produtos, as: 'produto' },
                { model: db.Endereco, as: 'endereco' },
                { model: db.Recebimento, as: 'recebimento' },
                { model: db.Transferencia, as: 'transferencia' },
                { model: db.Conferencia, as: 'conferencia' },
                { model: db.Rastreamento, as: 'rastreamentos' }
            ]
        });
    }

    async getRastreamentosByPedido(pedidoId) {
        return db.Rastreamento.findAll({
            where: { id_pedido: pedidoId },
            order: [['data_status', 'DESC']]
        });
    }


    async createPedido(pedidoData) {
        const transaction = await db.sequelize.transaction();
        try {
            const {
                cliente,
                cliente_id,
                produto,
                produto_id,
                endereco_id,
                logradouro,
                cep,
                recebimento_id,
                transferencia_id,
                conferencia_id,
                status
            } = pedidoData;

            const { clienteEncontrado, produtoEncontrado, enderecoEncontrado } = 
                await this.buscarEntidadesRelacionadas({
                    cliente, cliente_id, produto, produto_id, endereco_id, logradouro, cep
                }, transaction);

            const etiquetaQR = "QR" + Math.floor(Math.random() * 999999);
            const codigoPedido = "PED" + Date.now();

            const newPedido = await db.Pedidos.create({
                codigo_pedido: codigoPedido,
                cliente_id: clienteEncontrado.id,
                produto_id: produtoEncontrado.id,
                endereco_id: enderecoEncontrado.id,
                recebimento_id,
                transferencia_id,
                conferencia_id,
                data_criacao: new Date(),
                status: status || 'PENDENTE',
                etiqueta_qr: etiquetaQR
            }, { transaction });

            await this.criarRegistrosRelacionados(newPedido.id, transaction);

            await transaction.commit();

            return {
                message: "Pedido criado com sucesso",
                etiqueta_qr: etiquetaQR,
                pedido: newPedido
            };

        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async buscarEntidadesRelacionadas(dados, transaction) {
        const { cliente, cliente_id, produto, produto_id, endereco_id, logradouro, cep } = dados;

        let clienteEncontrado = null;
        let produtoEncontrado = null;
        let enderecoEncontrado = null;

        if (cliente_id) {
            clienteEncontrado = await db.Clientes.findByPk(cliente_id, { transaction });
        } else if (cliente) {
            clienteEncontrado = await db.Clientes.findOne({ where: { nome: cliente }, transaction });
        }
        if (!clienteEncontrado) {
            throw new Error("Cliente não encontrado");
        }

        if (produto_id) {
            produtoEncontrado = await db.Produtos.findByPk(produto_id, { transaction });
        } else if (produto) {
            produtoEncontrado = await db.Produtos.findOne({ where: { nome: produto }, transaction });
        }
        if (!produtoEncontrado) {
            throw new Error("Produto não encontrado");
        }

        if (endereco_id) {
            enderecoEncontrado = await db.Endereco.findByPk(endereco_id, { transaction });
        } else if (logradouro && cep) {
            enderecoEncontrado = await db.Endereco.findOne({ where: { logradouro, cep }, transaction });
        }
        if (!enderecoEncontrado) {
            throw new Error("Endereço não encontrado");
        }

        return { clienteEncontrado, produtoEncontrado, enderecoEncontrado };
    }

    async criarRegistrosRelacionados(pedidoId, transaction) {
        await this.criarSeparacao(pedidoId, transaction);

        await db.Rastreamento.create({
            id_pedido: pedidoId,
            status_atual: 'PENDENTE',
            data_status: new Date(),
            localizacao: 'Sistema',
            observacao: 'Pedido criado no sistema'
        }, { transaction });
    }

    async criarSeparacao(pedidoId, transaction = null) {
        const options = transaction ? { transaction } : {};
        
        const separacaoExistente = await db.Separacao.findOne({
            where: { id_pedido: pedidoId },
            ...options
        });

        if (separacaoExistente) {
            throw new Error('Já existe uma separação para este pedido');
        }

        const separacao = await db.Separacao.create({
            id_pedido: pedidoId,
            status: 'PENDENTE',
            data_separacao: null
        }, options);

        return separacao;
    }


    async updatePedido(id, dadosAtualizados) {
        const transaction = await db.sequelize.transaction();
        try {
            const {
                cliente,
                conferencia_id,
                recebimento_id,
                transferencia_id,
                transporte_id,
                produto,
                endereco,
                status
            } = dadosAtualizados;

            const updates = await this.prepararDadosAtualizacao({
                cliente, produto, endereco, status,
                conferencia_id, recebimento_id, transferencia_id, transporte_id
            });

            const pedidoAtualizado = await db.Pedidos.update(updates, {
                where: { id },
                transaction,
                returning: true
            });

            if (!pedidoAtualizado[0]) {
                throw new Error('Pedido não encontrado');
            }

            if (status) {
                await db.Rastreamento.create({
                    id_pedido: id,
                    status_atual: status,
                    data_status: new Date(),
                    localizacao: 'Sistema',
                    observacao: 'Status atualizado'
                }, { transaction });
            }

            await transaction.commit();
            return pedidoAtualizado[1][0];

        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async prepararDadosAtualizacao(dados) {
        const {
            cliente, produto, endereco, status,
            conferencia_id, recebimento_id, transferencia_id, transporte_id
        } = dados;

        const updates = {
            status,
            conferencia_id,
            recebimento_id,
            transferencia_id,
            transporte_id,
            data_atualizacao: new Date()
        };

        if (cliente) {
            const clienteEncontrado = await db.Clientes.findOne({ where: { nome: cliente } });
            if (clienteEncontrado) updates.cliente_id = clienteEncontrado.id;
        }

        if (produto) {
            const produtoEncontrado = await db.Produtos.findOne({ where: { nome: produto } });
            if (produtoEncontrado) updates.produto_id = produtoEncontrado.id;
        }

        if (endereco) {
            const enderecoEncontrado = await db.Endereco.findOne({ where: { logradouro: endereco } });
            if (enderecoEncontrado) updates.endereco_id = enderecoEncontrado.id;
        }

        return updates;
    }


    async associarRecebimento(pedidoId, recebimentoId) {
        return this.associarEntidade(pedidoId, recebimentoId, 'recebimento_id', 'Recebimento', 'recebimento');
    }

    async associarTransferencia(pedidoId, transferenciaId) {
        return this.associarEntidade(pedidoId, transferenciaId, 'transferencia_id', 'Transferencia', 'transferência');
    }

    async associarConferencia(pedidoId, conferenciaId) {
        return this.associarEntidade(pedidoId, conferenciaId, 'conferencia_id', 'Conferencia', 'conferência');
    }

    async associarEntidade(pedidoId, entidadeId, campoId, modelo, nomeEntidade) {
        const transaction = await db.sequelize.transaction();
        try {
            // Validar pedido
            const pedido = await db.Pedidos.findByPk(pedidoId, { transaction });
            if (!pedido) throw new Error('Pedido não encontrado');

            const entidade = await db[modelo].findByPk(entidadeId, { transaction });
            if (!entidade) throw new Error(`${nomeEntidade} não encontrad${nomeEntidade === 'Conferencia' ? 'a' : 'o'}`);

            await pedido.update({ 
                [campoId]: entidadeId, 
                data_atualizacao: new Date() 
            }, { transaction });

            await db.Rastreamento.create({
                id_pedido: pedidoId,
                status_atual: pedido.status,
                data_status: new Date(),
                localizacao: 'Sistema',
                observacao: `Associado ao ${nomeEntidade.toLowerCase()}: ${entidade.numero_transporte || entidade.nome_estacao || entidade.id}`
            }, { transaction });

            await transaction.commit();
            return { 
                success: true, 
                message: `Pedido associado ao ${nomeEntidade.toLowerCase()} com sucesso` 
            };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async removerAssociacaoRecebimento(pedidoId) {
        return this.removerAssociacaoEntidade(pedidoId, 'recebimento_id', 'recebimento');
    }

    async removerAssociacaoTransferencia(pedidoId) {
        return this.removerAssociacaoEntidade(pedidoId, 'transferencia_id', 'transferência');
    }

    async removerAssociacaoConferencia(pedidoId) {
        return this.removerAssociacaoEntidade(pedidoId, 'conferencia_id', 'conferência');
    }

    async removerAssociacaoEntidade(pedidoId, campoId, nomeEntidade) {
        const transaction = await db.sequelize.transaction();
        try {
            const pedido = await db.Pedidos.findByPk(pedidoId, { transaction });
            if (!pedido) throw new Error('Pedido não encontrado');
            
            if (!pedido[campoId]) {
                throw new Error(`Pedido não está associado a nenhum ${nomeEntidade}`);
            }

            const entidadeId = pedido[campoId];
            await pedido.update({ 
                [campoId]: null, 
                data_atualizacao: new Date() 
            }, { transaction });

            await db.Rastreamento.create({
                id_pedido: pedidoId,
                status_atual: pedido.status,
                data_status: new Date(),
                localizacao: 'Sistema',
                observacao: `Associação com ${nomeEntidade} ${entidadeId} removida`
            }, { transaction });

            await transaction.commit();
            return { 
                success: true, 
                message: `Associação com ${nomeEntidade} removida com sucesso` 
            };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }


    async associarTransporte(pedidosIds, transporteId) {
        return this.associarEntidadeEmMassa(pedidosIds, transporteId, 'transporte_id', 'Transporte', 'transporte');
    }

    async associarConferenciaEmMassa(pedidosIds, conferenciaId) {
        return this.associarEntidadeEmMassa(pedidosIds, conferenciaId, 'conferencia_id', 'Conferencia', 'conferência');
    }

    async associarEntidadeEmMassa(pedidosIds, entidadeId, campoId, modelo, nomeEntidade) {
        const transaction = await db.sequelize.transaction();
        try {
            const entidade = await db[modelo].findByPk(entidadeId, { transaction });
            if (!entidade) throw new Error(`${nomeEntidade} não encontrad${nomeEntidade === 'Conferencia' ? 'a' : 'o'}`);

            const pedidos = await db.Pedidos.findAll({
                where: { id: pedidosIds },
                transaction
            });

            if (pedidos.length !== pedidosIds.length) {
                const encontradosIds = pedidos.map(p => p.id);
                const naoEncontrados = pedidosIds.filter(id => !encontradosIds.includes(id));
                throw new Error(`Pedidos não encontrados: ${naoEncontrados.join(', ')}`);
            }

            const pedidosComConflito = pedidos.filter(p => p[campoId] && p[campoId] !== entidadeId);
            if (pedidosComConflito.length > 0) {
                const idsComConflito = pedidosComConflito.map(p => p.id);
                throw new Error(`Pedidos já associados a outro ${nomeEntidade.toLowerCase()}: ${idsComConflito.join(', ')}`);
            }

            await db.Pedidos.update(
                { 
                    [campoId]: entidadeId, 
                    data_atualizacao: new Date() 
                },
                {
                    where: { id: pedidosIds },
                    transaction
                }
            );

            const registrosRastreamento = pedidos.map(pedido => ({
                id_pedido: pedido.id,
                status_atual: pedido.status,
                data_status: new Date(),
                localizacao: 'Sistema',
                observacao: `Associado ao ${nomeEntidade.toLowerCase()}: ${entidade.numero_transporte || entidade.nome_estacao || entidade.id}`
            }));

            await db.Rastreamento.bulkCreate(registrosRastreamento, { transaction });

            await transaction.commit();
            
            return { 
                success: true, 
                message: `${pedidosIds.length} pedido(s) associado(s) ao ${nomeEntidade.toLowerCase()} com sucesso`,
                pedidosAssociados: pedidosIds
            };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async removerAssociacaoTransporte(pedidosIds) {
        return this.removerAssociacaoEntidadeEmMassa(pedidosIds, 'transporte_id', 'transporte');
    }

    async removerAssociacaoConferenciaEmMassa(pedidosIds) {
        return this.removerAssociacaoEntidadeEmMassa(pedidosIds, 'conferencia_id', 'conferência');
    }

    async removerAssociacaoEntidadeEmMassa(pedidosIds, campoId, nomeEntidade) {
        const transaction = await db.sequelize.transaction();
        try {
            const pedidos = await db.Pedidos.findAll({
                where: { id: pedidosIds },
                transaction
            });

            if (pedidos.length !== pedidosIds.length) {
                const encontradosIds = pedidos.map(p => p.id);
                const naoEncontrados = pedidosIds.filter(id => !encontradosIds.includes(id));
                throw new Error(`Pedidos não encontrados: ${naoEncontrados.join(', ')}`);
            }

            const pedidosSemAssociacao = pedidos.filter(p => !p[campoId]);
            if (pedidosSemAssociacao.length > 0) {
                const idsSemAssociacao = pedidosSemAssociacao.map(p => p.id);
                throw new Error(`Pedidos não estão associados a nenhum ${nomeEntidade}: ${idsSemAssociacao.join(', ')}`);
            }

            const entidadesIds = [...new Set(pedidos.map(p => p[campoId]))];

            await db.Pedidos.update(
                { 
                    [campoId]: null, 
                    data_atualizacao: new Date() 
                },
                {
                    where: { id: pedidosIds },
                    transaction
                }
            );

            const registrosRastreamento = pedidos.map(pedido => ({
                id_pedido: pedido.id,
                status_atual: pedido.status,
                data_status: new Date(),
                localizacao: 'Sistema',
                observacao: `Associação com ${nomeEntidade} ${pedido[campoId]} removida`
            }));

            await db.Rastreamento.bulkCreate(registrosRastreamento, { transaction });

            await transaction.commit();
            
            return { 
                success: true, 
                message: `${pedidosIds.length} pedido(s) tiveram a associação com ${nomeEntidade} removida`,
                pedidosProcessados: pedidosIds,
                entidadesAfetadas: entidadesIds
            };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async getProdutosByPedido(id) {
        const pedido = await this.getPedidoCompleto(id);
        return pedido ? [pedido.produto] : [];
    }

    async getColetaByPedido(id) {
        const pedido = await db.Pedidos.findByPk(id, {
            include: [{ model: db.Recebimento, as: 'recebimento' }]
        });
        return pedido?.recebimento || null;
    }

    async getExpedicaoByPedido(id) {
        const pedido = await db.Pedidos.findByPk(id, {
            include: [{ model: db.Transferencia, as: 'transferencia' }]
        });
        return pedido?.transferencia || null;
    }
}

module.exports = PedidosServices;