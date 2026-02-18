const Services = require('./Services');
const db = require('../models');
const { Op } = require('sequelize');

class HubsServices extends Services {
  constructor() {
    super('Hubs');
  }

  /**
   * Busca hubs por nome (correspondência parcial, case-insensitive)
   * @param {string} nome - Nome do hub (ou parte)
   * @param {object} options - Opções incluindo transaction
   * @returns {Promise<Array>} Lista de hubs encontrados
   */
  async searchHubsByName(nome, options = {}) {
    const { transaction } = options;
    
    try {
      console.log(`[HubsServices] Buscando hubs por nome: "${nome}"`);
      
      if (!nome || typeof nome !== 'string') {
        console.log('[HubsServices] Nome inválido ou vazio');
        return [];
      }

      const hubs = await db.Hubs.findAll({
        where: {
          nome: {
            [Op.like]: `%${nome}%`
          }
        },
        attributes: ['id', 'nome', 'codigo_hub', 'status'],
        include: [
          {
            model: db.Enderecos,
            as: 'enderecos',
            attributes: ['cidade', 'estado']
          }
        ],
        transaction,
        order: [['nome', 'ASC']]
      });

      console.log(`[HubsServices] Encontrados ${hubs.length} hubs para "${nome}"`);
      return hubs;
    } catch (error) {
      console.error(`[HubsServices] Erro ao buscar hubs por nome: ${error.message}`);
      throw new Error(`Erro ao buscar hubs por nome: ${error.message}`);
    }
  }

  /**
   * Busca um hub por identificador (ID ou nome) - se for nome, pode retornar múltiplos hubs
   * @param {string|number} identifier - ID ou nome do hub
   * @param {object} options - Opções incluindo transaction
   * @returns {Promise<object|Array|null>} Hub(s) encontrado(s) ou null
   */
  async findHub(identifier, options = {}) {
    const { transaction } = options;
    
    try {
      console.log(`[HubsServices] Buscando hub por identificador: "${identifier}"`);
      
      const id = Number(identifier);
      
      // Busca por ID
      if (!isNaN(id)) {
        console.log(`[HubsServices] Buscando hub por ID: ${id}`);
        return await db.Hubs.findByPk(id, {
          include: [
            {
              model: db.Enderecos,
              as: 'enderecos',
              attributes: ['id', 'rua', 'numero', 'bairro', 'cidade', 'estado', 'cep']
            },
            {
              model: db.Transportes,
              as: 'transportesOrigem',
              attributes: ['id', 'numero_transporte', 'status_transporte', 'data_criacao'],
              include: [
                {
                  model: db.Motoristas,
                  attributes: ['id', 'nome']
                },
                {
                  model: db.Hubs,
                  as: 'hubDestino',
                  attributes: ['id', 'nome'],
                  include: [
                    {
                      model: db.Enderecos,
                      as: 'enderecos',
                      attributes: ['cidade', 'estado']
                    }
                  ]
                }
              ],
              order: [['data_criacao', 'DESC']],
              limit: 10
            },
            {
              model: db.Transportes,
              as: 'transportesDestino',
              attributes: ['id', 'numero_transporte', 'status_transporte', 'data_criacao'],
              include: [
                {
                  model: db.Motoristas,
                  attributes: ['id', 'nome']
                },
                {
                  model: db.Hubs,
                  as: 'hubOrigem',
                  attributes: ['id', 'nome'],
                  include: [
                    {
                      model: db.Enderecos,
                      as: 'enderecos',
                      attributes: ['cidade', 'estado']
                    }
                  ]
                }
              ],
              order: [['data_criacao', 'DESC']],
              limit: 10
            },
            {
              model: db.Estoques,
              attributes: ['id', 'quantidade', 'localizacao'],
              include: [
                {
                  model: db.Produtos,
                  attributes: ['id', 'nome']
                }
              ]
            }
          ],
          transaction
        });
      }

      // Busca por nome - retorna array de hubs
      console.log(`[HubsServices] Buscando hub por nome: "${identifier}"`);
      const hubs = await this.searchHubsByName(identifier, { transaction });
      
      // Se encontrou exatamente um hub, retorna com todos os relacionamentos
      if (hubs.length === 1) {
        console.log(`[HubsServices] Encontrado 1 hub, buscando detalhes ID: ${hubs[0].id}`);
        return await this.getHubById(hubs[0].id, { transaction });
      }
      
      // Se encontrou múltiplos ou nenhum, retorna a lista básica
      console.log(`[HubsServices] Retornando ${hubs.length} hubs`);
      return hubs;
      
    } catch (error) {
      console.error(`[HubsServices] Erro ao buscar hub: ${error.message}`);
      throw new Error(`Erro ao buscar hub: ${error.message}`);
    }
  }

  /**
   * Cria um novo hub automaticamente quando não encontrado
   * @param {string} nome - Nome do hub a ser criado
   * @param {object} options - Opções (não usamos transação aqui para evitar problemas)
   * @returns {Promise<object>} Hub criado ou encontrado
   */
  async createHubAuto(nome, options = {}) {
    try {
      console.log(`[HubsServices] Criando hub automaticamente: "${nome}"`);
      
      if (!nome || typeof nome !== 'string') {
        console.error('[HubsServices] Nome do hub é obrigatório');
        throw new Error('Nome do hub é obrigatório');
      }

      const nomeTratado = nome.trim();
      
      console.log(`[HubsServices] Buscando/criando hub: "${nomeTratado}"`);
      
      // Usar findOrCreate para evitar problemas de concorrência e transação
      const [hub, created] = await db.Hubs.findOrCreate({
        where: {
          nome: {
            [Op.iLike]: nomeTratado // case-insensitive no PostgreSQL
          }
        },
        defaults: {
          nome: nomeTratado,
          codigo_hub: `HUB-${Date.now()}`,
          status: 'ATIVO',
          endereco_id: null
        }
      });

      if (created) {
        console.log(`[HubsServices] Novo hub criado: ${hub.id} - ${hub.nome}`);
      } else {
        console.log(`[HubsServices] Hub já existe: ${hub.id} - ${hub.nome}`);
      }

      return hub;
    } catch (error) {
      console.error(`[HubsServices] Erro em createHubAuto:`, error);
      throw new Error(`Erro ao criar hub automaticamente: ${error.message}`);
    }
  }

  /**
   * Cria um novo hub (método completo)
   * @param {object} data - Dados do hub
   * @param {string} data.nome - Nome do hub
   * @param {string} data.codigo_hub - Código do hub
   * @param {number} data.endereco_id - ID do endereço (opcional)
   * @param {object} data.endereco - Dados do endereço (opcional)
   * @param {object} options - Opções incluindo transaction
   * @returns {Promise<object>} Hub criado
   */
  async createHub(data, options = {}) {
    console.log('[HubsServices] Iniciando createHub com dados:', JSON.stringify(data));
    
    const externalTx = options.transaction;
    const transaction = externalTx || await db.sequelize.transaction();
    const createdHere = !externalTx;

    try {
      const { nome, codigo_hub, endereco_id, endereco, ...outrosDados } = data;

      if (!nome) {
        console.error('[HubsServices] Nome do hub não fornecido');
        throw new Error('Nome do hub é obrigatório');
      }

      const nomeTratado = nome.trim();
      console.log(`[HubsServices] Processando hub: ${nomeTratado}`);

      // Verificar duplicidade por nome (case insensitive)
      const hubExistente = await db.Hubs.findOne({
        where: {
          nome: {
            [Op.like]: nomeTratado
          }
        },
        transaction
      });

      if (hubExistente) {
        console.log(`[HubsServices] Hub já existe: ${hubExistente.id} - ${hubExistente.nome}`);
        
        if (createdHere) {
          console.log('[HubsServices] Fazendo rollback da transação local');
          await transaction.rollback();
        }
        
        // Retorna o hub existente sem usar a transação (já fez rollback ou é externa)
        console.log(`[HubsServices] Retornando hub existente (ID: ${hubExistente.id})`);
        const hubCompleto = await db.Hubs.findByPk(hubExistente.id, {
          include: [
            {
              model: db.Enderecos,
              as: 'enderecos',
              attributes: ['id', 'rua', 'numero', 'bairro', 'cidade', 'estado', 'cep']
            }
          ]
        });
        
        console.log('[HubsServices] Hub existente recuperado:', hubCompleto ? 'Sim' : 'Não');
        return hubCompleto;
      }

      let enderecoIdFinal = endereco_id;
      console.log(`[HubsServices] endereco_id fornecido: ${endereco_id}`);

      // Criar endereço se fornecido
      if (endereco) {
        console.log('[HubsServices] Criando novo endereço...');
        const novoEndereco = await db.Enderecos.create(endereco, { transaction });
        enderecoIdFinal = novoEndereco.id;
        console.log(`[HubsServices] Endereço criado com ID: ${enderecoIdFinal}`);
      } else if (endereco_id) {
        // Verificar se o endereço existe
        console.log(`[HubsServices] Verificando endereço existente ID: ${endereco_id}`);
        const enderecoExistente = await db.Enderecos.findByPk(endereco_id, { transaction });
        if (!enderecoExistente) {
          console.error(`[HubsServices] Endereço não encontrado: ${endereco_id}`);
          throw new Error(`Endereço com ID ${endereco_id} não encontrado`);
        }
        console.log('[HubsServices] Endereço validado com sucesso');
      }

      // Se não forneceu endereço, o hub será criado com endereco_id = null
      console.log('[HubsServices] Criando hub no banco de dados...');
      const hub = await db.Hubs.create({
        nome: nomeTratado,
        codigo_hub: codigo_hub || `HUB-${Date.now()}`,
        endereco_id: enderecoIdFinal,
        status: 'ATIVO',
        ...outrosDados
      }, { transaction });

      console.log(`[HubsServices] Hub criado com ID: ${hub.id}`);

      if (createdHere) {
        console.log('[HubsServices] Fazendo commit da transação local');
        await transaction.commit();
        console.log('[HubsServices] Commit realizado com sucesso');
      }

      // Buscar o hub criado SEM usar a transação (já commitada ou externa)
      console.log(`[HubsServices] Buscando hub criado (ID: ${hub.id})...`);
      const hubCriado = await db.Hubs.findByPk(hub.id, {
        include: [
          {
            model: db.Enderecos,
            as: 'enderecos',
            attributes: ['id', 'rua', 'numero', 'bairro', 'cidade', 'estado', 'cep']
          }
        ]
      });
      
      console.log('[HubsServices] Hub recuperado:', hubCriado ? 'Sim' : 'Não');
      return hubCriado;

    } catch (error) {
      console.error('[HubsServices] ERRO no createHub:', error.message);
      console.error('[HubsServices] Stack trace:', error.stack);
      
      if (createdHere && transaction && !transaction.finished) {
        console.log('[HubsServices] Fazendo rollback devido ao erro');
        try {
          await transaction.rollback();
          console.log('[HubsServices] Rollback realizado');
        } catch (rollbackError) {
          console.error('[HubsServices] Erro no rollback:', rollbackError.message);
        }
      }
      throw new Error(`Erro ao criar hub: ${error.message}`);
    }
  }

  /**
   * Busca hub por ID com relacionamentos
   * @param {number} id - ID do hub
   * @param {object} options - Opções incluindo transaction
   * @returns {Promise<object>} Hub encontrado
   */
  async getHubById(id, options = {}) {
    const { transaction } = options;
    
    try {
      console.log(`[HubsServices] Buscando hub por ID: ${id}`);
      
      return await db.Hubs.findByPk(id, {
        include: [
          {
            model: db.Enderecos,
            as: 'enderecos',
            attributes: ['id', 'rua', 'numero', 'bairro', 'cidade', 'estado', 'cep']
          },
          {
            model: db.Transportes,
            as: 'transportesOrigem',
            attributes: ['id', 'numero_transporte', 'status_transporte', 'data_criacao'],
            include: [
              {
                model: db.Motoristas,
                attributes: ['id', 'nome']
              },
              {
                model: db.Hubs,
                as: 'hubDestino',
                attributes: ['id', 'nome'],
                include: [
                  {
                    model: db.Enderecos,
                    as: 'enderecos',
                    attributes: ['cidade', 'estado']
                  }
                ]
              }
            ],
            order: [['data_criacao', 'DESC']]
          },
          {
            model: db.Transportes,
            as: 'transportesDestino',
            attributes: ['id', 'numero_transporte', 'status_transporte', 'data_criacao'],
            include: [
              {
                model: db.Motoristas,
                attributes: ['id', 'nome']
              },
              {
                model: db.Hubs,
                as: 'hubOrigem',
                attributes: ['id', 'nome'],
                include: [
                  {
                    model: db.Enderecos,
                    as: 'enderecos',
                    attributes: ['cidade', 'estado']
                  }
                ]
              }
            ],
            order: [['data_criacao', 'DESC']]
          },
          {
            model: db.Estoques,
            attributes: ['id', 'quantidade', 'localizacao', 'data_entrada'],
            include: [
              {
                model: db.Produtos,
                attributes: ['id', 'nome']
              }
            ],
            order: [['data_entrada', 'DESC']]
          }
        ],
        transaction
      });
    } catch (error) {
      console.error(`[HubsServices] Erro ao buscar hub por ID: ${error.message}`);
      throw new Error(`Erro ao buscar hub por ID: ${error.message}`);
    }
  }

  /**
   * Busca todos os hubs com filtros e paginação
   * @param {object} options - Opções de busca
   * @returns {Promise<object>} Lista de hubs paginada
   */
  async getAllHubs(options = {}) {
    const {
      page = 1,
      limit = 100,
      sortBy = 'nome',
      sortOrder = 'ASC',
      filters = {}
    } = options;

    const offset = (page - 1) * limit;
    
    const whereConditions = {};

    if (filters.nome) {
      whereConditions.nome = {
        [Op.like]: `%${filters.nome}%`
      };
    }

    if (filters.codigo_hub) {
      whereConditions.codigo_hub = {
        [Op.like]: `%${filters.codigo_hub}%`
      };
    }

    if (filters.status) {
      whereConditions.status = filters.status;
    }

    try {
      console.log(`[HubsServices] Buscando todos os hubs com filtros:`, filters);
      
      const { count, rows } = await db.Hubs.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: db.Enderecos,
            as: 'enderecos',
            attributes: ['cidade', 'estado', 'bairro']
          },
          {
            model: db.Estoques,
            attributes: ['id'],
            required: false
          },
          {
            model: db.Transportes,
            as: 'transportesOrigem',
            attributes: ['id'],
            required: false,
            where: {
              status_transporte: ['CRIADO', 'EM_TRANSPORTE']
            }
          },
          {
            model: db.Transportes,
            as: 'transportesDestino',
            attributes: ['id'],
            required: false,
            where: {
              status_transporte: ['CRIADO', 'EM_TRANSPORTE']
            }
          }
        ],
        attributes: ['id', 'nome', 'codigo_hub', 'status', 'createdAt', 'updatedAt'],
        order: [[sortBy, sortOrder]],
        limit: parseInt(limit),
        offset: offset,
        distinct: true
      });

      console.log(`[HubsServices] Encontrados ${count} hubs no total`);
      
      return {
        hubs: rows,
        total: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit: limit
      };
    } catch (error) {
      console.error(`[HubsServices] Erro ao buscar hubs: ${error.message}`);
      throw new Error(`Erro ao buscar hubs: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas detalhadas de um hub
   * @param {number} id - ID do hub
   * @returns {Promise<object>} Estatísticas do hub
   */
  async getEstatisticasHub(id) {
    try {
      console.log(`[HubsServices] Buscando estatísticas do hub ID: ${id}`);
      
      const hub = await db.Hubs.findByPk(id, {
        include: [
          {
            model: db.Enderecos,
            as: 'enderecos',
            attributes: ['cidade', 'estado']
          }
        ]
      });
      if (!hub) {
        console.error(`[HubsServices] Hub não encontrado: ${id}`);
        throw new Error('Hub não encontrado');
      }

      const transportesOrigem = await db.Transportes.count({
        where: { hub_origem_id: id }
      });

      const transportesDestino = await db.Transportes.count({
        where: { hub_destino_id: id }
      });

      const transportesAtivos = await db.Transportes.count({
        where: {
          [Op.or]: [
            { hub_origem_id: id, status_transporte: ['CRIADO', 'EM_TRANSPORTE'] },
            { hub_destino_id: id, status_transporte: ['CRIADO', 'EM_TRANSPORTE'] }
          ]
        }
      });

      const estoque = await db.Estoques.findAll({
        where: { hub_id: id },
        attributes: ['quantidade']
      });

      const totalEstoque = estoque.reduce((total, item) => total + item.quantidade, 0);
      const itensEstoque = estoque.length;

      console.log(`[HubsServices] Estatísticas do hub ${id}:`, {
        transportesOrigem,
        transportesDestino,
        transportesAtivos,
        totalEstoque,
        itensEstoque
      });

      return {
        hub: {
          id: hub.id,
          nome: hub.nome,
          cidade: hub.enderecos?.cidade,
          estado: hub.enderecos?.estado
        },
        estatisticas: {
          transportes: {
            origem: transportesOrigem,
            destino: transportesDestino,
            ativos: transportesAtivos,
            total: transportesOrigem + transportesDestino
          },
          estoque: {
            totalItens: itensEstoque,
            quantidadeTotal: totalEstoque
          },
          ultimaAtualizacao: new Date()
        }
      };
    } catch (error) {
      console.error(`[HubsServices] Erro ao buscar estatísticas do hub: ${error.message}`);
      throw new Error(`Erro ao buscar estatísticas do hub: ${error.message}`);
    }
  }

  /**
   * Busca hubs por localização
   * @param {string} cidade - Cidade para filtrar
   * @param {string} estado - Estado para filtrar (opcional)
   * @returns {Promise<Array>} Lista de hubs
   */
  async getHubsPorLocalizacao(cidade, estado = null) {
    try {
      console.log(`[HubsServices] Buscando hubs por localização: cidade=${cidade}, estado=${estado}`);
      
      const whereConditions = {};

      if (cidade) {
        whereConditions['$enderecos.cidade$'] = {
          [Op.like]: `%${cidade}%`
        };
      }

      if (estado) {
        whereConditions['$enderecos.estado$'] = {
          [Op.like]: `%${estado}%`
        };
      }

      const hubs = await db.Hubs.findAll({
        where: whereConditions,
        include: [
          {
            model: db.Enderecos,
            as: 'enderecos',
            attributes: ['cidade', 'estado', 'bairro']
          }
        ],
        attributes: ['id', 'nome', 'codigo_hub'],
        order: [
          ['nome', 'ASC']
        ]
      });

      console.log(`[HubsServices] Encontrados ${hubs.length} hubs na localização`);
      return hubs;
    } catch (error) {
      console.error(`[HubsServices] Erro ao buscar hubs por localização: ${error.message}`);
      throw new Error(`Erro ao buscar hubs por localização: ${error.message}`);
    }
  }

  /**
   * Atualiza um hub existente
   * @param {number} id - ID do hub
   * @param {object} data - Dados para atualização
   * @returns {Promise<object>} Hub atualizado
   */
  async updateHub(id, data) {
    const transaction = await db.sequelize.transaction();

    try {
      console.log(`[HubsServices] Atualizando hub ID: ${id} com dados:`, JSON.stringify(data));
      
      const hub = await db.Hubs.findByPk(id);
      if (!hub) {
        console.error(`[HubsServices] Hub não encontrado: ${id}`);
        throw new Error('Hub não encontrado');
      }

      if (data.nome && data.nome !== hub.nome) {
        console.log(`[HubsServices] Verificando duplicidade do novo nome: "${data.nome}"`);
        const nomeExistente = await db.Hubs.findOne({
          where: {
            nome: {
              [Op.like]: data.nome
            },
            id: { [Op.ne]: id }
          },
          transaction
        });

        if (nomeExistente) {
          console.error(`[HubsServices] Já existe um hub com este nome: ${data.nome}`);
          throw new Error('Já existe um hub com este nome');
        }
      }

      if (data.endereco_id) {
        console.log(`[HubsServices] Verificando endereço ID: ${data.endereco_id}`);
        const endereco = await db.Enderecos.findByPk(data.endereco_id, { transaction });
        if (!endereco) {
          console.error(`[HubsServices] Endereço não encontrado: ${data.endereco_id}`);
          throw new Error('Endereço não encontrado');
        }
      }

      const camposPermitidos = ['nome', 'codigo_hub', 'endereco_id', 'status'];

      const dadosAtualizacao = {};
      camposPermitidos.forEach(campo => {
        if (data[campo] !== undefined) {
          dadosAtualizacao[campo] = data[campo];
        }
      });

      console.log(`[HubsServices] Dados para atualização:`, dadosAtualizacao);
      
      await db.Hubs.update(dadosAtualizacao, {
        where: { id: Number(id) },
        transaction
      });

      console.log('[HubsServices] Commit da transação');
      await transaction.commit();
      
      const hubAtualizado = await this.getHubById(id);
      console.log('[HubsServices] Hub atualizado com sucesso');
      return hubAtualizado;
    } catch (error) {
      console.error(`[HubsServices] Erro ao atualizar hub: ${error.message}`);
      
      if (transaction && !transaction.finished) {
        console.log('[HubsServices] Fazendo rollback da transação');
        await transaction.rollback();
      }
      throw new Error(`Erro ao atualizar hub: ${error.message}`);
    }
  }

  /**
   * Exclui um hub (apenas se não tiver dependências)
   * @param {number} id - ID do hub
   * @returns {Promise<object>} Resultado da exclusão
   */
  async deleteHub(id) {
    const transaction = await db.sequelize.transaction();

    try {
      console.log(`[HubsServices] Iniciando exclusão do hub ID: ${id}`);
      
      const hub = await db.Hubs.findByPk(id);
      if (!hub) {
        console.error(`[HubsServices] Hub não encontrado: ${id}`);
        throw new Error('Hub não encontrado');
      }

      const transportesCount = await db.Transportes.count({
        where: {
          [Op.or]: [
            { hub_origem_id: id },
            { hub_destino_id: id }
          ]
        },
        transaction
      });

      if (transportesCount > 0) {
        console.error(`[HubsServices] Hub tem ${transportesCount} transportes associados`);
        throw new Error('Não é possível excluir hub com transportes associados');
      }

      const estoqueCount = await db.Estoques.count({
        where: { hub_id: id },
        transaction
      });

      if (estoqueCount > 0) {
        console.error(`[HubsServices] Hub tem ${estoqueCount} itens de estoque associados`);
        throw new Error('Não é possível excluir hub com estoque associado');
      }

      console.log(`[HubsServices] Excluindo hub ID: ${id}`);
      await db.Hubs.destroy({
        where: { id: Number(id) },
        transaction
      });

      console.log('[HubsServices] Commit da transação');
      await transaction.commit();
      
      console.log('[HubsServices] Hub excluído com sucesso');
      return { success: true, message: 'Hub excluído com sucesso' };
    } catch (error) {
      console.error(`[HubsServices] Erro ao excluir hub: ${error.message}`);
      
      if (transaction && !transaction.finished) {
        console.log('[HubsServices] Fazendo rollback da transação');
        await transaction.rollback();
      }
      throw new Error(`Erro ao excluir hub: ${error.message}`);
    }
  }

  /**
   * Obtém relatório de utilização de todos os hubs
   * @returns {Promise<Array>} Relatório de utilização
   */
  async getRelatorioUtilizacao() {
    try {
      console.log('[HubsServices] Gerando relatório de utilização');
      
      const hubs = await db.Hubs.findAll({
        include: [
          {
            model: db.Enderecos,
            as: 'enderecos',
            attributes: ['cidade', 'estado']
          },
          {
            model: db.Estoques,
            attributes: [
              [db.sequelize.fn('COUNT', db.sequelize.col('Estoques.id')), 'total_itens'],
              [db.sequelize.fn('SUM', db.sequelize.col('Estoques.quantidade')), 'quantidade_total']
            ],
            required: false
          },
          {
            model: db.Transportes,
            as: 'transportesOrigem',
            attributes: [
              [db.sequelize.fn('COUNT', db.sequelize.col('transportesOrigem.id')), 'total_transportes_origem']
            ],
            required: false
          },
          {
            model: db.Transportes,
            as: 'transportesDestino',
            attributes: [
              [db.sequelize.fn('COUNT', db.sequelize.col('transportesDestino.id')), 'total_transportes_destino']
            ],
            required: false
          }
        ],
        attributes: ['id', 'nome', 'codigo_hub', 'status'],
        group: ['Hubs.id', 'enderecos.id'],
        order: [
          ['nome', 'ASC']
        ]
      });

      console.log(`[HubsServices] Relatório gerado para ${hubs.length} hubs`);
      return hubs;
    } catch (error) {
      console.error(`[HubsServices] Erro ao buscar relatório de utilização: ${error.message}`);
      throw new Error(`Erro ao buscar relatório de utilização: ${error.message}`);
    }
  }

  /**
   * Busca hubs ativos para dropdowns
   * @returns {Promise<Array>} Lista de hubs ativos
   */
  async getHubsAtivos() {
    try {
      console.log('[HubsServices] Buscando hubs ativos');
      
      const hubs = await db.Hubs.findAll({
        where: {
          status: 'ATIVO'
        },
        include: [
          {
            model: db.Enderecos,
            as: 'enderecos',
            attributes: ['cidade', 'estado']
          }
        ],
        attributes: ['id', 'nome', 'codigo_hub'],
        order: [['nome', 'ASC']]
      });

      console.log(`[HubsServices] Encontrados ${hubs.length} hubs ativos`);
      return hubs;
    } catch (error) {
      console.error(`[HubsServices] Erro ao buscar hubs ativos: ${error.message}`);
      throw new Error(`Erro ao buscar hubs ativos: ${error.message}`);
    }
  }

  /**
   * Atualiza status de um hub
   * @param {number} id - ID do hub
   * @param {string} status - Novo status
   * @returns {Promise<object>} Hub atualizado
   */
  async updateStatus(id, status) {
    const transaction = await db.sequelize.transaction();

    try {
      console.log(`[HubsServices] Atualizando status do hub ${id} para: ${status}`);
      
      const hub = await db.Hubs.findByPk(id);
      if (!hub) {
        console.error(`[HubsServices] Hub não encontrado: ${id}`);
        throw new Error('Hub não encontrado');
      }

      const statusValidos = ['ATIVO', 'INATIVO', 'MANUTENCAO'];
      if (!statusValidos.includes(status)) {
        console.error(`[HubsServices] Status inválido: ${status}. Valores permitidos: ${statusValidos.join(', ')}`);
        throw new Error(`Status inválido. Valores permitidos: ${statusValidos.join(', ')}`);
      }

      await hub.update({ status }, { transaction });
      
      console.log('[HubsServices] Commit da transação');
      await transaction.commit();

      const hubAtualizado = await this.getHubById(id);
      console.log(`[HubsServices] Status atualizado com sucesso`);
      return hubAtualizado;
    } catch (error) {
      console.error(`[HubsServices] Erro ao atualizar status do hub: ${error.message}`);
      
      if (transaction && !transaction.finished) {
        console.log('[HubsServices] Fazendo rollback da transação');
        await transaction.rollback();
      }
      throw new Error(`Erro ao atualizar status do hub: ${error.message}`);
    }
  }

  /**
   * Resolve ou cria hub baseado no input (para uso em outros serviços)
   * @param {number|string|object} input - ID, nome ou dados do hub
   * @param {object} transaction - Transação do Sequelize
   * @returns {Promise<number|null>} ID do hub resolvido ou null
   */
  async resolveOrCreateHub(input, transaction) {
    if (!input) return null;

    try {
      console.log(`[HubsServices] Resolvendo/criando hub com input:`, input);
      
      // Caso 1: Input é número ou string numérica -> buscar por ID
      if (typeof input === 'number' || (!isNaN(input) && typeof input === 'string')) {
        const hubId = Number(input);
        console.log(`[HubsServices] Buscando hub por ID: ${hubId}`);
        const hub = await db.Hubs.findByPk(hubId, { transaction });
        if (!hub) throw new Error(`Hub com ID ${hubId} não encontrado`);
        console.log(`[HubsServices] Hub encontrado: ${hub.id} - ${hub.nome}`);
        return hub.id;
      }

      // Caso 2: Input é string -> buscar/criar por nome
      if (typeof input === 'string') {
        console.log(`[HubsServices] Buscando hub por nome: "${input}"`);
        const hubs = await this.searchHubsByName(input, { transaction });
        
        // Se encontrou exatamente um, retornar ID
        if (hubs.length === 1) {
          console.log(`[HubsServices] Encontrado 1 hub: ${hubs[0].id} - ${hubs[0].nome}`);
          return hubs[0].id;
        }
        
        // Se encontrou múltiplos, usar o primeiro
        if (hubs.length > 0) {
          console.log(`[HubsServices] Encontrados ${hubs.length} hubs, usando o primeiro: ${hubs[0].id}`);
          return hubs[0].id;
        }
        
        // Se não encontrou, criar automaticamente
        console.log(`[HubsServices] Nenhum hub encontrado, criando automaticamente: "${input}"`);
        const novoHub = await this.createHubAuto(input, { transaction });
        return novoHub.id;
      }

      // Caso 3: Input é objeto -> criar ou buscar hub
      if (typeof input === 'object') {
        const { nome, codigo_hub, endereco, endereco_id } = input;
        
        if (!nome) {
          console.error('[HubsServices] Nome do hub é obrigatório quando fornecido como objeto');
          throw new Error('Nome do hub é obrigatório quando fornecido como objeto');
        }

        console.log(`[HubsServices] Buscando hub por nome no objeto: "${nome}"`);
        // Verificar se hub já existe pelo nome
        const hubs = await this.searchHubsByName(nome, { transaction });
        if (hubs.length > 0) {
          console.log(`[HubsServices] Hub já existe: ${hubs[0].id} - ${hubs[0].nome}`);
          return hubs[0].id;
        }

        // Resolver endereço
        let enderecoIdFinal = endereco_id;
        
        if (endereco) {
          console.log('[HubsServices] Criando novo endereço');
          const novoEndereco = await db.Enderecos.create(endereco, { transaction });
          enderecoIdFinal = novoEndereco.id;
        }

        // Criar novo hub
        console.log(`[HubsServices] Criando novo hub: "${nome}"`);
        const novoHub = await db.Hubs.create({
          nome,
          codigo_hub: codigo_hub || `HUB-${Date.now()}`,
          endereco_id: enderecoIdFinal,
          status: 'ATIVO'
        }, { transaction });

        console.log(`[HubsServices] Hub criado: ${novoHub.id} - ${novoHub.nome}`);
        return novoHub.id;
      }

      console.log('[HubsServices] Input não reconhecido, retornando null');
      return null;
    } catch (error) {
      console.error('[HubsServices] Erro em resolveOrCreateHub:', error);
      throw new Error(`Falha ao resolver/criar hub: ${error.message}`);
    }
  }
}

module.exports = HubsServices;