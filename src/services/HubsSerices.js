const Services = require('./Services');
const db = require('../models');
const { Op } = require('sequelize');

class HubsServices extends Services {
  constructor() {
    super('Hubs');
  }

  async findHub(identifier) {
    try {
      const id = Number(identifier);
      
      if (!isNaN(id)) {
        return await db.Hubs.findByPk(id, {
          include: [
            {
              model: db.Transporte,
              as: 'transportesOrigem',
              attributes: ['id', 'numero_transporte', 'status_transporte', 'data_criacao'],
              include: [
                {
                  model: db.Motorista,
                  as: 'motorista',
                  attributes: ['id', 'nome']
                },
                {
                  model: db.Hubs,
                  as: 'hubDestino',
                  attributes: ['id', 'nome', 'cidade']
                }
              ],
              order: [['data_criacao', 'DESC']],
              limit: 10
            },
            {
              model: db.Transporte,
              as: 'transportesDestino',
              attributes: ['id', 'numero_transporte', 'status_transporte', 'data_criacao'],
              include: [
                {
                  model: db.Motorista,
                  as: 'motorista',
                  attributes: ['id', 'nome']
                },
                {
                  model: db.Hubs,
                  as: 'hubOrigem',
                  attributes: ['id', 'nome', 'cidade']
                }
              ],
              order: [['data_criacao', 'DESC']],
              limit: 10
            },
            {
              model: db.Estoque,
              as: 'estoque',
              attributes: ['id', 'quantidade', 'localizacao'],
              include: [
                {
                  model: db.Produtos,
                  as: 'produto',
                  attributes: ['id', 'nome', 'codigo']
                }
              ]
            }
          ]
        });
      } else {
        return await db.Hubs.findOne({
          where: {
            nome: {
              [Op.iLike]: `%${identifier}%`
            },
            status: 'ativo'
          },
          include: [
            {
              model: db.Transporte,
              as: 'transportesOrigem',
              attributes: ['id', 'numero_transporte', 'status_transporte'],
              required: false
            },
            {
              model: db.Transporte,
              as: 'transportesDestino',
              attributes: ['id', 'numero_transporte', 'status_transporte'],
              required: false
            }
          ]
        });
      }
    } catch (error) {
      throw new Error(`Erro ao buscar hub: ${error.message}`);
    }
  }

  async getHubsDisponiveis() {
    try {
      return await db.Hubs.findAll({
        where: {
          status: 'ativo',
          capacidade: {
            [Op.gt]: 0 
          }
        },
        include: [
          {
            model: db.Estoque,
            as: 'estoque',
            attributes: ['id'],
            required: false
          }
        ],
        attributes: [
          'id', 'nome', 'cidade', 'estado', 'capacidade', 
          'capacidade_utilizada', 'status', 'telefone', 'responsavel'
        ],
        order: [
          ['cidade', 'ASC'],
          ['nome', 'ASC']
        ]
      });
    } catch (error) {
      throw new Error(`Erro ao buscar hubs disponíveis: ${error.message}`);
    }
  }

  async getAllHubs(options = {}) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'nome',
      sortOrder = 'ASC',
      filters = {}
    } = options;

    const offset = (page - 1) * limit;
    
    const whereConditions = {};

    if (filters.status) {
      whereConditions.status = filters.status;
    } else {
      whereConditions.status = 'ativo'; 
    }

    if (filters.nome) {
      whereConditions.nome = {
        [Op.iLike]: `%${filters.nome}%`
      };
    }

    if (filters.cidade) {
      whereConditions.cidade = {
        [Op.iLike]: `%${filters.cidade}%`
      };
    }

    if (filters.estado) {
      whereConditions.estado = {
        [Op.iLike]: `%${filters.estado}%`
      };
    }

    if (filters.capacidade_min) {
      whereConditions.capacidade = {
        [Op.gte]: Number(filters.capacidade_min)
      };
    }

    if (filters.capacidade_max) {
      whereConditions.capacidade = {
        ...whereConditions.capacidade,
        [Op.lte]: Number(filters.capacidade_max)
      };
    }

    try {
      const { count, rows } = await db.Hubs.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: db.Estoque,
            as: 'estoque',
            attributes: ['id'],
            required: false
          },
          {
            model: db.Transporte,
            as: 'transportesOrigem',
            attributes: ['id'],
            required: false,
            where: {
              status_transporte: ['CRIADO', 'EM_TRANSPORTE']
            }
          },
          {
            model: db.Transporte,
            as: 'transportesDestino',
            attributes: ['id'],
            required: false,
            where: {
              status_transporte: ['CRIADO', 'EM_TRANSPORTE']
            }
          }
        ],
        attributes: [
          'id', 'nome', 'cidade', 'estado', 'endereco', 'cep', 
          'telefone', 'responsavel', 'capacidade', 'capacidade_utilizada',
          'status', 'createdAt', 'updatedAt'
        ],
        order: [[sortBy, sortOrder]],
        limit: parseInt(limit),
        offset: offset,
        distinct: true
      });

      return {
        hubs: rows,
        total: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit: limit
      };
    } catch (error) {
      throw new Error(`Erro ao buscar hubs: ${error.message}`);
    }
  }

  async getHubById(id) {
    try {
      return await db.Hubs.findByPk(id, {
        include: [
          {
            model: db.Transporte,
            as: 'transportesOrigem',
            attributes: ['id', 'numero_transporte', 'status_transporte', 'data_criacao'],
            include: [
              {
                model: db.Motorista,
                as: 'motorista',
                attributes: ['id', 'nome', 'veiculo']
              },
              {
                model: db.Hubs,
                as: 'hubDestino',
                attributes: ['id', 'nome', 'cidade']
              }
            ],
            order: [['data_criacao', 'DESC']]
          },
          {
            model: db.Transporte,
            as: 'transportesDestino',
            attributes: ['id', 'numero_transporte', 'status_transporte', 'data_criacao'],
            include: [
              {
                model: db.Motorista,
                as: 'motorista',
                attributes: ['id', 'nome', 'veiculo']
              },
              {
                model: db.Hubs,
                as: 'hubOrigem',
                attributes: ['id', 'nome', 'cidade']
              }
            ],
            order: [['data_criacao', 'DESC']]
          },
          {
            model: db.Estoque,
            as: 'estoque',
            attributes: ['id', 'quantidade', 'localizacao', 'data_entrada'],
            include: [
              {
                model: db.Produtos,
                as: 'produto',
                attributes: ['id', 'nome', 'codigo', 'categoria']
              },
              {
                model: db.Pedidos,
                as: 'pedido',
                attributes: ['id', 'codigo_pedido'],
                include: [
                  {
                    model: db.Clientes,
                    as: 'cliente',
                    attributes: ['nome']
                  }
                ]
              }
            ],
            order: [['data_entrada', 'DESC']]
          },
          {
            model: db.Conferencia,
            as: 'conferencias',
            attributes: ['id', 'tipo', 'status', 'data_inicio'],
            include: [
              {
                model: db.Usuario,
                as: 'operador',
                attributes: ['nome']
              }
            ],
            order: [['data_inicio', 'DESC']]
          }
        ]
      });
    } catch (error) {
      throw new Error(`Erro ao buscar hub por ID: ${error.message}`);
    }
  }

  async getEstatisticasHub(id) {
    try {
      const hub = await db.Hubs.findByPk(id);
      if (!hub) {
        throw new Error('Hub não encontrado');
      }

      // Estatísticas de transportes
      const transportesOrigem = await db.Transporte.count({
        where: { hub_origem_id: id }
      });

      const transportesDestino = await db.Transporte.count({
        where: { hub_destino_id: id }
      });

      const transportesAtivos = await db.Transporte.count({
        where: {
          [Op.or]: [
            { hub_origem_id: id, status_transporte: ['CRIADO', 'EM_TRANSPORTE'] },
            { hub_destino_id: id, status_transporte: ['CRIADO', 'EM_TRANSPORTE'] }
          ]
        }
      });

      const estoque = await db.Estoque.findAll({
        where: { hub_id: id },
        attributes: ['quantidade']
      });

      const totalEstoque = estoque.reduce((total, item) => total + item.quantidade, 0);
      const itensEstoque = estoque.length;

      const capacidadeUtilizada = hub.capacidade_utilizada || 0;
      const capacidadeDisponivel = hub.capacidade - capacidadeUtilizada;
      const percentualUtilizacao = hub.capacidade > 0 ? 
        (capacidadeUtilizada / hub.capacidade) * 100 : 0;

      const conferencias = await db.Conferencia.count({
        where: {
          [Op.or]: [
            { '$transporte.hub_origem_id$': id },
            { '$transporte.hub_destino_id$': id }
          ]
        },
        include: [
          {
            model: db.Transporte,
            as: 'transporte',
            attributes: []
          }
        ]
      });

      return {
        hub: {
          id: hub.id,
          nome: hub.nome,
          cidade: hub.cidade,
          estado: hub.estado
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
            quantidadeTotal: totalEstoque,
            capacidade: {
              total: hub.capacidade,
              utilizada: capacidadeUtilizada,
              disponivel: capacidadeDisponivel,
              percentualUtilizacao: parseFloat(percentualUtilizacao.toFixed(2))
            }
          },
          conferencias: conferencias,
          ultimaAtualizacao: new Date()
        }
      };
    } catch (error) {
      throw new Error(`Erro ao buscar estatísticas do hub: ${error.message}`);
    }
  }

  async getHubsPorLocalizacao(cidade, estado = null) {
    try {
      const whereConditions = {
        cidade: {
          [Op.iLike]: `%${cidade}%`
        },
        status: 'ativo'
      };

      if (estado) {
        whereConditions.estado = {
          [Op.iLike]: `%${estado}%`
        };
      }

      return await db.Hubs.findAll({
        where: whereConditions,
        attributes: ['id', 'nome', 'cidade', 'estado', 'endereco', 'telefone', 'capacidade'],
        order: [
          ['estado', 'ASC'],
          ['cidade', 'ASC'],
          ['nome', 'ASC']
        ]
      });
    } catch (error) {
      throw new Error(`Erro ao buscar hubs por localização: ${error.message}`);
    }
  }

  async verificarCapacidade(hubId, quantidadeAdicional = 0) {
    try {
      const hub = await db.Hubs.findByPk(hubId);
      if (!hub) {
        throw new Error('Hub não encontrado');
      }

      const capacidadeUtilizada = hub.capacidade_utilizada || 0;
      const capacidadeDisponivel = hub.capacidade - capacidadeUtilizada;
      const capacidadeSuficiente = capacidadeDisponivel >= quantidadeAdicional;

      return {
        capacidadeSuficiente,
        capacidadeTotal: hub.capacidade,
        capacidadeUtilizada,
        capacidadeDisponivel,
        capacidadeNecessaria: quantidadeAdicional,
        percentualUtilizacao: hub.capacidade > 0 ? 
          (capacidadeUtilizada / hub.capacidade) * 100 : 0
      };
    } catch (error) {
      throw new Error(`Erro ao verificar capacidade do hub: ${error.message}`);
    }
  }

  async createHub(data) {
    const transaction = await db.sequelize.transaction();

    try {
      if (!data.nome) {
        throw new Error('Nome do hub é obrigatório');
      }

      if (!data.cidade) {
        throw new Error('Cidade do hub é obrigatório');
      }

      if (!data.estado) {
        throw new Error('Estado do hub é obrigatório');
      }

      if (!data.capacidade || data.capacidade <= 0) {
        throw new Error('Capacidade do hub deve ser maior que zero');
      }

      const hubExistente = await db.Hubs.findOne({
        where: {
          nome: data.nome,
          cidade: data.cidade,
          estado: data.estado
        },
        transaction
      });

      if (hubExistente) {
        throw new Error('Já existe um hub com este nome na mesma cidade/estado');
      }

      const hub = await db.Hubs.create({
        nome: data.nome,
        cidade: data.cidade,
        estado: data.estado,
        endereco: data.endereco,
        cep: data.cep,
        telefone: data.telefone,
        responsavel: data.responsavel,
        capacidade: data.capacidade,
        capacidade_utilizada: 0,
        status: 'ativo',
        ...data
      }, { transaction });

      await transaction.commit();
      return await this.getHubById(hub.id);
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw new Error(`Erro ao criar hub: ${error.message}`);
    }
  }

  async updateHub(id, data) {
    const transaction = await db.sequelize.transaction();

    try {
      const hub = await db.Hubs.findByPk(id);
      if (!hub) {
        throw new Error('Hub não encontrado');
      }

      if (data.nome && data.nome !== hub.nome) {
        const nomeExistente = await db.Hubs.findOne({
          where: {
            nome: data.nome,
            cidade: data.cidade || hub.cidade,
            estado: data.estado || hub.estado,
            id: { [Op.ne]: id }
          },
          transaction
        });

        if (nomeExistente) {
          throw new Error('Já existe um hub com este nome na mesma cidade/estado');
        }
      }

      if (data.capacidade && data.capacidade < hub.capacidade_utilizada) {
        throw new Error('Nova capacidade não pode ser menor que a capacidade utilizada');
      }

      const camposPermitidos = [
        'nome', 'cidade', 'estado', 'endereco', 'cep', 'telefone',
        'responsavel', 'capacidade', 'status', 'observacoes'
      ];

      const dadosAtualizacao = {};
      camposPermitidos.forEach(campo => {
        if (data[campo] !== undefined) {
          dadosAtualizacao[campo] = data[campo];
        }
      });

      await db.Hubs.update(dadosAtualizacao, {
        where: { id: Number(id) },
        transaction
      });

      await transaction.commit();
      return await this.getHubById(id);
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw new Error(`Erro ao atualizar hub: ${error.message}`);
    }
  }

  async atualizarCapacidadeUtilizada(hubId, novaCapacidadeUtilizada) {
    const transaction = await db.sequelize.transaction();

    try {
      const hub = await db.Hubs.findByPk(hubId);
      if (!hub) {
        throw new Error('Hub não encontrado');
      }

      if (novaCapacidadeUtilizada > hub.capacidade) {
        throw new Error('Capacidade utilizada não pode ser maior que a capacidade total');
      }

      await db.Hubs.update(
        { capacidade_utilizada: novaCapacidadeUtilizada },
        {
          where: { id: hubId },
          transaction
        }
      );

      await transaction.commit();
      return await this.getHubById(hubId);
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw new Error(`Erro ao atualizar capacidade utilizada: ${error.message}`);
    }
  }

  async inativarHub(id) {
    const transaction = await db.sequelize.transaction();

    try {
      const hub = await db.Hubs.findByPk(id);
      if (!hub) {
        throw new Error('Hub não encontrado');
      }

      const transportesAtivos = await db.Transporte.count({
        where: {
          [Op.or]: [
            { hub_origem_id: id, status_transporte: ['CRIADO', 'EM_TRANSPORTE'] },
            { hub_destino_id: id, status_transporte: ['CRIADO', 'EM_TRANSPORTE'] }
          ]
        },
        transaction
      });

      if (transportesAtivos > 0) {
        throw new Error('Não é possível inativar hub com transportes ativos');
      }

      const estoque = await db.Estoque.count({
        where: { hub_id: id },
        transaction
      });

      if (estoque > 0) {
        throw new Error('Não é possível inativar hub com estoque ativo');
      }

      await db.Hubs.update(
        { status: 'inativo' },
        {
          where: { id: Number(id) },
          transaction
        }
      );

      await transaction.commit();
      return await this.getHubById(id);
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw new Error(`Erro ao inativar hub: ${error.message}`);
    }
  }

  async reativarHub(id) {
    try {
      await db.Hubs.update(
        { status: 'ativo' },
        { where: { id: Number(id) } }
      );
      return await this.getHubById(id);
    } catch (error) {
      throw new Error(`Erro ao reativar hub: ${error.message}`);
    }
  }

  async deleteHub(id) {
    const transaction = await db.sequelize.transaction();

    try {
      const hub = await db.Hubs.findByPk(id);
      if (!hub) {
        throw new Error('Hub não encontrado');
      }

      const transportesCount = await db.Transporte.count({
        where: {
          [Op.or]: [
            { hub_origem_id: id },
            { hub_destino_id: id }
          ]
        },
        transaction
      });

      if (transportesCount > 0) {
        throw new Error('Não é possível excluir hub com transportes associados');
      }

      const estoqueCount = await db.Estoque.count({
        where: { hub_id: id },
        transaction
      });

      if (estoqueCount > 0) {
        throw new Error('Não é possível excluir hub com estoque associado');
      }

      const conferenciasCount = await db.Conferencia.count({
        where: {
          [Op.or]: [
            { '$transporte.hub_origem_id$': id },
            { '$transporte.hub_destino_id$': id }
          ]
        },
        include: [
          {
            model: db.Transporte,
            as: 'transporte',
            attributes: []
          }
        ],
        transaction
      });

      if (conferenciasCount > 0) {
        throw new Error('Não é possível excluir hub com conferências associadas');
      }

      await db.Hubs.destroy({
        where: { id: Number(id) },
        transaction
      });

      await transaction.commit();
      return { success: true, message: 'Hub excluído com sucesso' };
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw new Error(`Erro ao excluir hub: ${error.message}`);
    }
  }

  async getHubsComCapacidade(capacidadeMinima = 0) {
    try {
      return await db.Hubs.findAll({
        where: {
          status: 'ativo',
          capacidade: {
            [Op.gt]: 0
          },
          capacidade_utilizada: {
            [Op.lt]: db.sequelize.literal('capacidade')
          }
        },
        having: db.sequelize.literal(`(capacidade - capacidade_utilizada) >= ${capacidadeMinima}`),
        attributes: [
          'id', 'nome', 'cidade', 'estado', 
          'capacidade', 'capacidade_utilizada',
          [
            db.sequelize.literal('capacidade - capacidade_utilizada'),
            'capacidade_disponivel'
          ]
        ],
        order: [
          [db.sequelize.literal('capacidade_disponivel'), 'DESC']
        ]
      });
    } catch (error) {
      throw new Error(`Erro ao buscar hubs com capacidade: ${error.message}`);
    }
  }

  async getRelatorioUtilizacao() {
    try {
      const hubs = await db.Hubs.findAll({
        where: { status: 'ativo' },
        attributes: [
          'id', 'nome', 'cidade', 'estado',
          'capacidade', 'capacidade_utilizada',
          [
            db.sequelize.literal('capacidade - capacidade_utilizada'),
            'capacidade_disponivel'
          ],
          [
            db.sequelize.literal('ROUND((capacidade_utilizada / capacidade) * 100, 2)'),
            'percentual_utilizacao'
          ]
        ],
        include: [
          {
            model: db.Estoque,
            as: 'estoque',
            attributes: [
              [db.sequelize.fn('COUNT', db.sequelize.col('estoque.id')), 'total_itens'],
              [db.sequelize.fn('SUM', db.sequelize.col('estoque.quantidade')), 'quantidade_total']
            ],
            required: false
          },
          {
            model: db.Transporte,
            as: 'transportesOrigem',
            attributes: [
              [db.sequelize.fn('COUNT', db.sequelize.col('transportesOrigem.id')), 'total_transportes_origem']
            ],
            required: false
          },
          {
            model: db.Transporte,
            as: 'transportesDestino',
            attributes: [
              [db.sequelize.fn('COUNT', db.sequelize.col('transportesDestino.id')), 'total_transportes_destino']
            ],
            required: false
          }
        ],
        group: ['Hubs.id'],
        order: [
          ['estado', 'ASC'],
          ['cidade', 'ASC'],
          ['percentual_utilizacao', 'DESC']
        ]
      });

      return hubs;
    } catch (error) {
      throw new Error(`Erro ao buscar relatório de utilização: ${error.message}`);
    }
  }
}

module.exports = HubsServices;