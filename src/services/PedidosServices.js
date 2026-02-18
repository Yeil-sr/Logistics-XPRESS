const Services = require('./Services');
const db = require('../models');
const { Op } = require('sequelize');
const EstoquesServices = require('./EstoquesServices');
const NotasFiscaisServices = require('./NotasFiscaisServices');

const estoqueService = new EstoquesServices();
const notasFiscaisService = new NotasFiscaisServices();

/**
 * Serviço responsável pela gestão de pedidos.
 * 
 * CORREÇÕES APLICADAS (fev/2026):
 * - Rastreamento: status_atual sempre 'NO_HUB' (status válido no enum)
 * - Removidas referências a status de pedido inexistentes (COLETADO, AGUARDANDO_COLETA, SEPARADO)
 * - Removido include direto de Produtos em Pedidos (relação não existe)
 * - Validação de transação reforçada
 * - Criação de cliente/endereço com fallback adequado
 */
class PedidosServices extends Services {
    constructor() {
        super('Pedidos');
        this.NotasServices = NotasFiscaisServices; // referência estática
    }

    // ------------------------------------------------------------------------
    //  MAPEAMENTO DE STATUS
    // ------------------------------------------------------------------------
    _mapPedidoStatusToRastreamentoStatus(pedidoStatus) {
        const map = {
            'PENDENTE': 'NO_HUB',
            'PROCESSANDO': 'NO_HUB',
            'AGUARDANDO_CONFERENCIA': 'NO_HUB',
            'AGUARDANDO_SEPARACAO': 'NO_HUB',
            'VALIDADO': 'NO_HUB',
            'EM_ESTOQUE': 'NO_HUB',
            'EM_ROTA': 'EM_ROTA',
            'ENTREGUE': 'ENTREGUE',
            'CANCELADO': 'EXCECAO'
        };
        return map[pedidoStatus] || 'NO_HUB';
    }

    // ------------------------------------------------------------------------
    //  VALIDAÇÃO DE TRANSAÇÃO
    // ------------------------------------------------------------------------
    async _checkTransaction(transaction, operation) {
        if (!transaction) return;
        if (transaction.finished) {
            throw new Error(`[ABORTED] Transação já finalizada (${transaction.finished}) - ${operation}`);
        }
        try {
            await db.sequelize.query('SELECT 1', {
                transaction,
                type: db.sequelize.QueryTypes.SELECT,
            });
        } catch (err) {
            throw new Error(`[ABORTED] Transação inválida ou abortada - ${operation}: ${err.message}`);
        }
    }

    async verificarTransacaoDetalhada(transaction) {
        if (!transaction) return false;
        try {
            if (transaction.finished) return false;
            await db.sequelize.query('SELECT 1 as teste_transacao', {
                transaction,
                type: db.sequelize.QueryTypes.SELECT
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    // ------------------------------------------------------------------------
    //  CONSULTAS
    // ------------------------------------------------------------------------
    async getAllPedidos(filters = {}) {
        const {
            page = 1,
            size = 10,
            status,
            cliente_id,
            data_inicio,
            data_fim,
            search,
            multipleItems = false
        } = filters;

        const offset = (page - 1) * size;
        const limit = parseInt(size, 10);

        let whereClause = {};
        let includeClause = [
            {
                model: db.Clientes,
                as: 'clientes',
                attributes: ['id', 'nome']
            },
            {
                model: db.Enderecos,
                as: 'enderecos',
                attributes: ['id', 'rua', 'numero', 'bairro', 'cidade', 'estado', 'cep']
            },
            {
                model: db.PedidoItens,
                required: false,
                as: 'itens',
                include: [{
                    model: db.Produtos,
                    as: 'produtos',
                    attributes: ['id', 'nome', 'preco'],
                    required: false
                }]
            },
            {
                model: db.NotasFiscais,
                as: 'nota',
                required: false,
                include: [{
                    model: db.NotasItens,
                    as: 'notaItens',
                    required: false,
                    include: [{
                        model: db.Produtos,
                        as: 'produtos',
                        attributes: ['id', 'nome'],
                        required: false
                    }]
                }]
            }
        ];

        if (status) whereClause.status = status;
        if (cliente_id) whereClause.cliente_id = Number(cliente_id);
        if (data_inicio || data_fim) {
            whereClause.data_criacao = {};
            if (data_inicio) whereClause.data_criacao[Op.gte] = new Date(data_inicio);
            if (data_fim) {
                const endDate = new Date(data_fim);
                endDate.setHours(23, 59, 59, 999);
                whereClause.data_criacao[Op.lte] = endDate;
            }
        }

        if (multipleItems) {
            const multiSql = `
                SELECT pedido_id
                FROM PedidoItens
                GROUP BY pedido_id
                HAVING COUNT(*) > 1
            `;
            const multiRows = await db.sequelize.query(multiSql, {
                type: db.sequelize.QueryTypes.SELECT
            });
            const multiIds = multiRows.map(r => Number(r.pedido_id)).filter(Boolean);
            if (multiIds.length === 0) {
                return {
                    totalItems: 0,
                    totalPages: 0,
                    currentPage: parseInt(page, 10),
                    pedidos: []
                };
            }
            whereClause = Object.keys(whereClause).length > 0
                ? { [Op.and]: [whereClause, { id: { [Op.in]: multiIds } }] }
                : { id: { [Op.in]: multiIds } };
        }

        if (search) {
            const pedidoItensMatches = await db.PedidoItens.findAll({
                include: [{
                    model: db.Produtos,
                    as: 'produtos',
                    attributes: [],
                    where: { nome: { [Op.like]: `%${search}%` } },
                    required: true
                }],
                attributes: ['pedido_id'],
                raw: true
            });
            const clientesMatches = await db.Clientes.findAll({
                where: { nome: { [Op.like]: `%${search}%` } },
                attributes: ['id'],
                raw: true
            });

            const clienteIds = clientesMatches.map(c => Number(c.id));
            const pedidoIdsFromProdutos = [...new Set(pedidoItensMatches.map(r => Number(r.pedido_id)))];

            const orConditions = [
                { codigo_pedido: { [Op.like]: `%${search}%` } }
            ];
            if (clienteIds.length) orConditions.push({ cliente_id: { [Op.in]: clienteIds } });
            if (pedidoIdsFromProdutos.length) orConditions.push({ id: { [Op.in]: pedidoIdsFromProdutos } });

            whereClause = Object.keys(whereClause).length > 0
                ? { [Op.and]: [whereClause, { [Op.or]: orConditions }] }
                : { [Op.or]: orConditions };
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
            currentPage: parseInt(page, 10),
            pedidos
        };
    }

    async getById(id) {
        const pedido = await db.Pedidos.findByPk(id, {
            include: [
                {
                    model: db.Clientes,
                    as: 'clientes',
                    attributes: ['id', 'nome', 'cpf', 'email', 'telefone']
                },
                {
                    model: db.Enderecos,
                    as: 'enderecos',
                    attributes: ['id', 'rua', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'cep']
                },
                {
                    model: db.PedidoItens,
                    as: 'itens',
                    include: [{
                        model: db.Produtos,
                        as: 'produtos',
                        attributes: ['id', 'nome', 'peso_kg', 'preco', 'status', 'tipo_entrega']
                    }]
                },
                {
                    model: db.NotasFiscais,
                    as: 'nota',
                    include: [{
                        model: db.NotasItens,
                        as: 'notaItens',
                        include: [{
                            model: db.Produtos,
                            as: 'produtos',
                            attributes: ['id', 'nome']
                        }]
                    }]
                },
                {
                    model: db.Rastreamentos,
                    as: 'rastreamentos',
                    order: [['data_status', 'DESC']]
                },
                {
                    model: db.Paradas,
                    as: 'paradas'
                }
            ]
        });
        if (!pedido) throw new Error('Pedido não encontrado');
        return pedido;
    }

    async getPedidoCompleto(id) {
        return this.getById(id);
    }

    async getPedidoByCodigo(codigoPedido) {
        return db.Pedidos.findOne({
            where: { codigo_pedido: codigoPedido.trim() },
            include: [
                { model: db.Clientes, as: 'clientes' },
                { model: db.Enderecos, as: 'enderecos' },
                {
                    model: db.PedidoItens,
                    as: 'itens',
                    include: [{ model: db.Produtos, as: 'produtos' }]
                },
                {
                    model: db.NotasFiscais,
                    as: 'nota',
                    include: [{
                        model: db.NotasItens,
                        as: 'notaItens',
                        include: [{ model: db.Produtos, as: 'produtos' }]
                    }]
                },
                { model: db.Recebimentos, as: 'recebimentos' },
                { model: db.Transferencias, as: 'transferencias' },
                { model: db.Conferencias, as: 'conferencias' },
                { model: db.Rastreamentos, as: 'rastreamentos' },
                { model: db.Paradas, as: 'paradas' }
            ]
        });
    }

    async getRastreamentosByPedido(pedidoId) {
        return db.Rastreamentos.findAll({
            where: { pedido_id: pedidoId },
            order: [['data_status', 'DESC']]
        });
    }

    async getPedidosCountByStatus(filters = {}) {
        const { cliente_id, data_inicio, data_fim, search } = filters;
        let whereClause = {};

        if (cliente_id) whereClause.cliente_id = Number(cliente_id);
        if (data_inicio || data_fim) {
            whereClause.data_criacao = {};
            if (data_inicio) whereClause.data_criacao[Op.gte] = new Date(data_inicio);
            if (data_fim) {
                const endDate = new Date(data_fim);
                endDate.setHours(23, 59, 59, 999);
                whereClause.data_criacao[Op.lte] = endDate;
            }
        }

        if (search) {
            const pedidoItensMatches = await db.PedidoItens.findAll({
                include: [{
                    model: db.Produtos,
                    as: 'produtos',
                    attributes: [],
                    where: { nome: { [Op.like]: `%${search}%` } },
                    required: true
                }],
                attributes: ['pedido_id'],
                raw: true
            });
            const clientesMatches = await db.Clientes.findAll({
                where: { nome: { [Op.like]: `%${search}%` } },
                attributes: ['id'],
                raw: true
            });

            const clienteIds = clientesMatches.map(c => Number(c.id));
            const pedidoIdsFromProdutos = [...new Set(pedidoItensMatches.map(r => Number(r.pedido_id)))];

            const orConditions = [
                { codigo_pedido: { [Op.like]: `%${search}%` } }
            ];
            if (clienteIds.length) orConditions.push({ cliente_id: { [Op.in]: clienteIds } });
            if (pedidoIdsFromProdutos.length) orConditions.push({ id: { [Op.in]: pedidoIdsFromProdutos } });

            whereClause = Object.keys(whereClause).length > 0
                ? { [Op.and]: [whereClause, { [Op.or]: orConditions }] }
                : { [Op.or]: orConditions };
        }

        const counts = await db.Pedidos.findAll({
            where: whereClause,
            attributes: ['status', [db.sequelize.fn('COUNT', db.sequelize.col('Pedidos.id')), 'count']],
            group: ['status'],
            raw: true
        });

        // Inicializa todos os status válidos do schema
        const statusCounts = {
            PENDENTE: 0,
            PROCESSANDO: 0,
            EM_ROTA: 0,
            ENTREGUE: 0,
            CANCELADO: 0,
            AGUARDANDO_CONFERENCIA: 0,
            AGUARDANDO_SEPARACAO: 0,
            VALIDADO: 0,
            EM_ESTOQUE: 0
        };

        counts.forEach(item => {
            statusCounts[item.status] = parseInt(item.count);
        });

        return statusCounts;
    }

    // ------------------------------------------------------------------------
    //  CRIAÇÃO DE PEDIDO
    // ------------------------------------------------------------------------
    async createPedidoComItensENota(pedidoData, options = {}) {
        const externalTx = options.transaction;
        let transaction;
        const createdHere = !externalTx;

        try {
            if (!externalTx) {
                transaction = await db.sequelize.transaction({
                    autocommit: false,
                    isolationLevel: db.sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
                    timeout: 30000
                });
            } else {
                transaction = externalTx;
                const transacaoValida = await this.verificarTransacaoDetalhada(transaction);
                if (!transacaoValida) {
                    throw new Error('Transação externa inválida. Não é possível processar o pedido.');
                }
            }

            const {
                cliente,
                cliente_id,
                endereco,
                endereco_id,
                cep,
                itens = [],
                gerarNota = false,
                autoReserve = false,
                autoConsumeStock = false,
                usuario_id = null,
                status = 'PENDENTE',
                codigo_pedido = null,
                manifesto_id = null,
                numero_manifesto = null,
                nota: notaDados = null
            } = pedidoData;

            const usuarioIdEfetivo = options.usuario_id || usuario_id || process.env.SYSTEM_USER_ID || 1;

            if (!itens || itens.length === 0) {
                throw new Error('É necessário informar pelo menos um item para o pedido');
            }

            const codigoPedidoFinal = codigo_pedido || `PED${Date.now()}`;

            // Manifesto
            let manifestoIdFinal = null;
            if (manifesto_id) {
                manifestoIdFinal = Number(manifesto_id);
            } else if (numero_manifesto) {
                const manifesto = await db.Manifestos.findOne({
                    where: { numero_manifesto: numero_manifesto.trim() },
                    transaction
                });
                if (manifesto) manifestoIdFinal = manifesto.id;
            }

            // Cliente e Endereço
            const { clienteEncontrado, enderecoEncontrado } = await this._buscarOuCriarClienteEndereco(
                { cliente, cliente_id, endereco, endereco_id, cep },
                transaction
            );

            const etiquetaQR = "QR" + Date.now() + Math.floor(Math.random() * 9999);

            // Criação do pedido
            const pedidoDataToCreate = {
                codigo_pedido: codigoPedidoFinal,
                cliente_id: clienteEncontrado.id,
                endereco_id: enderecoEncontrado.id,
                quantidade: itens.reduce((sum, item) => sum + Number(item.quantidade || 1), 0),
                data_criacao: new Date(),
                status: status,
                etiqueta_qr: etiquetaQR
            };
            if (manifestoIdFinal) pedidoDataToCreate.manifesto_id = manifestoIdFinal;

            const newPedido = await db.Pedidos.create(pedidoDataToCreate, { transaction });

            // Itens do pedido
            const pedidoItensData = itens.map(item => {
                const quantidade = Number(item.quantidade || 1);
                const valor_unitario = Number(item.valor_unitario || item.preco_unitario || item.price || 0);
                const valor_total = quantidade * valor_unitario;
                return {
                    pedido_id: newPedido.id,
                    produto_id: Number(item.produto_id),
                    descricao: item.descricao || null,
                    quantidade,
                    valor_unitario,
                    valor_total,
                    observacao: item.observacao || null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
            });

            const pedidoItens = await db.PedidoItens.bulkCreate(pedidoItensData, { transaction });

            // Registros relacionados (separação, rastreamento)
            await this._criarRegistrosRelacionados(newPedido.id, transaction);

            // Nota fiscal
            let notaFiscal = null;
            if (gerarNota) {
                try {
                    const notasService = new this.NotasServices();
                    notaFiscal = await notasService.createNotaParaPedido(newPedido, {
                        transaction,
                        numero: notaDados?.numero || `NF-${codigoPedidoFinal}`,
                        serie: notaDados?.serie || '1',
                        data_emissao: notaDados?.data_emissao ? new Date(notaDados.data_emissao) : new Date(),
                        manifesto_id: notaDados?.manifesto_id || null,
                        itens: notaDados?.itens || null
                    });
                } catch (notaError) {
                    console.warn(`[PedidosServices] Não foi possível criar nota fiscal: ${notaError.message}`);
                }
            }

            // Reserva/consumo de estoque
            if (autoReserve) {
                await this._reservarEstoquePorItens(pedidoItens, codigoPedidoFinal, usuarioIdEfetivo, { transaction });
            }
            if (autoConsumeStock) {
                await this._consumirEstoquePorItens(pedidoItens, codigoPedidoFinal, usuarioIdEfetivo, { transaction });
            }

            if (createdHere) {
                await this._checkTransaction(transaction, 'Commit criação pedido');
                await transaction.commit();
            }

            return {
                message: "Pedido criado com sucesso",
                etiqueta_qr: etiquetaQR,
                pedido: newPedido,
                itens: pedidoItens,
                notaFiscal,
                metadata: {
                    pedidoId: newPedido.id,
                    codigoPedido: codigoPedidoFinal,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            if (createdHere && transaction && !transaction.finished) {
                try { await transaction.rollback(); } catch (rbErr) {}
            }
            throw new Error(`Erro ao criar pedido: ${error.message}`);
        }
    }

    // ------------------------------------------------------------------------
    //  MÉTODOS AUXILIARES DE CRIAÇÃO
    // ------------------------------------------------------------------------
    async _buscarOuCriarClienteEndereco(dados, transaction) {
        const { cliente, cliente_id, endereco, endereco_id, cep } = dados;
        let clienteEncontrado = null;
        let enderecoEncontrado = null;

        // Cliente
        if (cliente_id) {
            clienteEncontrado = await db.Clientes.findByPk(Number(cliente_id), { transaction });
        } else if (cliente) {
            if (typeof cliente === 'object') {
                // Busca por CPF, email ou nome
                if (cliente.cpf) {
                    clienteEncontrado = await db.Clientes.findOne({ where: { cpf: cliente.cpf }, transaction });
                }
                if (!clienteEncontrado && cliente.email) {
                    clienteEncontrado = await db.Clientes.findOne({ where: { email: cliente.email }, transaction });
                }
                if (!clienteEncontrado && cliente.nome) {
                    clienteEncontrado = await db.Clientes.findOne({ where: { nome: cliente.nome }, transaction });
                }
                // Cria se não existir
                if (!clienteEncontrado) {
                    clienteEncontrado = await db.Clientes.create({
                        nome: cliente.nome || 'Cliente sem nome',
                        cpf: cliente.cpf || null,
                        email: cliente.email || null,
                        telefone: cliente.telefone || null,
                        tipo: cliente.tipo || 'FISICA'
                    }, { transaction });
                }
            } else {
                clienteEncontrado = await db.Clientes.findOne({ where: { nome: cliente }, transaction });
            }
        }

        if (!clienteEncontrado) {
            throw new Error("Cliente não encontrado e não foi possível criar automaticamente");
        }

        // Endereço
        if (endereco_id) {
            enderecoEncontrado = await db.Enderecos.findByPk(Number(endereco_id), { transaction });
        } else if (cep) {
            enderecoEncontrado = await db.Enderecos.findOne({
                where: { cep, cliente_id: clienteEncontrado.id },
                transaction
            });
            if (!enderecoEncontrado) {
                enderecoEncontrado = await db.Enderecos.create({
                    cliente_id: clienteEncontrado.id,
                    cep,
                    rua: null,
                    numero: null,
                    bairro: null,
                    cidade: null,
                    estado: null
                }, { transaction });
            }
        } else if (endereco && typeof endereco === 'object') {
            if (endereco.cep) {
                enderecoEncontrado = await db.Enderecos.findOne({
                    where: { cep: endereco.cep, cliente_id: clienteEncontrado.id },
                    transaction
                });
            }
            if (!enderecoEncontrado) {
                // Cria com dados fornecidos (campos podem ser nulos)
                enderecoEncontrado = await db.Enderecos.create({
                    cliente_id: clienteEncontrado.id,
                    cep: endereco.cep || null,
                    rua: endereco.rua || null,
                    numero: endereco.numero || null,
                    complemento: endereco.complemento || null,
                    bairro: endereco.bairro || null,
                    cidade: endereco.cidade || null,
                    estado: endereco.estado || null,
                    pais: endereco.pais || 'Brasil',
                    tipo: endereco.tipo || 'RESIDENCIAL'
                }, { transaction });
            }
        }

        if (!enderecoEncontrado) {
            throw new Error("Endereço não encontrado e não foi possível criar um novo");
        }

        return { clienteEncontrado, enderecoEncontrado };
    }

    async _criarRegistrosRelacionados(pedidoId, transaction) {
        await this._checkTransaction(transaction, 'criarRegistrosRelacionados');

        // Separação
        const separacaoExistente = await db.Separacao.findOne({
            where: { pedido_id: pedidoId },
            transaction
        });
        if (!separacaoExistente) {
            await db.Separacao.create({
                pedido_id: pedidoId,
                status: 'PENDENTE',
                data_separacao: null
            }, { transaction });
        }

        // Rastreamento
        const rastreamentoExistente = await db.Rastreamentos.findOne({
            where: { pedido_id: pedidoId },
            transaction
        });
        if (!rastreamentoExistente) {
            await db.Rastreamentos.create({
                pedido_id: pedidoId,
                status_atual: 'NO_HUB',   // status válido no enum de rastreamento
                data_status: new Date(),
                localizacao: 'Sistema'
            }, { transaction });
        }
    }

    async _reservarEstoquePorItens(pedidoItens, referencia, usuario_id, options = {}) {
        for (const item of pedidoItens) {
            const hubSelecionado = await this._selectHubForProduto(item.produto_id, item.quantidade, { transaction: options.transaction });
            if (!hubSelecionado) {
                throw new Error(`Nenhum hub com estoque disponível para reservar produto ID: ${item.produto_id}`);
            }
            await estoqueService.reservarProduto({
                produto_id: item.produto_id,
                hub_id: hubSelecionado,
                quantidade: item.quantidade,
                usuario_id,
                referencia
            }, { transaction: options.transaction });
        }
    }

    async _consumirEstoquePorItens(pedidoItens, referencia, usuario_id, options = {}) {
        for (const item of pedidoItens) {
            const hubSelecionado = await this._selectHubForProduto(item.produto_id, item.quantidade, { transaction: options.transaction });
            if (!hubSelecionado) {
                throw new Error(`Nenhum hub com estoque disponível para consumir produto ID: ${item.produto_id}`);
            }
            await estoqueService.saidaEstoque({
                produto_id: item.produto_id,
                hub_id: hubSelecionado,
                quantidade: item.quantidade,
                usuario_id,
                referencia,
                consumirReservas: true
            }, { transaction: options.transaction });
        }
    }

    async _selectHubForProduto(produto_id, quantidade = 1, options = {}) {
        const estoques = await db.Estoques.findAll({
            where: { produto_id },
            include: [{ model: db.Hubs }],
            transaction: options.transaction
        });
        if (!estoques || estoques.length === 0) return null;

        const disponiveis = estoques.map(e => ({
            hub_id: e.hub_id,
            disponivel: Number(e.quantidade_total || 0) - Number(e.quantidade_reservada || 0)
        }));

        const suficiente = disponiveis.find(d => d.disponivel >= quantidade);
        if (suficiente) return suficiente.hub_id;

        disponiveis.sort((a, b) => b.disponivel - a.disponivel);
        return disponiveis[0]?.hub_id || null;
    }

    // ------------------------------------------------------------------------
    //  ATUALIZAÇÃO DE PEDIDO
    // ------------------------------------------------------------------------
    async updatePedido(id, dadosAtualizados, options = {}) {
        const externalTx = options.transaction;
        const transaction = externalTx || await db.sequelize.transaction();
        const createdHere = !externalTx;

        try {
            await this._checkTransaction(transaction, 'updatePedido');

            const pedidoAtual = await db.Pedidos.findByPk(id, {
                include: [{ model: db.PedidoItens, as: 'itens' }],
                transaction
            });
            if (!pedidoAtual) throw new Error('Pedido não encontrado');

            const updates = await this._prepararDadosAtualizacao({
                cliente: dadosAtualizados.cliente,
                endereco: dadosAtualizados.endereco,
                status: dadosAtualizados.status,
                conferencia_id: dadosAtualizados.conferencia_id,
                recebimento_id: dadosAtualizados.recebimento_id,
                transferencia_id: dadosAtualizados.transferencia_id,
                transporte_id: dadosAtualizados.transporte_id
            }, transaction);

            const [nUpdated, updatedRows] = await db.Pedidos.update(updates, {
                where: { id },
                transaction,
                returning: true
            });
            if (!nUpdated) throw new Error('Pedido não encontrado para atualização');

            const pedidoAtualizado = updatedRows[0];

            if (dadosAtualizados.status && dadosAtualizados.status !== pedidoAtual.status) {
                await this._handleStatusTransition(pedidoAtual, pedidoAtualizado, {
                    transaction,
                    usuario_id: options.usuario_id
                });

                const statusRastreamento = this._mapPedidoStatusToRastreamentoStatus(dadosAtualizados.status);
                await db.Rastreamentos.create({
                    pedido_id: id,
                    status_atual: statusRastreamento,
                    data_status: new Date(),
                    localizacao: 'Sistema'
                }, { transaction });
            }

            if (createdHere) {
                await this._checkTransaction(transaction, 'Commit updatePedido');
                await transaction.commit();
            }

            return pedidoAtualizado;
        } catch (error) {
            if (createdHere && transaction && !transaction.finished) {
                try { await transaction.rollback(); } catch (rbErr) {}
            }
            throw error;
        }
    }

    async _prepararDadosAtualizacao(dados, transaction) {
        const updates = {
            status: dados.status,
            conferencia_id: dados.conferencia_id ? Number(dados.conferencia_id) : undefined,
            recebimento_id: dados.recebimento_id ? Number(dados.recebimento_id) : undefined,
            transferencia_id: dados.transferencia_id ? Number(dados.transferencia_id) : undefined,
            transporte_id: dados.transporte_id ? Number(dados.transporte_id) : undefined,
            updatedAt: new Date()
        };

        if (dados.cliente) {
            const cliente = await db.Clientes.findOne({ where: { nome: dados.cliente }, transaction });
            if (cliente) updates.cliente_id = cliente.id;
        }
        if (dados.endereco && typeof dados.endereco === 'string') {
            const endereco = await db.Enderecos.findOne({ where: { cep: dados.endereco }, transaction });
            if (endereco) updates.endereco_id = endereco.id;
        }

        return updates;
    }

    async _handleStatusTransition(pedidoAnterior, pedidoAtualizado, options = {}) {
        const transaction = options.transaction;
        const usuario_id = options.usuario_id || process.env.SYSTEM_USER_ID || 1;
        const prev = pedidoAnterior.status;
        const next = pedidoAtualizado.status;

        const pedidoItens = await db.PedidoItens.findAll({
            where: { pedido_id: pedidoAtualizado.id },
            transaction
        });

        if (['PROCESSANDO', 'AGUARDANDO_SEPARACAO'].includes(next) && prev !== next) {
            for (const item of pedidoItens) {
                const hubSelecionado = await this._selectHubForProduto(item.produto_id, item.quantidade, { transaction });
                if (!hubSelecionado) {
                    throw new Error(`Nenhum hub disponível para reservar produto ID: ${item.produto_id}`);
                }
                await estoqueService.reservarProduto({
                    produto_id: item.produto_id,
                    hub_id: hubSelecionado,
                    quantidade: item.quantidade,
                    usuario_id,
                    referencia: pedidoAtualizado.codigo_pedido
                }, { transaction });
            }
        }

        if (next === 'CANCELADO' && prev !== 'CANCELADO') {
            for (const item of pedidoItens) {
                const hubSelecionado = await this._selectHubForProduto(item.produto_id, item.quantidade, { transaction });
                if (hubSelecionado) {
                    await estoqueService.liberarReserva({
                        produto_id: item.produto_id,
                        hub_id: hubSelecionado,
                        quantidade: item.quantidade,
                        usuario_id,
                        referencia: pedidoAtualizado.codigo_pedido
                    }, { transaction });
                }
            }
        }

        if (next === 'EM_ROTA' && prev !== 'EM_ROTA') {
            for (const item of pedidoItens) {
                const hubSelecionado = await this._selectHubForProduto(item.produto_id, item.quantidade, { transaction });
                if (!hubSelecionado) {
                    throw new Error(`Nenhum hub disponível para consumir produto ID: ${item.produto_id}`);
                }
                await estoqueService.saidaEstoque({
                    produto_id: item.produto_id,
                    hub_id: hubSelecionado,
                    quantidade: item.quantidade,
                    usuario_id,
                    referencia: pedidoAtualizado.codigo_pedido,
                    consumirReservas: true
                }, { transaction });
            }
        }
    }

    // ------------------------------------------------------------------------
    //  ASSOCIAÇÕES
    // ------------------------------------------------------------------------
    async associarRecebimento(pedidoId, recebimentoId) {
        return this._associarEntidade(pedidoId, recebimentoId, 'recebimento_id', 'Recebimentos', 'recebimentos');
    }

    async associarTransferencia(pedidoId, transferenciaId) {
        return this._associarEntidade(pedidoId, transferenciaId, 'transferencia_id', 'Transferencias', 'transferencias');
    }

    async associarConferencia(pedidoId, conferenciaId) {
        return this._associarEntidade(pedidoId, conferenciaId, 'conferencia_id', 'Conferencias', 'conferencias');
    }

    async _associarEntidade(pedidoId, entidadeId, campoId, modelo, nomeEntidade) {
        const transaction = await db.sequelize.transaction();
        try {
            const pedido = await db.Pedidos.findByPk(pedidoId, { transaction });
            if (!pedido) throw new Error('Pedido não encontrado');

            const entidade = await db[modelo].findByPk(Number(entidadeId), { transaction });
            if (!entidade) throw new Error(`${nomeEntidade} não encontrad${nomeEntidade.endsWith('a') ? 'a' : 'o'}`);

            await pedido.update({ [campoId]: entidadeId, updatedAt: new Date() }, { transaction });

            await db.Rastreamentos.create({
                pedido_id: pedidoId,
                status_atual: this._mapPedidoStatusToRastreamentoStatus(pedido.status),
                data_status: new Date(),
                localizacao: 'Sistema'
            }, { transaction });

            await transaction.commit();
            return { success: true, message: `Pedido associado ao ${nomeEntidade.toLowerCase()} com sucesso` };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async removerAssociacaoRecebimento(pedidoId) {
        return this._removerAssociacaoEntidade(pedidoId, 'recebimento_id', 'recebimentos');
    }

    async removerAssociacaoTransferencia(pedidoId) {
        return this._removerAssociacaoEntidade(pedidoId, 'transferencia_id', 'transferencias');
    }

    async removerAssociacaoConferencia(pedidoId) {
        return this._removerAssociacaoEntidade(pedidoId, 'conferencia_id', 'conferencias');
    }

    async _removerAssociacaoEntidade(pedidoId, campoId, nomeEntidade) {
        const transaction = await db.sequelize.transaction();
        try {
            const pedido = await db.Pedidos.findByPk(pedidoId, { transaction });
            if (!pedido) throw new Error('Pedido não encontrado');
            if (!pedido[campoId]) throw new Error(`Pedido não está associado a nenhum ${nomeEntidade}`);

            await pedido.update({ [campoId]: null, updatedAt: new Date() }, { transaction });

            await db.Rastreamentos.create({
                pedido_id: pedidoId,
                status_atual: this._mapPedidoStatusToRastreamentoStatus(pedido.status),
                data_status: new Date(),
                localizacao: 'Sistema'
            }, { transaction });

            await transaction.commit();
            return { success: true, message: `Associação com ${nomeEntidade} removida com sucesso` };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async associarTransporte(pedidosIds, transporteId) {
        return this._associarEntidadeEmMassa(pedidosIds, transporteId, 'transporte_id', 'Transportes', 'transportes');
    }

    async associarConferenciaEmMassa(pedidosIds, conferenciaId) {
        return this._associarEntidadeEmMassa(pedidosIds, conferenciaId, 'conferencia_id', 'Conferencias', 'conferencias');
    }

    async _associarEntidadeEmMassa(pedidosIds, entidadeId, campoId, modelo, nomeEntidade) {
        const transaction = await db.sequelize.transaction();
        try {
            const entidade = await db[modelo].findByPk(Number(entidadeId), { transaction });
            if (!entidade) throw new Error(`${nomeEntidade} não encontrad${nomeEntidade.endsWith('a') ? 'a' : 'o'}`);

            const pedidos = await db.Pedidos.findAll({
                where: { id: pedidosIds.map(id => Number(id)) },
                transaction
            });
            if (pedidos.length !== pedidosIds.length) {
                const encontrados = pedidos.map(p => p.id);
                const naoEncontrados = pedidosIds.filter(id => !encontrados.includes(Number(id)));
                throw new Error(`Pedidos não encontrados: ${naoEncontrados.join(', ')}`);
            }

            const pedidosComConflito = pedidos.filter(p => p[campoId] && p[campoId] !== entidadeId);
            if (pedidosComConflito.length > 0) {
                throw new Error(`Pedidos já associados a outro ${nomeEntidade.toLowerCase()}: ${pedidosComConflito.map(p => p.id).join(', ')}`);
            }

            await db.Pedidos.update(
                { [campoId]: entidadeId, updatedAt: new Date() },
                { where: { id: pedidosIds.map(id => Number(id)) }, transaction }
            );

            const registrosRastreamento = pedidos.map(pedido => ({
                pedido_id: pedido.id,
                status_atual: this._mapPedidoStatusToRastreamentoStatus(pedido.status),
                data_status: new Date(),
                localizacao: 'Sistema',
                createdAt: new Date(),
                updatedAt: new Date()
            }));
            await db.Rastreamentos.bulkCreate(registrosRastreamento, { transaction });

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
        return this._removerAssociacaoEntidadeEmMassa(pedidosIds, 'transporte_id', 'transportes');
    }

    async removerAssociacaoConferenciaEmMassa(pedidosIds) {
        return this._removerAssociacaoEntidadeEmMassa(pedidosIds, 'conferencia_id', 'conferencias');
    }

    async _removerAssociacaoEntidadeEmMassa(pedidosIds, campoId, nomeEntidade) {
        const transaction = await db.sequelize.transaction();
        try {
            const pedidos = await db.Pedidos.findAll({
                where: { id: pedidosIds.map(id => Number(id)) },
                transaction
            });
            if (pedidos.length !== pedidosIds.length) {
                const encontrados = pedidos.map(p => p.id);
                const naoEncontrados = pedidosIds.filter(id => !encontrados.includes(Number(id)));
                throw new Error(`Pedidos não encontrados: ${naoEncontrados.join(', ')}`);
            }

            const pedidosSemAssociacao = pedidos.filter(p => !p[campoId]);
            if (pedidosSemAssociacao.length > 0) {
                throw new Error(`Pedidos não estão associados a nenhum ${nomeEntidade}: ${pedidosSemAssociacao.map(p => p.id).join(', ')}`);
            }

            await db.Pedidos.update(
                { [campoId]: null, updatedAt: new Date() },
                { where: { id: pedidosIds.map(id => Number(id)) }, transaction }
            );

            const registrosRastreamento = pedidos.map(pedido => ({
                pedido_id: pedido.id,
                status_atual: this._mapPedidoStatusToRastreamentoStatus(pedido.status),
                data_status: new Date(),
                localizacao: 'Sistema',
                createdAt: new Date(),
                updatedAt: new Date()
            }));
            await db.Rastreamentos.bulkCreate(registrosRastreamento, { transaction });

            await transaction.commit();
            return {
                success: true,
                message: `${pedidosIds.length} pedido(s) tiveram a associação com ${nomeEntidade} removida`,
                pedidosProcessados: pedidosIds
            };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    // ------------------------------------------------------------------------
    //  OUTROS MÉTODOS
    // ------------------------------------------------------------------------
    async saidaEstoquePorPedido(pedidoId, options = {}) {
        const externalTx = options.transaction;
        const transaction = externalTx || await db.sequelize.transaction();
        const createdHere = !externalTx;

        try {
            const usuario_id = options.usuario_id || process.env.SYSTEM_USER_ID || 1;
            const pedido = await db.Pedidos.findByPk(pedidoId, {
                include: [{ model: db.PedidoItens, as: 'itens' }],
                transaction
            });
            if (!pedido) throw new Error('Pedido não encontrado');

            for (const item of pedido.itens) {
                const hub_id = await this._selectHubForProduto(item.produto_id, item.quantidade, { transaction });
                if (!hub_id) throw new Error(`Nenhum hub disponível para produto ID: ${item.produto_id}`);

                await estoqueService.saidaEstoque({
                    produto_id: item.produto_id,
                    hub_id,
                    quantidade: item.quantidade,
                    usuario_id,
                    referencia: pedido.codigo_pedido,
                    consumirReservas: true
                }, { transaction });
            }

            await pedido.update({ status: 'EM_ROTA', updatedAt: new Date() }, { transaction });

            await db.Rastreamentos.create({
                pedido_id: pedido.id,
                status_atual: 'EM_ROTA',
                data_status: new Date(),
                localizacao: 'Estoque / Saída'
            }, { transaction });

            if (createdHere) {
                await this._checkTransaction(transaction, 'Commit saidaEstoque');
                await transaction.commit();
            }

            return pedido;
        } catch (error) {
            if (createdHere && transaction && !transaction.finished) {
                try { await transaction.rollback(); } catch (rbErr) {}
            }
            throw error;
        }
    }

    async getProdutosByPedido(id) {
        const pedido = await db.Pedidos.findByPk(id, {
            include: [{
                model: db.PedidoItens,
                as: 'itens',
                include: [{ model: db.Produtos, as: 'produtos' }]
            }]
        });
        return pedido ? pedido.itens.map(item => item.produtos) : [];
    }

    async getColetaByPedido(id) {
        const pedido = await db.Pedidos.findByPk(id, {
            include: [{ model: db.Recebimentos, as: 'recebimentos' }]
        });
        return pedido?.recebimentos || null;
    }

    async getExpedicaoByPedido(id) {
        const pedido = await db.Pedidos.findByPk(id, {
            include: [{ model: db.Transferencias, as: 'transferencias' }]
        });
        return pedido?.transferencias || null;
    }

    async criarSeparacao(pedidoId, transaction = null) {
        const options = transaction ? { transaction } : {};
        const separacaoExistente = await db.Separacao.findOne({
            where: { pedido_id: pedidoId },
            ...options
        });
        if (separacaoExistente) {
            throw new Error('Já existe uma separação para este pedido');
        }
        return db.Separacao.create({
            pedido_id: pedidoId,
            status: 'PENDENTE',
            data_separacao: null
        }, options);
    }

    async ensureNotaParaPedido(pedidoId, options = {}) {
        const transaction = options.transaction;
        const notaExistente = await db.NotasFiscais.findOne({
            where: { pedido_id: pedidoId },
            transaction
        });
        if (notaExistente) return notaExistente;

        const pedido = await db.Pedidos.findByPk(pedidoId, {
            include: [{
                model: db.PedidoItens,
                as: 'itens',
                include: [{ model: db.Produtos, as: 'produtos' }]
            }],
            transaction
        });
        if (!pedido) throw new Error(`Pedido ${pedidoId} não encontrado`);

        return notasFiscaisService.createNotaParaPedido(pedido, { transaction });
    }
}

module.exports = PedidosServices;