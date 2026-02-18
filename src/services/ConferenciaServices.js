'use strict';

const Services = require('./Services');
const db = require('../models');
const { Op } = require('sequelize');
const NotasFiscaisServices = require('./NotasFiscaisServices');
const ManifestosServices = require('./ManifestosServices');
const PedidosServices = require('./PedidosServices');
const EstoquesServices = require('./EstoquesServices');

const notasFiscaisService = new NotasFiscaisServices();
const manifestosService = new ManifestosServices();
const pedidosService = new PedidosServices();
const estoqueService = new EstoquesServices();

/**
 * Serviço responsável pela gestão de conferências.
 * 
 * CORREÇÕES APLICADAS (fev/2026):
 * - total_AT_TO → total_at_to (alinhamento com schema)
 * - processarConferenciaInbound: criação de estoque por item, não por pedido
 * - include de itens adicionado em concluirConferencia
 * - remoção de referências a campos inexistentes
 * - [FIX] Alias de Motoristas em Transferencias corrigido de 'motoristas' para 'Motorista'
 * - [ADD] Método getPedidosByConferencia para atender à rota /conferencias/:id/pedidos
 * - [FIX] Mapeamento de status para rastreamento (evita erro de enum)
 * - [FIX] Validação de transação reforçada em atualizarEstatisticasConferencia
 * - [FIX] Arredondamento do percentual de validação para DECIMAL(5,2)
 * - [FIX] processarConferenciaInbound: validação de hub de destino e produto_id
 */
class ConferenciaServices extends Services {
  constructor() {
    super('Conferencias');
  }

  // ------------------------------------------------------------------------
  //  MAPEAMENTO DE STATUS PEDIDO → RASTREAMENTO
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

  /**
   * Verifica se a transação está ativa e não foi abortada.
   * Lança erro imediatamente se a transação estiver finalizada ou inválida.
   * @param {Transaction} transaction - Transação Sequelize
   * @param {string} operation - Nome da operação para log
   */
  async _checkTransaction(transaction, operation) {
    if (!transaction) return;
    if (transaction.finished) {
      throw new Error(
        `[ABORTED] Transação já finalizada (${transaction.finished}) - ${operation}`
      );
    }
    try {
      await db.sequelize.query('SELECT 1', {
        transaction,
        type: db.sequelize.QueryTypes.SELECT,
      });
    } catch (err) {
      throw new Error(
        `[ABORTED] Transação inválida ou abortada - ${operation}: ${err.message}`
      );
    }
  }

  // ------------------------------------------------------------------------
  //  CONSULTAS COM FILTROS E PAGINAÇÃO
  // ------------------------------------------------------------------------

  async getAllWithFilters(options = {}) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      filters = {}
    } = options;

    const offset = (page - 1) * limit;
    const whereConditions = {};

    if (filters.tipo) whereConditions.tipo = filters.tipo;
    if (filters.status) whereConditions.status = filters.status;
    if (filters.operador_id) whereConditions.operador_id = filters.operador_id;
    if (filters.manifesto_id) whereConditions.manifesto_id = filters.manifesto_id;

    if (filters.data_inicio && filters.data_fim) {
      whereConditions.data_criacao = {
        [Op.between]: [new Date(filters.data_inicio), new Date(filters.data_fim)]
      };
    } else if (filters.data_inicio) {
      whereConditions.data_criacao = { [Op.gte]: new Date(filters.data_inicio) };
    } else if (filters.data_fim) {
      whereConditions.data_criacao = { [Op.lte]: new Date(filters.data_fim) };
    }

    if (filters.nome_estacao) {
      whereConditions.nome_estacao = { [Op.iLike]: `%${filters.nome_estacao}%` };
    }

    if (filters.disponiveis === true) {
      whereConditions.transporte_id = { [Op.is]: null };
    }

    try {
      const { count, rows } = await db.Conferencias.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: db.Transportes,
            include: [
              { model: db.Motoristas },
              { model: db.Hubs, as: 'hubOrigem' },
              { model: db.Hubs, as: 'hubDestino' }
            ]
          },
          {
            model: db.Manifestos,
            as: 'manifesto',
            include: [{ model: db.NotasFiscais, as: 'nota' }]
          },
          { model: db.Usuarios, as: 'operador', attributes: ['nome', 'role', 'status', 'email'] },
          { model: db.Pedidos, as: 'pedidos' }
        ],
        order: [[sortBy, sortOrder]],
        limit: parseInt(limit),
        offset: offset,
        distinct: true
      });

      return {
        conferencias: rows,
        total: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit: limit
      };
    } catch (error) {
      throw new Error(`Erro ao buscar conferências: ${error.message}`);
    }
  }

  async getConferenciasDisponiveis() {
    try {
      return await db.Conferencias.findAll({
        where: {
          status: 'PENDENTE',
          transporte_id: null
        },
        include: [
          {
            model: db.Pedidos,
            as: 'pedidos',
            attributes: ['id', 'codigo_pedido', 'status']
          },
          {
            model: db.Usuarios,
            as: 'operador',
            attributes: ['id', 'nome']
          },
          {
            model: db.Manifestos,
            as: 'manifesto',
            attributes: ['id', 'numero_manifesto']
          }
        ],
        attributes: ['id', 'nome_estacao', 'status', 'tipo', 'data_criacao', 'total_pedidos_iniciais', 'manifesto_id'],
        order: [['data_criacao', 'DESC']]
      });
    } catch (error) {
      throw new Error(`Erro ao buscar conferências disponíveis: ${error.message}`);
    }
  }

  async findConferencia(identifier) {
    try {
      const id = Number(identifier);

      if (!isNaN(id)) {
        return await db.Conferencias.findByPk(id, {
          include: [
            {
              model: db.Transportes,
              include: [
                { model: db.Motoristas },
                { model: db.Hubs, as: 'hubOrigem' },
                { model: db.Hubs, as: 'hubDestino' }
              ]
            },
            {
              model: db.Manifestos,
              as: 'manifesto',
              include: [{ model: db.NotasFiscais, as: 'nota' }]
            },
            { model: db.Usuarios, as: 'operador' },
            {
              model: db.Pedidos,
              as: 'pedidos',
              include: [
                { model: db.Produtos, as: 'produtos' },
                { model: db.Clientes, as: 'clientes' }
              ]
            }
          ]
        });
      } else {
        return await db.Conferencias.findOne({
          where: {
            nome_estacao: { [Op.iLike]: `%${identifier}%` }
          },
          include: [
            {
              model: db.Transportes,
              include: [
                { model: db.Motoristas },
                { model: db.Hubs, as: 'hubOrigem' },
                { model: db.Hubs, as: 'hubDestino' }
              ]
            },
            {
              model: db.Manifestos,
              as: 'manifesto',
              include: [{ model: db.NotasFiscais, as: 'nota' }]
            },
            { model: db.Usuarios, as: 'operador' },
            {
              model: db.Pedidos,
              as: 'pedidos',
              include: [
                { model: db.Produtos, as: 'produtos' },
                { model: db.Clientes, as: 'clientes' }
              ]
            }
          ]
        });
      }
    } catch (error) {
      throw new Error(`Erro ao buscar conferência: ${error.message}`);
    }
  }

  async searchConferencias(query, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    try {
      const { count, rows } = await db.Conferencias.findAndCountAll({
        where: {
          [Op.or]: [
            { nome_estacao: { [Op.iLike]: `%${query}%` } },
            { tipo: { [Op.iLike]: `%${query}%` } },
            { status: { [Op.iLike]: `%${query}%` } },
            { '$transporte.numero_transporte$': { [Op.iLike]: `%${query}%` } },
            { '$operador.nome$': { [Op.iLike]: `%${query}%` } },
            { '$manifesto.numero_manifesto$': { [Op.iLike]: `%${query}%` } }
          ]
        },
        include: [
          {
            model: db.Transportes,
            include: [{ model: db.Motoristas }]
          },
          {
            model: db.Manifestos,
            as: 'manifesto',
            attributes: ['id', 'numero_manifesto']
          },
          { model: db.Usuarios, as: 'operador' },
          { model: db.Pedidos, as: 'pedidos' }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: offset,
        distinct: true
      });

      return {
        conferencias: rows,
        total: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit: limit
      };
    } catch (error) {
      throw new Error(`Erro na busca de conferências: ${error.message}`);
    }
  }

  async getById(id) {
    return db.Conferencias.findByPk(id, {
      include: [
        {
          model: db.Transportes,
          include: [{ model: db.Motoristas }]
        },
        {
          model: db.Manifestos,
          as: 'manifesto',
          include: [{ model: db.NotasFiscais, as: 'nota' }]
        },
        { model: db.Usuarios, as: 'operador', attributes: ['nome', 'role', 'status', 'email'] },
        { model: db.Pedidos, as: 'pedidos' }
      ]
    });
  }

  async getConferenciaCompleta(id) {
    try {
      return await db.Conferencias.findByPk(id, {
        include: [
          {
            model: db.Transportes,
            include: [
              { model: db.Motoristas },
              { model: db.Hubs, as: 'hubOrigem' },
              { model: db.Hubs, as: 'hubDestino' },
              { model: db.Rotas, as: 'rotas' }
            ]
          },
          {
            model: db.Manifestos,
            as: 'manifesto',
            include: [
              {
                model: db.NotasFiscais,
                as: 'nota',
                include: [
                  {
                    model: db.NotasItens,
                    as: 'notaItens',
                    include: [{ model: db.Produtos, as: 'produtos' }]
                  }
                ]
              }
            ]
          },
          {
            model: db.Usuarios,
            as: 'operador',
            attributes: ['id', 'nome', 'email']
          },
          {
            model: db.Pedidos,
            as: 'pedidos',
            include: [
              {
                model: db.Produtos,
                as: 'produtos',
                attributes: ['id', 'nome', 'codigo', 'peso_kg', 'dimensoes']
              },
              {
                model: db.Clientes,
                as: 'clientes',
                attributes: ['id', 'nome', 'telefone', 'email']
              },
              {
                model: db.Enderecos,
                as: 'endereco',
                attributes: ['id', 'numero', 'cidade', 'estado', 'cep']
              }
            ]
          },
          {
            model: db.Transferencias,
            as: 'transferencias',
            required: false,
            include: [
              {
                model: db.Pedidos,
                as: 'pedidos',
                include: [
                  { model: db.Produtos, as: 'produtos' },
                  { model: db.Clientes, as: 'clientes' }
                ]
              },
              { model: db.Hubs, as: 'origemHub' },
              { model: db.Hubs, as: 'destinoHub' },
              { model: db.Motoristas, as: 'Motorista' }
            ]
          }
        ]
      });
    } catch (error) {
      throw new Error(`Erro ao buscar conferência completa: ${error.message}`);
    }
  }

  async getPedidosValidados(conferenciaId) {
    const pedidos = await db.Pedidos.findAll({
      where: {
        conferencia_id: conferenciaId,
        status: 'VALIDADO'
      }
    });
    return pedidos;
  }

  /**
   * Retorna todos os pedidos associados a uma conferência.
   * @param {number} conferenciaId - ID da conferência
   * @returns {Promise<Array>} Lista de pedidos
   */
  async getPedidosByConferencia(conferenciaId) {
    try {
      const conferencia = await db.Conferencias.findByPk(conferenciaId, {
        include: [{
          model: db.Pedidos,
          as: 'pedidos',
          include: [
            { model: db.Produtos, as: 'produtos' },
            { model: db.Clientes, as: 'clientes' }
          ]
        }]
      });
      if (!conferencia) throw new Error('Conferência não encontrada');
      return conferencia.pedidos || [];
    } catch (error) {
      throw new Error(`Erro ao buscar pedidos da conferência: ${error.message}`);
    }
  }

  // ------------------------------------------------------------------------
  //  CRIAÇÃO DE CONFERÊNCIA COM PEDIDOS E MANIFESTO
  //  (CORRIGIDO: total_at_to, data_criacao, tipo)
  // ------------------------------------------------------------------------

  /**
   * Cria conferência com manifesto automaticamente.
   */
  async createComPedidosEmanifesto(dados) {
    const transaction = await db.sequelize.transaction();
    const transactionId = transaction.id || `tx-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    try {
      console.debug(`[Conferencia][${transactionId}] ========== INÍCIO CRIAÇÃO ==========`);
      console.debug(`[Conferencia][${transactionId}] Tipo: ${dados.tipo}, Operador: ${dados.operador_id}`);

      await this._checkTransaction(transaction, 'Início criação conferência');

      if (!dados.tipo) throw new Error('Tipo da conferência é obrigatório');
      if (!dados.operador_id) throw new Error('Operador é obrigatório');

      let manifesto = null;

      // --- Manifesto ---
      if (dados.manifestoId) {
        manifesto = await db.Manifestos.findByPk(dados.manifestoId, { transaction });
        if (!manifesto) throw new Error(`Manifesto com ID ${dados.manifestoId} não encontrado`);
      } else if (dados.numero_manifesto) {
        manifesto = await db.Manifestos.findOne({
          where: { numero_manifesto: dados.numero_manifesto },
          transaction
        });

        if (!manifesto) {
          console.debug(`[Conferencia][${transactionId}] Criando manifesto automaticamente: ${dados.numero_manifesto}`);
          try {
            manifesto = await manifestosService.createManifestoFromPedidos(
              {
                pedidosIds: [],
                numero_manifesto: dados.numero_manifesto,
                serie: dados.serie || '1',
                data_emissao: new Date(),
                origem_hub_id: dados.origem_hub_id,
                destino_hub_id: dados.destino_hub_id,
                transporte_id: dados.transporte_id,
                observacoes: `Manifesto gerado automaticamente para conferência ${dados.tipo}`
              },
              { transaction }
            );
          } catch (err) {
            console.error(`[Conferencia][${transactionId}] Erro ao criar manifesto:`, err.message);
            throw new Error(`Falha ao criar manifesto: ${err.message}`);
          }
        }
      }

      // --- Conferência ---
      await this._checkTransaction(transaction, 'Criação da conferência');
      const conferencia = await db.Conferencias.create(
        {
          tipo: dados.tipo,
          operador_id: dados.operador_id,
          nome_estacao: dados.nome_estacao || null,
          status: 'PENDENTE',
          manifesto_id: manifesto ? manifesto.id : null,
          total_pedidos_iniciais: dados.pedidos?.length || 0,
          total_pedidos_finais: dados.pedidos?.length || 0,
          total_at_to: 0,
          data_criacao: new Date(),
          percentual_validacao: 0,
          pedidos_escaneados: 0
        },
        { transaction }
      );
      console.debug(`[Conferencia][${transactionId}] Conferência criada: ${conferencia.id}`);

      // --- Transporte e Transferência ---
      let transporte = null;
      let transferencia = null;

      if (dados.transporte_id) {
        transporte = await db.Transportes.findByPk(dados.transporte_id, { transaction });
        if (!transporte) throw new Error(`Transporte ${dados.transporte_id} não encontrado`);
        conferencia.transporte_id = transporte.id;
        await conferencia.save({ transaction });
      }

      if (dados.transferencia_id) {
        transferencia = await db.Transferencias.findByPk(dados.transferencia_id, { transaction });
        if (!transferencia) throw new Error(`Transferência ${dados.transferencia_id} não encontrada`);
        if (!transferencia.conferencia_id) {
          transferencia.conferencia_id = conferencia.id;
          await transferencia.save({ transaction });
        }
      } else if (transporte && transporte.transferencia_id) {
        transferencia = await db.Transferencias.findByPk(transporte.transferencia_id, { transaction });
        if (transferencia) {
          if (!transferencia.conferencia_id) {
            transferencia.conferencia_id = conferencia.id;
            await transferencia.save({ transaction });
          }

          let modified = false;
          if (!transferencia.origem_hub_id && (dados.origem_hub_id || transporte.hub_origem_id)) {
            transferencia.origem_hub_id = dados.origem_hub_id || transporte.hub_origem_id;
            modified = true;
          }
          if (!transferencia.destino_hub_id && (dados.destino_hub_id || transporte.hub_destino_id)) {
            transferencia.destino_hub_id = dados.destino_hub_id || transporte.hub_destino_id;
            modified = true;
          }
          if (!transferencia.motorista_id && (dados.motorista_id || transporte.motorista_id)) {
            transferencia.motorista_id = dados.motorista_id || transporte.motorista_id;
            modified = true;
          }
          if (modified) await transferencia.save({ transaction });
        }
      } else if (dados.transferencia && typeof dados.transferencia === 'object') {
        transferencia = await db.Transferencias.create(
          {
            ...dados.transferencia,
            conferencia_id: conferencia.id,
            data_criacao: dados.transferencia.data_criacao || new Date()
          },
          { transaction }
        );
      } else {
        // Cria transferência padrão
        transferencia = await db.Transferencias.create(
          {
            numero_TO: dados.numero_TO || (transporte ? transporte.numero_transporte : `TO${Date.now()}`),
            conferencia_id: conferencia.id,
            motorista_id: dados.motorista_id || (transporte ? transporte.motorista_id : null),
            origem_hub_id: dados.origem_hub_id || (transporte ? transporte.hub_origem_id : null),
            destino_hub_id: dados.destino_hub_id || (transporte ? transporte.hub_destino_id : null),
            tipo_recebedor: dados.tipo_recebedor || (transporte ? transporte.recebedor_tipo : 'HUB'),
            quantidade: dados.quantidade || 0,
            peso_kg: dados.peso_kg || 0,
            direcao: dados.direcao || (transporte ? transporte.direcao : 'OUTBOUND'),
            operador_id: dados.operador_id || (transporte ? transporte.operador_id : null),
            status: dados.status || (transporte ? transporte.status_transporte : 'CRIADO'),
            data_criacao: new Date()
          },
          { transaction }
        );

        if (transporte && transporte.transferencia_id !== transferencia.id) {
          transporte.transferencia_id = transferencia.id;
          await transporte.save({ transaction });
        }
      }

      // --- Processamento de Pedidos ---
      let totalPeso = 0;
      let totalQuantidade = 0;
      const pedidosProcessados = [];

      if (dados.pedidos && Array.isArray(dados.pedidos) && dados.pedidos.length > 0) {
        for (const pedidoIdentifier of dados.pedidos) {
          await this._checkTransaction(transaction, `Processamento do pedido ${JSON.stringify(pedidoIdentifier)}`);

          let pedido;

          try {
            // 1. Buscar ou criar o pedido
            if (typeof pedidoIdentifier === 'number') {
              pedido = await db.Pedidos.findByPk(pedidoIdentifier, {
                transaction,
                include: [{ model: db.Produtos, as: 'produtos', attributes: ['id', 'peso_kg'] }]
              });
            } else if (typeof pedidoIdentifier === 'string') {
              pedido = await db.Pedidos.findOne({
                where: { codigo_pedido: pedidoIdentifier },
                transaction,
                include: [{ model: db.Produtos, as: 'produtos', attributes: ['id', 'peso_kg'] }]
              });

              if (!pedido) {
                try {
                  pedido = await pedidosService.createPedidoComItensENota(
                    {
                      codigo_pedido: pedidoIdentifier,
                      status: 'PENDENTE',
                      cliente_id: dados.cliente_id || 1,
                      usuario_id: dados.operador_id || process.env.SYSTEM_USER_ID
                    },
                    { transaction }
                  );
                  console.debug(`[Conferencia][${transactionId}] Pedido criado automaticamente: ${pedido.id} (${pedidoIdentifier})`);
                } catch (err) {
                  throw new Error(`Erro ao criar pedido ${pedidoIdentifier}: ${err.message}`);
                }
              }
            } else if (typeof pedidoIdentifier === 'object') {
              if (pedidoIdentifier.id) {
                pedido = await db.Pedidos.findByPk(pedidoIdentifier.id, {
                  transaction,
                  include: [{ model: db.Produtos, as: 'produtos', attributes: ['id', 'peso_kg'] }]
                });
              } else if (pedidoIdentifier.codigo_pedido) {
                pedido = await db.Pedidos.findOne({
                  where: { codigo_pedido: pedidoIdentifier.codigo_pedido },
                  transaction,
                  include: [{ model: db.Produtos, as: 'produtos', attributes: ['id', 'peso_kg'] }]
                });

                if (!pedido) {
                  try {
                    pedido = await pedidosService.createPedidoComItensENota(
                      {
                        ...pedidoIdentifier,
                        usuario_id: dados.operador_id || process.env.SYSTEM_USER_ID
                      },
                      { transaction }
                    );
                    console.debug(`[Conferencia][${transactionId}] Pedido criado automaticamente: ${pedido.id} (${pedidoIdentifier.codigo_pedido})`);
                  } catch (err) {
                    throw new Error(`Erro ao criar pedido ${pedidoIdentifier.codigo_pedido}: ${err.message}`);
                  }
                }
              } else {
                throw new Error(`Objeto de pedido inválido: ${JSON.stringify(pedidoIdentifier)}`);
              }
            } else {
              throw new Error(`Identificador de pedido inválido: ${pedidoIdentifier}`);
            }

            if (!pedido) {
              throw new Error(`Pedido ${pedidoIdentifier} não encontrado e não pôde ser criado`);
            }

            // 2. Validação de conflito
            if (pedido.conferencia_id && pedido.conferencia_id !== conferencia.id) {
              throw new Error(`Pedido ${pedido.id} (${pedido.codigo_pedido}) já está associado à conferência ${pedido.conferencia_id}`);
            }

            // 3. Atualiza associações
            pedido.conferencia_id = conferencia.id;
            if (transferencia) pedido.transferencia_id = transferencia.id;
            if (manifesto) pedido.manifesto_id = manifesto.id;

            // 4. Status e rastreamento conforme tipo
            if (dados.tipo === 'INBOUND') {
              pedido.status = 'AGUARDANDO_CONFERENCIA';
              await db.Rastreamentos.create(
                {
                  pedido_id: pedido.id,
                  status_atual: this._mapPedidoStatusToRastreamentoStatus('AGUARDANDO_CONFERENCIA'),
                  data_status: new Date(),
                  localizacao: dados.localizacao_inbound || 'Portaria / Recebimento'
                },
                { transaction }
              );
            } else if (dados.tipo === 'OUTBOUND') {
              pedido.status = 'AGUARDANDO_SEPARACAO';
              const separacaoExistente = await db.Separacao.findOne({
                where: { pedido_id: pedido.id },
                transaction
              });
              if (!separacaoExistente) {
                await db.Separacao.create(
                  {
                    pedido_id: pedido.id,
                    conferencia_id: conferencia.id,
                    corredor_gaiola: null,
                    status: 'PENDENTE',
                    data_separacao: null
                  },
                  { transaction }
                );
              }

              await db.Rastreamentos.create(
                {
                  pedido_id: pedido.id,
                  status_atual: this._mapPedidoStatusToRastreamentoStatus('AGUARDANDO_SEPARACAO'),
                  data_status: new Date(),
                  localizacao: dados.localizacao_outbound || 'Área de picking'
                },
                { transaction }
              );
            }

            await pedido.save({ transaction });
            pedidosProcessados.push(pedido);

            totalQuantidade += 1;
            const pesoPedido = Number(pedido.produtos?.peso_kg || 0);
            totalPeso += pesoPedido;
          } catch (error) {
            console.error(`[Conferencia][${transactionId}] Erro ao processar pedido:`, error.message);
            throw error;
          }
        }
      }

      // --- Associa pedidos ao manifesto ---
      if (manifesto && pedidosProcessados.length > 0) {
        const pedidosIds = pedidosProcessados.map(p => p.id);
        await manifestosService.associarPedidosAoManifesto(manifesto.id, pedidosIds, { transaction });
      }

      // --- Atualiza transferência com quantidades ---
      if (transferencia) {
        transferencia.quantidade = totalQuantidade || transferencia.quantidade || 0;
        transferencia.peso_kg = totalPeso || transferencia.peso_kg || 0;
        transferencia.conferencia_id = conferencia.id;
        await transferencia.save({ transaction });

        if (transporte && transporte.transferencia_id !== transferencia.id) {
          transporte.transferencia_id = transferencia.id;
          await transporte.save({ transaction });
        }
      }

      // --- Atualiza totais da conferência ---
      const totalPedidosConferencia = await db.Pedidos.count({
        where: { conferencia_id: conferencia.id },
        transaction
      });

      await conferencia.update(
        {
          total_pedidos_iniciais: totalPedidosConferencia,
          total_pedidos_finais: totalPedidosConferencia
        },
        { transaction }
      );

      // --- Commit da transação ---
      await this._checkTransaction(transaction, 'Commit final');
      await transaction.commit();
      console.debug(`[Conferencia][${transactionId}] Transação commitada com sucesso`);

      // --- Retorna conferência completa (CORRIGIDO: alias de Motoristas) ---
      return await db.Conferencias.findByPk(conferencia.id, {
        include: [
          {
            model: db.Pedidos,
            as: 'pedidos',
            include: [
              { model: db.Produtos, as: 'produtos' },
              { model: db.Clientes, as: 'clientes' }
            ]
          },
          {
            model: db.Transportes,
            include: [
              { model: db.Motoristas },
              { model: db.Hubs, as: 'hubOrigem' },
              { model: db.Hubs, as: 'hubDestino' }
            ]
          },
          {
            model: db.Manifestos,
            as: 'manifesto',
            include: [
              {
                model: db.NotasFiscais,
                as: 'nota',
                include: [{ model: db.NotasItens, as: 'notaItens' }]
              }
            ]
          },
          {
            model: db.Transferencias,
            as: 'transferencias',
            where: { conferencia_id: conferencia.id },
            required: false,
            include: [
              {
                model: db.Pedidos,
                as: 'pedidos',
                include: [
                  { model: db.Produtos, as: 'produtos' },
                  { model: db.Clientes, as: 'clientes' }
                ]
              },
              { model: db.Hubs, as: 'origemHub' },
              { model: db.Hubs, as: 'destinoHub' },
              { model: db.Motoristas, as: 'Motorista' }
            ]
          }
        ],
        order: [[{ model: db.Pedidos, as: 'pedidos' }, 'id', 'ASC']]
      });
    } catch (error) {
      console.error(`[Conferencia][${transactionId}] ERRO GERAL:`, error.message);
      console.error(error.stack);
      if (transaction && !transaction.finished) {
        try {
          await transaction.rollback();
          console.debug(`[Conferencia][${transactionId}] Rollback executado`);
        } catch (rbErr) {
          console.error(`[Conferencia][${transactionId}] Erro no rollback:`, rbErr.message);
        }
      }
      throw new Error(`Erro ao criar conferência com pedidos e manifesto: ${error.message}`);
    }
  }

  // Alias para compatibilidade
  async createComPedidos(dados) {
    return this.createComPedidosEmanifesto(dados);
  }

  // ------------------------------------------------------------------------
  //  VALIDAÇÃO DE PEDIDO
  //  (usa status VALIDADO)
  // ------------------------------------------------------------------------

  async validarPedido(conferenciaId, pedidoId) {
    const transaction = await db.sequelize.transaction();
    const transactionId = transaction.id || `tx-${Date.now()}`;

    try {
      console.debug(`[Conferencia][${transactionId}] Validando pedido ${pedidoId} na conferência ${conferenciaId}`);

      await this._checkTransaction(transaction, 'Validação de pedido');

      const conferencia = await db.Conferencias.findByPk(conferenciaId, { transaction });
      if (!conferencia) throw new Error('Conferência não encontrada');

      const pedido = await db.Pedidos.findByPk(pedidoId, { transaction });
      if (!pedido) throw new Error('Pedido não encontrado');

      if (pedido.conferencia_id !== parseInt(conferenciaId)) {
        throw new Error('Pedido não pertence a esta conferência');
      }

      if (['VALIDADO', 'ENTREGUE'].includes(pedido.status)) {
        throw new Error('Pedido já foi validado/entregue');
      }

      pedido.status = 'VALIDADO';
      await pedido.save({ transaction });

      const separacao = await db.Separacao.findOne({ where: { pedido_id: pedido.id }, transaction });
      if (separacao) {
        await separacao.update({ status: 'SEPARADO', data_separacao: new Date() }, { transaction });
      } else {
        await db.Separacao.create(
          {
            pedido_id: pedido.id,
            conferencia_id: conferencia.id,
            status: 'SEPARADO',
            data_separacao: new Date()
          },
          { transaction }
        );
      }

      // Cria rastreamento com status mapeado (VALIDADO → NO_HUB)
      await db.Rastreamentos.create(
        {
          pedido_id: pedido.id,
          status_atual: this._mapPedidoStatusToRastreamentoStatus('VALIDADO'),
          data_status: new Date(),
          localizacao: `Área de expedição - Conferência ${conferencia.id}`
        },
        { transaction }
      );

      await this.atualizarEstatisticasConferencia(conferenciaId, transaction);

      await this._checkTransaction(transaction, 'Commit validação pedido');
      await transaction.commit();

      console.debug(`[Conferencia][${transactionId}] Pedido ${pedidoId} validado com sucesso`);
      return { success: true, pedido };
    } catch (error) {
      console.error(`[Conferencia][${transactionId}] Erro ao validar pedido:`, error.message);
      if (transaction && !transaction.finished) {
        try {
          await transaction.rollback();
        } catch (rbErr) {
          console.error(`[Conferencia][${transactionId}] Erro no rollback:`, rbErr.message);
        }
      }
      throw error;
    }
  }

  async invalidarPedido(conferenciaId, pedidoId) {
    const transaction = await db.sequelize.transaction();
    const transactionId = transaction.id || `tx-${Date.now()}`;

    try {
      console.debug(`[Conferencia][${transactionId}] Invalidando pedido ${pedidoId} na conferência ${conferenciaId}`);

      await this._checkTransaction(transaction, 'Invalidação de pedido');

      const conferencia = await db.Conferencias.findByPk(conferenciaId);
      if (!conferencia) throw new Error('Conferência não encontrada');

      const pedido = await db.Pedidos.findByPk(pedidoId);
      if (!pedido) throw new Error('Pedido não encontrado');

      if (pedido.conferencia_id !== parseInt(conferenciaId)) {
        throw new Error('Pedido não pertence a esta conferência');
      }

      pedido.status = 'CANCELADO';
      await pedido.save({ transaction });

      // Opcional: criar rastreamento para cancelamento
      await db.Rastreamentos.create(
        {
          pedido_id: pedido.id,
          status_atual: this._mapPedidoStatusToRastreamentoStatus('CANCELADO'),
          data_status: new Date(),
          localizacao: `Conferência ${conferencia.id} - Cancelado`
        },
        { transaction }
      );

      await this.atualizarEstatisticasConferencia(conferenciaId, transaction);

      await this._checkTransaction(transaction, 'Commit invalidação pedido');
      await transaction.commit();

      console.debug(`[Conferencia][${transactionId}] Pedido ${pedidoId} invalidado (cancelado)`);
      return { success: true, pedido };
    } catch (error) {
      console.error(`[Conferencia][${transactionId}] Erro ao invalidar pedido:`, error.message);
      if (transaction && !transaction.finished) {
        try {
          await transaction.rollback();
        } catch (rbErr) {
          console.error(`[Conferencia][${transactionId}] Erro no rollback:`, rbErr.message);
        }
      }
      throw error;
    }
  }

  async atualizarEstatisticasConferencia(conferenciaId, transaction = null) {
    const transactionLocal = transaction || (await db.sequelize.transaction());
    const createdHere = !transaction;
    const transactionId = transactionLocal.id || `tx-${Date.now()}`;

    try {
      // Verifica a transação sempre, mesmo se foi passada externamente
      await this._checkTransaction(transactionLocal, 'Atualização estatísticas');

      const pedidosValidados = await db.Pedidos.count({
        where: {
          conferencia_id: conferenciaId,
          status: { [Op.in]: ['VALIDADO'] }
        },
        transaction: transactionLocal
      });

      const totalPedidos = await db.Pedidos.count({
        where: { conferencia_id: conferenciaId },
        transaction: transactionLocal
      });

      let percentual = totalPedidos > 0 ? (pedidosValidados / totalPedidos) * 100 : 0;
      percentual = Math.round(percentual * 100) / 100; // arredonda para 2 casas decimais

      await db.Conferencias.update(
        {
          pedidos_escaneados: pedidosValidados,
          percentual_validacao: percentual
        },
        {
          where: { id: conferenciaId },
          transaction: transactionLocal
        }
      );

      if (createdHere) {
        await this._checkTransaction(transactionLocal, 'Commit estatísticas');
        await transactionLocal.commit();
      }

      return { pedidosValidados, totalPedidos };
    } catch (error) {
      console.error(`[Conferencia][${transactionId}] Erro ao atualizar estatísticas:`, error.message);
      if (createdHere && transactionLocal && !transactionLocal.finished) {
        try {
          await transactionLocal.rollback();
        } catch (rbErr) {
          console.error(`[Conferencia][${transactionId}] Erro no rollback:`, rbErr.message);
        }
      }
      throw new Error(`Erro ao atualizar estatísticas: ${error.message}`);
    }
  }

  async associarPedido(conferenciaId, pedidoId) {
    const transaction = await db.sequelize.transaction();
    const transactionId = transaction.id || `tx-${Date.now()}`;

    try {
      console.debug(`[Conferencia][${transactionId}] Associando pedido ${pedidoId} à conferência ${conferenciaId}`);

      await this._checkTransaction(transaction, 'Associar pedido');

      const conferencia = await db.Conferencias.findByPk(conferenciaId);
      if (!conferencia) throw new Error('Conferência não encontrada');

      const pedido = await db.Pedidos.findByPk(pedidoId);
      if (!pedido) throw new Error('Pedido não encontrado');

      if (pedido.conferencia_id && pedido.conferencia_id !== parseInt(conferenciaId)) {
        throw new Error('Pedido já está associado a outra conferência');
      }

      pedido.conferencia_id = conferenciaId;
      await pedido.save({ transaction });

      const totalPedidos = await db.Pedidos.count({
        where: { conferencia_id: conferenciaId },
        transaction
      });

      await db.Conferencias.update(
        {
          total_pedidos_iniciais: totalPedidos,
          total_pedidos_finais: totalPedidos
        },
        {
          where: { id: conferenciaId },
          transaction
        }
      );

      await this._checkTransaction(transaction, 'Commit associar pedido');
      await transaction.commit();

      console.debug(`[Conferencia][${transactionId}] Pedido ${pedidoId} associado com sucesso`);
      return { success: true, pedido };
    } catch (error) {
      console.error(`[Conferencia][${transactionId}] Erro ao associar pedido:`, error.message);
      if (transaction && !transaction.finished) {
        try {
          await transaction.rollback();
        } catch (rbErr) {
          console.error(`[Conferencia][${transactionId}] Erro no rollback:`, rbErr.message);
        }
      }
      throw error;
    }
  }

  // ------------------------------------------------------------------------
  //  CONCLUSÃO DE CONFERÊNCIA
  // ------------------------------------------------------------------------

  async concluirConferencia(id, dados = {}) {
    const transaction = await db.sequelize.transaction();
    const transactionId = transaction.id || `tx-${Date.now()}`;

    try {
      console.debug(`[Conferencia][${transactionId}] Concluindo conferência ${id}`);

      await this._checkTransaction(transaction, 'Início conclusão conferência');

      const conferencia = await db.Conferencias.findByPk(id, {
        include: [
          {
            model: db.Transportes,
            include: [
              { model: db.Motoristas },
              { model: db.Hubs, as: 'hubOrigem' },
              { model: db.Hubs, as: 'hubDestino' }
            ]
          },
          {
            model: db.Manifestos,
            as: 'manifesto',
            include: [{ model: db.NotasFiscais, as: 'nota' }]
          },
          { model: db.Usuarios, as: 'operador' },
          {
            model: db.Pedidos,
            as: 'pedidos',
            include: [
              { model: db.PedidoItens, as: 'itens', include: [{ model: db.Produtos, as: 'produtos' }] },
              { model: db.Produtos, as: 'produtos' },
              { model: db.Clientes, as: 'clientes' }
            ]
          }
        ],
        transaction
      });

      if (!conferencia) throw new Error('Conferência não encontrada');
      if (conferencia.status === 'CONCLUIDO') throw new Error('Conferência já concluída');

      if (!conferencia.pedidos || conferencia.pedidos.length === 0) {
        throw new Error('Conferência não possui pedidos para processar');
      }

      conferencia.status = 'CONCLUIDO';
      conferencia.data_termino = new Date();
      await conferencia.save({ transaction });

      // Divergência
      const pedidosEscaneados = conferencia.pedidos.filter(p => p.status === 'VALIDADO').length;

      if (conferencia.total_pedidos_finais !== pedidosEscaneados) {
        const impactoFinanceiro = this.calcularImpactoDivergencia(
          conferencia.total_pedidos_finais,
          pedidosEscaneados
        );
        const numeroOcorrencia = 'EXC-' + Date.now();

        await db.Excecao.create(
          {
            numero_ocorrencia: numeroOcorrencia,
            tipo: 'DIVERGENCIA',
            gravidade: 'ALTA',
            titulo: `Divergência na conferência - ${conferencia.id}`,
            descricao: `Total esperado: ${conferencia.total_pedidos_finais}, escaneados: ${pedidosEscaneados}`,
            conferencia_id: conferencia.id,
            transporte_id: conferencia.transporte?.id,
            criador_id: conferencia.operador?.id,
            data_ocorrencia: new Date(),
            impacto_financeiro: impactoFinanceiro,
            status: 'ABERTA'
          },
          { transaction }
        );
      }

      if (conferencia.tipo === 'INBOUND') {
        await this.processarConferenciaInbound(conferencia, transaction);
      } else if (conferencia.tipo === 'OUTBOUND') {
        await this.processarConferenciaOutbound(conferencia, transaction);
      }

      await this._checkTransaction(transaction, 'Commit conclusão conferência');
      await transaction.commit();

      console.debug(`[Conferencia][${transactionId}] Conferência ${id} concluída com sucesso`);

      return await db.Conferencias.findByPk(id, {
        include: [
          {
            model: db.Transportes,
            include: [{ model: db.Rotas, as: 'rotas' }]
          },
          { model: db.Manifestos, as: 'manifesto' },
          { model: db.Pedidos, as: 'pedidos' }
        ]
      });
    } catch (error) {
      console.error(`[Conferencia][${transactionId}] Erro ao concluir conferência:`, error.message);
      if (transaction && !transaction.finished) {
        try {
          await transaction.rollback();
        } catch (rbErr) {
          console.error(`[Conferencia][${transactionId}] Erro no rollback:`, rbErr.message);
        }
      }
      throw new Error(`Erro ao concluir conferência: ${error.message}`);
    }
  }

  async updateConferencia(id, dados) {
    const transaction = await db.sequelize.transaction();
    const transactionId = transaction.id || `tx-${Date.now()}`;

    try {
      console.debug(`[Conferencia][${transactionId}] Atualizando conferência ${id}`);

      await this._checkTransaction(transaction, 'Atualização conferência');

      const conferencia = await db.Conferencias.findByPk(id);
      if (!conferencia) throw new Error('Conferência não encontrada');

      const camposPermitidos = ['nome_estacao', 'status', 'observacoes', 'manifesto_id'];
      const dadosAtualizacao = {};

      camposPermitidos.forEach(campo => {
        if (dados[campo] !== undefined) dadosAtualizacao[campo] = dados[campo];
      });

      await db.Conferencias.update(dadosAtualizacao, {
        where: { id },
        transaction
      });

      await this._checkTransaction(transaction, 'Commit atualização');
      await transaction.commit();

      console.debug(`[Conferencia][${transactionId}] Conferência ${id} atualizada`);
      return await this.getConferenciaCompleta(id);
    } catch (error) {
      console.error(`[Conferencia][${transactionId}] Erro ao atualizar conferência:`, error.message);
      if (transaction && !transaction.finished) {
        try {
          await transaction.rollback();
        } catch (rbErr) {
          console.error(`[Conferencia][${transactionId}] Erro no rollback:`, rbErr.message);
        }
      }
      throw new Error(`Erro ao atualizar conferência: ${error.message}`);
    }
  }

  async removerPedido(conferenciaId, pedidoId) {
    const transaction = await db.sequelize.transaction();
    const transactionId = transaction.id || `tx-${Date.now()}`;

    try {
      console.debug(`[Conferencia][${transactionId}] Removendo pedido ${pedidoId} da conferência ${conferenciaId}`);

      await this._checkTransaction(transaction, 'Remoção de pedido');

      const conferencia = await db.Conferencias.findByPk(conferenciaId);
      if (!conferencia) throw new Error('Conferência não encontrada');

      const pedido = await db.Pedidos.findByPk(pedidoId);
      if (!pedido) throw new Error('Pedido não encontrado');

      if (pedido.conferencia_id !== parseInt(conferenciaId)) {
        throw new Error('Pedido não pertence a esta conferência');
      }

      pedido.conferencia_id = null;
      pedido.status = 'PENDENTE';
      await pedido.save({ transaction });

      await this.atualizarEstatisticasConferencia(conferenciaId, transaction);

      await this._checkTransaction(transaction, 'Commit remoção pedido');
      await transaction.commit();

      console.debug(`[Conferencia][${transactionId}] Pedido ${pedidoId} removido da conferência`);
      return { success: true, pedido };
    } catch (error) {
      console.error(`[Conferencia][${transactionId}] Erro ao remover pedido:`, error.message);
      if (transaction && !transaction.finished) {
        try {
          await transaction.rollback();
        } catch (rbErr) {
          console.error(`[Conferencia][${transactionId}] Erro no rollback:`, rbErr.message);
        }
      }
      throw error;
    }
  }

  async getEstatisticas(conferenciaId) {
    try {
      const conferencia = await db.Conferencias.findByPk(conferenciaId, {
        include: [{ model: db.Pedidos, as: 'pedidos', attributes: ['id', 'status'] }]
      });

      if (!conferencia) throw new Error('Conferência não encontrada');

      const estatisticas = {
        totalPedidos: conferencia.pedidos.length,
        pedidosValidados: conferencia.pedidos.filter(p => p.status === 'VALIDADO').length,
        pedidosPendentes: conferencia.pedidos.filter(p => p.status === 'AGUARDANDO_CONFERENCIA').length,
        pedidosCancelados: conferencia.pedidos.filter(p => p.status === 'CANCELADO').length,
        percentualConclusao: conferencia.percentual_validacao || 0
      };

      return estatisticas;
    } catch (error) {
      throw new Error(`Erro ao obter estatísticas: ${error.message}`);
    }
  }

  // ------------------------------------------------------------------------
  //  PROCESSAMENTOS ESPECÍFICOS (INBOUND / OUTBOUND)
  // ------------------------------------------------------------------------

  async calcularDistancia(hubOrigem, hubDestino) {
    if (!hubOrigem || !hubDestino) return 0;
    const distancia = Math.random() * 100 + 50;
    return parseFloat(distancia.toFixed(2));
  }

  /**
   * Processa conferência INBOUND – entrada de estoque.
   * CORREÇÃO: agora utiliza o serviço de estoque para entrada, com validações robustas.
   */
  async processarConferenciaInbound(conferencia, transaction) {
    try {
      console.debug(`[Conferencia] Processamento INBOUND da conferência ${conferencia.id}`);

      // Verifica se há transporte e hub de destino
      if (!conferencia.transporte) {
        throw new Error('Transporte não associado à conferência INBOUND');
      }
      if (!conferencia.transporte.hub_destino_id) {
        throw new Error('Transporte da conferência INBOUND não possui hub de destino definido');
      }

      for (const pedido of conferencia.pedidos) {
        if (pedido.status === 'VALIDADO') {
          pedido.status = 'EM_ESTOQUE';
          await pedido.save({ transaction });

          if (pedido.itens && pedido.itens.length > 0) {
            for (const item of pedido.itens) {
              // Validações adicionais
              if (!item.produto_id) {
                throw new Error(`Item do pedido ${pedido.id} não possui produto_id`);
              }
              if (!item.quantidade || item.quantidade <= 0) {
                throw new Error(`Item do pedido ${pedido.id} possui quantidade inválida: ${item.quantidade}`);
              }

              console.debug(`[Conferencia] Processando entrada de estoque: produto ${item.produto_id}, hub ${conferencia.transporte.hub_destino_id}, quantidade ${item.quantidade}`);

              // Utiliza o serviço de estoque para realizar a entrada
              await estoqueService.entradaEstoque(
                {
                  produto_id: item.produto_id,
                  hub_id: conferencia.transporte.hub_destino_id,
                  quantidade: item.quantidade,
                  usuario_id: conferencia.operador_id,
                  localizacao: 'Área de Recebimento',
                  referencia: `Conferência ${conferencia.id} - Pedido ${pedido.codigo_pedido || pedido.id}`
                },
                { transaction }
              );
            }
          } else {
            console.warn(`[Conferencia] Pedido ${pedido.id} não possui itens para entrada em estoque.`);
          }

          await db.Rastreamentos.create(
            {
              pedido_id: pedido.id,
              status_atual: this._mapPedidoStatusToRastreamentoStatus('EM_ESTOQUE'),
              data_status: new Date(),
              localizacao: 'Estoque - ' + (conferencia.transporte?.hubDestino?.nome || 'Hub Principal')
            },
            { transaction }
          );
        }
      }

      const pedidosValidados = conferencia.pedidos.filter(p => p.status === 'VALIDADO').length;
      let percentual = conferencia.total_pedidos_finais > 0
        ? (pedidosValidados / conferencia.total_pedidos_finais) * 100
        : 0;
      percentual = Math.round(percentual * 100) / 100;

      await conferencia.update(
        {
          pedidos_escaneados: pedidosValidados,
          percentual_validacao: percentual
        },
        { transaction }
      );
    } catch (error) {
      throw new Error(`Erro no processamento INBOUND: ${error.message}`);
    }
  }

  async processarConferenciaOutbound(conferencia, transaction) {
    try {
      console.debug(`[Conferencia] Processamento OUTBOUND da conferência ${conferencia.id}`);
      const { transporte, operador } = conferencia;

      if (!transporte) {
        throw new Error('Transporte não encontrado para a conferência OUTBOUND');
      }

      if (!transporte.motorista) {
        await this.criarExcecao({
          tipo: 'NOSHOW',
          gravidade: 'ALTA',
          titulo: `Transporte sem motorista - ${transporte.numero_transporte}`,
          descricao: `Transporte pronto para expedição mas sem motorista atribuído`,
          transporte_id: transporte.id,
          criador_id: operador.id,
          data_ocorrencia: new Date(),
          impacto_financeiro: this.calcularImpactoAtrasoTransporte(),
          models: db,
          transaction
        });
        return;
      }

      let rota;
      if (transporte.rota_id) {
        rota = await db.Rotas.findByPk(transporte.rota_id, { transaction });
      } else {
        rota = await db.Rotas.create(
          {
            id_motorista: transporte.motorista_id,
            cluster: 'OUTBOUND',
            status_rota: 'CRIADA',
            data_criacao: new Date()
          },
          { transaction }
        );

        transporte.rota_id = rota.id;
        await transporte.save({ transaction });
      }

      let ordem = 1;
      for (const pedido of conferencia.pedidos) {
        if (pedido.status === 'VALIDADO') {
          await pedido.save({ transaction });

          await db.Rastreamentos.create(
            {
              pedido_id: pedido.id,
              status_atual: this._mapPedidoStatusToRastreamentoStatus('EM_ROTA'),
              data_status: new Date(),
              localizacao: 'Em transporte'
            },
            { transaction }
          );

          await db.Paradas.create(
            {
              id_rota: rota.id,
              pedido_id: pedido.id,
              ordem_entrega: ordem++,
              status_parada: 'PENDENTE'
            },
            { transaction }
          );
        }
      }

      await rota.update(
        {
          numero_paradas: ordem - 1,
          status_rota: 'EM_ANDAMENTO'
        },
        { transaction }
      );

      transporte.status_transporte = 'EM_TRANSPORTE';
      await transporte.save({ transaction });
    } catch (error) {
      throw new Error(`Erro no processamento OUTBOUND: ${error.message}`);
    }
  }

  // ------------------------------------------------------------------------
  //  UTILITÁRIOS DE EXCEÇÃO E CÁLCULO
  // ------------------------------------------------------------------------

  async verificarAvariaPedido(idPedido, transaction) {
    return Math.random() < 0.05;
  }

  async calcularValorPedido(idPedido, transaction) {
    return 150;
  }

  calcularImpactoAtrasoTransporte() {
    return 500;
  }

  calcularImpactoDivergencia(totalEsperado, totalConferido) {
    const diferenca = Math.abs(totalEsperado - totalConferido);
    const custoPorDivergencia = 100;
    return diferenca * custoPorDivergencia;
  }

  async criarExcecao({
    tipo,
    gravidade,
    titulo,
    descricao,
    pedido_id,
    transporte_id,
    recebimento_id,
    criador_id,
    data_ocorrencia,
    impacto_financeiro = 0,
    models,
    transaction
  }) {
    try {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      const numeroOcorrencia = `EXC${timestamp}${random}`;

      const excecao = await models.Excecao.create(
        {
          numero_ocorrencia: numeroOcorrencia,
          tipo,
          gravidade,
          titulo,
          descricao,
          pedido_id: pedido_id,
          transporte_id,
          recebimento_id,
          criador_id,
          data_ocorrencia: data_ocorrencia || new Date(),
          impacto_financeiro,
          status: 'ABERTA'
        },
        { transaction }
      );

      const historico = [
        {
          timestamp: new Date(),
          acao: 'CRIACAO',
          descricao: 'Exceção criada automaticamente pelo sistema',
          usuario_id: criador_id
        }
      ];

      await excecao.update({ historico }, { transaction });

      return excecao;
    } catch (error) {
      console.error('Erro ao criar exceção:', error);
      throw error;
    }
  }

  // ------------------------------------------------------------------------
  //  ASSOCIAÇÃO DE MANIFESTO
  // ------------------------------------------------------------------------

  async associarManifesto(conferenciaId, manifestoId) {
    const transaction = await db.sequelize.transaction();
    const transactionId = transaction.id || `tx-${Date.now()}`;

    try {
      console.debug(`[Conferencia][${transactionId}] Associando manifesto ${manifestoId} à conferência ${conferenciaId}`);

      await this._checkTransaction(transaction, 'Associar manifesto');

      const conferencia = await db.Conferencias.findByPk(conferenciaId, { transaction });
      if (!conferencia) throw new Error('Conferência não encontrada');

      const manifesto = await db.Manifestos.findByPk(manifestoId, { transaction });
      if (!manifesto) throw new Error('Manifesto não encontrado');

      conferencia.manifesto_id = manifestoId;
      await conferencia.save({ transaction });

      await this._checkTransaction(transaction, 'Commit associar manifesto');
      await transaction.commit();

      console.debug(`[Conferencia][${transactionId}] Manifesto associado com sucesso`);
      return { success: true, conferencia, manifesto };
    } catch (error) {
      console.error(`[Conferencia][${transactionId}] Erro ao associar manifesto:`, error.message);
      if (transaction && !transaction.finished) {
        try {
          await transaction.rollback();
        } catch (rbErr) {
          console.error(`[Conferencia][${transactionId}] Erro no rollback:`, rbErr.message);
        }
      }
      throw error;
    }
  }

  async criarManifestoParaConferencia(conferenciaId) {
    const transaction = await db.sequelize.transaction();
    const transactionId = transaction.id || `tx-${Date.now()}`;

    try {
      console.debug(`[Conferencia][${transactionId}] Criando manifesto para conferência ${conferenciaId}`);

      await this._checkTransaction(transaction, 'Criar manifesto para conferência');

      const conferencia = await db.Conferencias.findByPk(conferenciaId, {
        include: [
          { model: db.Pedidos, as: 'pedidos' },
          { model: db.Transportes }
        ],
        transaction
      });

      if (!conferencia) throw new Error('Conferência não encontrada');
      if (conferencia.manifesto_id) throw new Error('Conferência já possui manifesto associado');
      if (!conferencia.pedidos || conferencia.pedidos.length === 0) {
        throw new Error('Conferência não possui pedidos para criar manifesto');
      }

      const pedidosIds = conferencia.pedidos.map(p => p.id);

      const manifesto = await manifestosService.createManifestoFromPedidos(
        {
          pedidosIds: pedidosIds,
          numero_manifesto: `MAN-CONF-${conferenciaId}-${Date.now()}`,
          serie: '1',
          data_emissao: new Date(),
          origem_hub_id: conferencia.transporte?.hub_origem_id,
          destino_hub_id: conferencia.transporte?.hub_destino_id,
          transporte_id: conferencia.transporte_id,
          observacoes: `Manifesto gerado automaticamente para conferência ${conferenciaId}`
        },
        { transaction }
      );

      conferencia.manifesto_id = manifesto.id;
      await conferencia.save({ transaction });

      await this._checkTransaction(transaction, 'Commit criar manifesto');
      await transaction.commit();

      console.debug(`[Conferencia][${transactionId}] Manifesto criado e associado: ${manifesto.id}`);
      return { success: true, conferencia, manifesto };
    } catch (error) {
      console.error(`[Conferencia][${transactionId}] Erro ao criar manifesto:`, error.message);
      if (transaction && !transaction.finished) {
        try {
          await transaction.rollback();
        } catch (rbErr) {
          console.error(`[Conferencia][${transactionId}] Erro no rollback:`, rbErr.message);
        }
      }
      throw error;
    }
  }
}

module.exports = ConferenciaServices;