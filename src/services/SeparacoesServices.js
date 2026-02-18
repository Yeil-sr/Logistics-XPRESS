const Services = require('./Services');
const db = require('../models');

class SeparacoesServices extends Services {
    constructor() {
        super('Separacao');
    }

    /**
     * Verifica estado da transação
     */
    async verificarTransacao(transaction) {
        if (!transaction) {
            console.error('[SeparacoesServices] Transação é nula');
            return false;
        }

        try {
            // Verificar estado interno do Sequelize
            if (transaction.finished) {
                console.error('[SeparacoesServices] Transação já finalizada:', transaction.finished);
                return false;
            }

            // Testar com consulta simples
            await db.sequelize.query('SELECT 1 as teste', {
                transaction,
                type: db.sequelize.QueryTypes.SELECT,
                logging: (sql) => console.debug('[SeparacoesServices] Teste transação SQL:', sql)
            });

            console.debug('[SeparacoesServices] Transação ativa e válida');
            return true;
        } catch (error) {
            console.error('[SeparacoesServices] ERRO ao verificar transação:', {
                message: error.message,
                code: error.parent?.code
            });

            if (error.message.includes('aborted') || error.message.includes('25P02')) {
                console.error('[SeparacoesServices] TRANSAÇÃO ABORTADA DETECTADA');
                return false;
            }

            return false;
        }
    }

    /**
     * Cria uma separação para um pedido com verificação robusta
     */
    async createSeparacao(pedidoId, options = {}) {
        const transaction = options.transaction;
        console.log('[SeparacoesServices] INÍCIO: createSeparacao', {
            pedidoId,
            transactionId: transaction?.id,
            timestamp: new Date().toISOString()
        });

        try {
            // Verificar estado da transação
            if (transaction) {
                const transacaoValida = await this.verificarTransacao(transaction);
                if (!transacaoValida) {
                    console.error('[SeparacoesServices] Transação inválida ao criar separação');
                    throw new Error('Transação inválida para criar separação');
                }
            }

            // Verificar se já existe separação para este pedido
            const separacaoExistente = await db.Separacao.findOne({
                where: { pedido_id: pedidoId },
                transaction,
                logging: (sql) => console.debug('[SeparacoesServices] SQL findOne separacao:', sql)
            });

            if (separacaoExistente) {
                console.log('[SeparacoesServices] Separação já existe para o pedido:', {
                    separacaoId: separacaoExistente.id,
                    pedidoId,
                    status: separacaoExistente.status
                });
                return separacaoExistente;
            }

            // Verificar se o pedido existe
            const pedido = await db.Pedidos.findByPk(pedidoId, {
                transaction,
                logging: (sql) => console.debug('[SeparacoesServices] SQL find pedido:', sql)
            });

            if (!pedido) {
                console.error('[SeparacoesServices] Pedido não encontrado:', pedidoId);
                throw new Error(`Pedido ${pedidoId} não encontrado`);
            }

            // Criar nova separação
            console.log('[SeparacoesServices] Criando nova separação para pedido:', pedidoId);
            const separacao = await db.Separacao.create({
                pedido_id: pedidoId,
                status: 'PENDENTE',
                data_separacao: null
            }, {
                transaction,
                logging: (sql) => console.log('[SeparacoesServices] SQL create separacao:', sql)
            });

            console.log('[SeparacoesServices] Separação criada com sucesso:', {
                separacaoId: separacao.id,
                pedidoId,
                status: separacao.status
            });

            return separacao;

        } catch (error) {
            console.error('[SeparacoesServices] ERRO ao criar separação:', {
                message: error.message,
                pedidoId,
                transactionId: transaction?.id,
                sql: error.parent?.sql,
                code: error.parent?.code,
                detail: error.parent?.detail,
                constraint: error.parent?.constraint
            });

            // Verificar se é erro de constraint (duplicação)
            if (error.parent?.code === '23505') { // Unique violation
                console.warn('[SeparacoesServices] Separação já existe (violação de unique)');
                
                // Tentar buscar a separação existente
                const separacaoExistente = await db.Separacao.findOne({
                    where: { pedido_id: pedidoId },
                    transaction
                });
                
                if (separacaoExistente) {
                    console.log('[SeparacoesServices] Retornando separação existente após violação:', separacaoExistente.id);
                    return separacaoExistente;
                }
            }

            throw error;
        }
    }

    /**
     * Marca separação como concluída
     */
    async marcarComoSeparado(id, options = {}) {
        const transaction = options.transaction || (await db.sequelize.transaction());
        const createdHere = !options.transaction;

        console.log('[SeparacoesServices] INÍCIO: marcarComoSeparado', {
            separacaoId: id,
            transactionId: transaction.id,
            createdHere
        });

        try {
            // Verificar estado da transação
            const transacaoValida = await this.verificarTransacao(transaction);
            if (!transacaoValida) {
                throw new Error('Transação inválida para marcar separação');
            }

            // Buscar separação com pedido
            const separacao = await db.Separacao.findByPk(id, {
                include: [{
                    model: db.Pedidos,
                    as: 'pedido',
                    attributes: ['id', 'status', 'codigo_pedido']
                }],
                transaction,
                logging: (sql) => console.debug('[SeparacoesServices] SQL find separacao:', sql)
            });
            
            if (!separacao) {
                console.error('[SeparacoesServices] Separação não encontrada:', id);
                throw new Error('Separação não encontrada');
            }

            console.log('[SeparacoesServices] Separação encontrada:', {
                separacaoId: separacao.id,
                pedidoId: separacao.pedido?.id,
                statusAtual: separacao.status
            });

            // Atualizar separação
            await separacao.update({
                status: 'SEPARADO',
                data_separacao: new Date()
            }, {
                transaction,
                logging: (sql) => console.log('[SeparacoesServices] SQL update separacao:', sql)
            });

            // Atualizar status do pedido
            if (separacao.pedido) {
                await db.Pedidos.update(
                    { status: 'AGUARDANDO_COLETA' },
                    { 
                        where: { id: separacao.pedido.id }, 
                        transaction,
                        logging: (sql) => console.log('[SeparacoesServices] SQL update pedido:', sql)
                    }
                );
            }

            // Criar rastreamento
            if (separacao.pedido) {
                await db.Rastreamentos.create({
                    pedido_id: separacao.pedido.id,
                    status_atual: 'AGUARDANDO_COLETA',
                    data_status: new Date(),
                    localizacao: 'Área de separação'
                }, {
                    transaction,
                    logging: (sql) => console.log('[SeparacoesServices] SQL create rastreamento:', sql)
                });
            }

            if (createdHere) {
                await transaction.commit();
                console.log('[SeparacoesServices] Transação commitada com sucesso');
            }

            console.log('[SeparacoesServices] FIM: marcarComoSeparado - sucesso', {
                separacaoId: separacao.id,
                novoStatus: 'SEPARADO'
            });

            return separacao;

        } catch (error) {
            console.error('[SeparacoesServices] ERRO em marcarComoSeparado:', {
                message: error.message,
                separacaoId: id,
                transactionId: transaction.id
            });

            if (createdHere && transaction && !transaction.finished) {
                console.log('[SeparacoesServices] Rollback da transação');
                await transaction.rollback();
            }

            throw error;
        }
    }

    /**
     * Busca pedidos pendentes de separação
     */
    async getPedidosPendentes(options = {}) {
        console.log('[SeparacoesServices] INÍCIO: getPedidosPendentes');

        try {
            const separacoes = await db.Separacao.findAll({
                where: { status: 'PENDENTE' },
                include: [{
                    model: db.Pedidos,
                    as: 'pedido',
                    include: [{
                        model: db.Produtos,
                        as: 'produto'
                    }]
                }],
                order: [['created_at', 'ASC']],
                logging: (sql) => console.debug('[SeparacoesServices] SQL find pedidos pendentes:', sql)
            });

            console.log('[SeparacoesServices] Pedidos pendentes encontrados:', separacoes.length);
            return separacoes;

        } catch (error) {
            console.error('[SeparacoesServices] ERRO ao buscar pedidos pendentes:', error.message);
            throw error;
        }
    }

    /**
     * Busca todas as separações com filtros
     */
    async getAllWithFilters(options = {}) {
        console.log('[SeparacoesServices] INÍCIO: getAllWithFilters', {
            page: options.page,
            limit: options.limit,
            filters: options.filters
        });

        const {
            page = 1,
            limit = 10,
            sortBy = 'created_at',
            sortOrder = 'DESC',
            filters = {}
        } = options;

        const offset = (page - 1) * limit;
        
        const whereConditions = {};
        
        if (filters.status) {
            whereConditions.status = filters.status;
        }
        
        if (filters.data_inicio && filters.data_fim) {
            whereConditions.data_separacao = {
                [db.Sequelize.Op.between]: [new Date(filters.data_inicio), new Date(filters.data_fim)]
            };
        }

        if (filters.pedido_id) {
            whereConditions.pedido_id = Number(filters.pedido_id);
        }

        try {
            const { count, rows } = await db.Separacao.findAndCountAll({
                where: whereConditions,
                include: [{
                    model: db.Pedidos,
                    as: 'pedido',
                    include: [{
                        model: db.Produtos,
                        as: 'produto'
                    }]
                }],
                order: [[sortBy, sortOrder]],
                limit: parseInt(limit),
                offset: offset,
                distinct: true,
                logging: (sql) => console.debug('[SeparacoesServices] SQL findAndCountAll:', sql)
            });

            console.log('[SeparacoesServices] Separações encontradas:', {
                total: count,
                currentPage: page,
                totalPages: Math.ceil(count / limit)
            });

            return {
                separacoes: rows,
                total: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                limit: limit
            };
        } catch (error) {
            console.error('[SeparacoesServices] ERRO ao buscar separações:', {
                message: error.message,
                sql: error.parent?.sql,
                code: error.parent?.code
            });
            throw new Error(`Erro ao buscar separações: ${error.message}`);
        }
    }

    /**
     * Atualiza uma separação
     */
    async updateSeparacao(id, updates = {}, options = {}) {
        const transaction = options.transaction;
        console.log('[SeparacoesServices] INÍCIO: updateSeparacao', {
            separacaoId: id,
            updates,
            transactionId: transaction?.id
        });

        try {
            // Verificar estado da transação
            if (transaction) {
                const transacaoValida = await this.verificarTransacao(transaction);
                if (!transacaoValida) {
                    throw new Error('Transação inválida para atualizar separação');
                }
            }

            const separacao = await db.Separacao.findByPk(id, {
                transaction,
                logging: (sql) => console.debug('[SeparacoesServices] SQL find separacao:', sql)
            });

            if (!separacao) {
                console.error('[SeparacoesServices] Separação não encontrada:', id);
                throw new Error('Separação não encontrada');
            }

            // Atualizar separação
            await separacao.update(updates, {
                transaction,
                logging: (sql) => console.log('[SeparacoesServices] SQL update separacao:', sql)
            });

            console.log('[SeparacoesServices] Separação atualizada com sucesso:', {
                separacaoId: separacao.id,
                novoStatus: updates.status
            });

            return separacao;

        } catch (error) {
            console.error('[SeparacoesServices] ERRO ao atualizar separação:', {
                message: error.message,
                separacaoId: id
            });
            throw error;
        }
    }

    /**
     * Remove uma separação
     */
    async deleteSeparacao(id, options = {}) {
        const transaction = options.transaction;
        console.log('[SeparacoesServices] INÍCIO: deleteSeparacao', {
            separacaoId: id,
            transactionId: transaction?.id
        });

        try {
            // Verificar estado da transação
            if (transaction) {
                const transacaoValida = await this.verificarTransacao(transaction);
                if (!transacaoValida) {
                    throw new Error('Transação inválida para deletar separação');
                }
            }

            const separacao = await db.Separacao.findByPk(id, {
                transaction,
                logging: (sql) => console.debug('[SeparacoesServices] SQL find separacao:', sql)
            });

            if (!separacao) {
                console.error('[SeparacoesServices] Separação não encontrada:', id);
                throw new Error('Separação não encontrada');
            }

            // Deletar separação
            await separacao.destroy({
                transaction,
                logging: (sql) => console.log('[SeparacoesServices] SQL delete separacao:', sql)
            });

            console.log('[SeparacoesServices] Separação deletada com sucesso:', id);
            return { success: true, message: 'Separação deletada com sucesso' };

        } catch (error) {
            console.error('[SeparacoesServices] ERRO ao deletar separação:', {
                message: error.message,
                separacaoId: id
            });
            throw error;
        }
    }

    /**
     * Busca separação por ID com detalhes
     */
    async getSeparacaoById(id, options = {}) {
        const transaction = options.transaction;
        console.log('[SeparacoesServices] INÍCIO: getSeparacaoById', {
            separacaoId: id,
            transactionId: transaction?.id
        });

        try {
            const separacao = await db.Separacao.findByPk(id, {
                include: [{
                    model: db.Pedidos,
                    as: 'pedido',
                    include: [
                        {
                            model: db.Clientes,
                            as: 'clientes',
                            attributes: ['id', 'nome', 'cpf', 'email']
                        },
                        {
                            model: db.Enderecos,
                            as: 'enderecos',
                            attributes: ['id', 'rua', 'numero', 'bairro', 'cidade', 'estado', 'cep']
                        },
                        {
                            model: db.PedidoItens,
                            as: 'itens',
                            include: [{
                                model: db.Produtos,
                                as: 'produtos',
                                attributes: ['id', 'nome', 'descricao', 'preco']
                            }]
                        }
                    ]
                }],
                transaction,
                logging: (sql) => console.debug('[SeparacoesServices] SQL find separacao by id:', sql)
            });

            if (!separacao) {
                console.error('[SeparacoesServices] Separação não encontrada:', id);
                throw new Error('Separação não encontrada');
            }

            console.log('[SeparacoesServices] Separação encontrada:', {
                separacaoId: separacao.id,
                pedidoId: separacao.pedido?.id,
                status: separacao.status
            });

            return separacao;

        } catch (error) {
            console.error('[SeparacoesServices] ERRO ao buscar separação:', {
                message: error.message,
                separacaoId: id
            });
            throw error;
        }
    }

    /**
     * Busca separações por pedido ID
     */
    async getSeparacaoByPedidoId(pedidoId, options = {}) {
        const transaction = options.transaction;
        console.log('[SeparacoesServices] INÍCIO: getSeparacaoByPedidoId', {
            pedidoId,
            transactionId: transaction?.id
        });

        try {
            const separacao = await db.Separacao.findOne({
                where: { pedido_id: pedidoId },
                transaction,
                logging: (sql) => console.debug('[SeparacoesServices] SQL find separacao by pedido:', sql)
            });

            console.log('[SeparacoesServices] Separação encontrada para pedido:', {
                pedidoId,
                separacaoId: separacao?.id,
                encontrada: !!separacao
            });

            return separacao;

        } catch (error) {
            console.error('[SeparacoesServices] ERRO ao buscar separação por pedido:', {
                message: error.message,
                pedidoId
            });
            throw error;
        }
    }
}

module.exports = SeparacoesServices;