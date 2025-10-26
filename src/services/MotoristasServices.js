const Services = require('./Services');
const db = require('../models');
const { Op } = require('sequelize');

class MotoristasServices extends Services {
  constructor() {
    super('Motorista');
  }

  async findMotorista(identifier) {
    try {
      const id = Number(identifier);
      
      if (!isNaN(id)) {
        return await db.Motorista.findByPk(id, {
          include: [
            {
              model: db.Transporte,
              as: 'transportes',
              attributes: ['id', 'numero_transporte', 'status_transporte'],
              include: [
                {
                  model: db.Hubs,
                  as: 'hubOrigem',
                  attributes: ['id', 'nome']
                },
                {
                  model: db.Hubs,
                  as: 'hubDestino',
                  attributes: ['id', 'nome']
                }
              ]
            }
          ]
        });
      } else {
        return await db.Motorista.findOne({
          where: {
            nome: {
              [Op.iLike]: `%${identifier}%`
            },
            status: 'ativo'
          },
          include: [
            {
              model: db.Transporte,
              as: 'transportes',
              attributes: ['id', 'numero_transporte', 'status_transporte'],
              include: [
                {
                  model: db.Hubs,
                  as: 'hubOrigem',
                  attributes: ['id', 'nome']
                },
                {
                  model: db.Hubs,
                  as: 'hubDestino',
                  attributes: ['id', 'nome']
                }
              ]
            }
          ]
        });
      }
    } catch (error) {
      throw new Error(`Erro ao buscar motorista: ${error.message}`);
    }
  }

  async getMotoristasDisponiveis() {
    try {
      return await db.Motorista.findAll({
        where: {
          status: 'ativo',
          id: {
            [Op.notIn]: db.sequelize.literal(
              `(SELECT motorista_id FROM Transporte WHERE status_transporte IN ('CRIADO', 'EM_TRANSPORTE') AND motorista_id IS NOT NULL)`
            )
          }
        },
        include: [
          {
            model: db.Transporte,
            as: 'transportes',
            attributes: ['id', 'numero_transporte', 'status_transporte'],
            required: false,
            where: {
              status_transporte: ['CRIADO', 'EM_TRANSPORTE']
            }
          }
        ],
        attributes: ['id', 'nome', 'cpf', 'cnh', 'veiculo', 'telefone', 'status'],
        order: [['nome', 'ASC']]
      });
    } catch (error) {
      throw new Error(`Erro ao buscar motoristas disponíveis: ${error.message}`);
    }
  }

  async getMotoristaById(id) {
    try {
      return await db.Motorista.findByPk(id, {
        include: [
          {
            model: db.Transporte,
            as: 'transportes',
            attributes: ['id', 'numero_transporte', 'status_transporte', 'data_criacao'],
            include: [
              {
                model: db.Hubs,
                as: 'hubOrigem',
                attributes: ['id', 'nome', 'cidade']
              },
              {
                model: db.Hubs,
                as: 'hubDestino',
                attributes: ['id', 'nome', 'cidade']
              },
              {
                model: db.Rota,
                as: 'rota',
                attributes: ['id', 'cluster', 'status_rota']
              }
            ],
            order: [['data_criacao', 'DESC']]
          },
          {
            model: db.Coletas,
            as: 'coletas',
            attributes: ['id', 'numero_coleta', 'status', 'data_coleta'],
            order: [['data_coleta', 'DESC']]
          }
        ]
      });
    } catch (error) {
      throw new Error(`Erro ao buscar motorista por ID: ${error.message}`);
    }
  }

  async getAllMotoristasAtivos(options = {}) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'nome',
      sortOrder = 'ASC',
      filters = {}
    } = options;

    const offset = (page - 1) * limit;
    
    const whereConditions = {
      status: 'ativo'
    };

    if (filters.nome) {
      whereConditions.nome = {
        [Op.iLike]: `%${filters.nome}%`
      };
    }

    if (filters.veiculo) {
      whereConditions.veiculo = {
        [Op.iLike]: `%${filters.veiculo}%`
      };
    }

    if (filters.disponivel !== undefined) {
      if (filters.disponivel) {
        whereConditions.id = {
          [Op.notIn]: db.sequelize.literal(
            `(SELECT motorista_id FROM Transporte WHERE status_transporte IN ('CRIADO', 'EM_TRANSPORTE') AND motorista_id IS NOT NULL)`
          )
        };
      } else {
        whereConditions.id = {
          [Op.in]: db.sequelize.literal(
            `(SELECT motorista_id FROM Transporte WHERE status_transporte IN ('CRIADO', 'EM_TRANSPORTE') AND motorista_id IS NOT NULL)`
          )
        };
      }
    }

    try {
      const { count, rows } = await db.Motorista.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: db.Transporte,
            as: 'transportes',
            attributes: ['id', 'numero_transporte', 'status_transporte'],
            required: false
          }
        ],
        attributes: [
          'id', 'nome', 'cpf', 'cnh', 'veiculo', 'telefone', 
          'email', 'data_nascimento', 'status', 'createdAt'
        ],
        order: [[sortBy, sortOrder]],
        limit: parseInt(limit),
        offset: offset,
        distinct: true
      });

      return {
        motoristas: rows,
        total: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit: limit
      };
    } catch (error) {
      throw new Error(`Erro ao buscar motoristas ativos: ${error.message}`);
    }
  }

  async getColetasByMotorista(id) {
    try {
      const motorista = await db.Motorista.findByPk(id, {
        include: [
          {
            model: db.Coletas,
            as: 'coletas',
            include: [
              {
                model: db.Clientes,
                as: 'cliente',
                attributes: ['id', 'nome', 'telefone']
              },
              {
                model: db.Pedidos,
                as: 'pedidos',
                attributes: ['id', 'codigo_pedido', 'status'],
                include: [
                  {
                    model: db.Produtos,
                    as: 'produto',
                    attributes: ['id', 'nome']
                  }
                ]
              }
            ],
            order: [['data_coleta', 'DESC']]
          }
        ]
      });

      if (!motorista) {
        throw new Error('Motorista não encontrado');
      }

      return motorista.coletas;
    } catch (error) {
      throw new Error(`Erro ao buscar coletas do motorista: ${error.message}`);
    }
  }

  async getEstatisticasMotorista(id) {
    try {
      const motorista = await db.Motorista.findByPk(id);
      if (!motorista) {
        throw new Error('Motorista não encontrado');
      }

      const transportes = await db.Transporte.findAll({
        where: { motorista_id: id },
        attributes: ['status_transporte']
      });

      const estatisticasTransportes = {
        total: transportes.length,
        criados: transportes.filter(t => t.status_transporte === 'CRIADO').length,
        em_transporte: transportes.filter(t => t.status_transporte === 'EM_TRANSPORTE').length,
        recebidos: transportes.filter(t => t.status_transporte === 'RECEBIDO').length,
        cancelados: transportes.filter(t => t.status_transporte === 'CANCELADO').length
      };

      const coletas = await db.Coletas.count({
        where: { motorista_id: id }
      });

      const rotas = await db.Rota.findAll({
        where: { id_motorista: id },
        attributes: ['distancia_total_km']
      });

      const quilometragemTotal = rotas.reduce((total, rota) => {
        return total + (rota.distancia_total_km || 0);
      }, 0);

      return {
        motorista: {
          id: motorista.id,
          nome: motorista.nome,
          veiculo: motorista.veiculo
        },
        estatisticas: {
          transportes: estatisticasTransportes,
          totalColetas: coletas,
          quilometragemTotal: parseFloat(quilometragemTotal.toFixed(2)),
          avaliacaoMedia: await this.calcularAvaliacaoMedia(id)
        }
      };
    } catch (error) {
      throw new Error(`Erro ao buscar estatísticas do motorista: ${error.message}`);
    }
  }

  async calcularAvaliacaoMedia(motoristaId) {
    try {
      const avaliacoes = await db.AvaliacaoMotorista?.findAll({
        where: { motorista_id: motoristaId },
        attributes: ['nota']
      }).catch(() => []);

      if (!avaliacoes || avaliacoes.length === 0) {
        return 4.5; 
      }

      const soma = avaliacoes.reduce((total, av) => total + av.nota, 0);
      return parseFloat((soma / avaliacoes.length).toFixed(1));
    } catch (error) {
      return 4.5; 
    }
  }

  async createMotorista(data) {
    const transaction = await db.sequelize.transaction();
    try {
      if (!data.nome) {
        throw new Error('Nome do motorista é obrigatório');
      }

      if (!data.cpf) {
        throw new Error('CPF do motorista é obrigatório');
      }

      const motoristaExistente = await db.Motorista.findOne({
        where: { cpf: data.cpf },
        transaction
      });

      if (motoristaExistente) {
        throw new Error('Já existe um motorista cadastrado com este CPF');
      }

      if (data.cnh) {
        const cnhExistente = await db.Motorista.findOne({
          where: { cnh: data.cnh },
          transaction
        });

        if (cnhExistente) {
          throw new Error('Já existe um motorista cadastrado com esta CNH');
        }
      }

      const motorista = await db.Motorista.create({
        nome: data.nome,
        cpf: data.cpf,
        cnh: data.cnh,
        veiculo: data.veiculo,
        telefone: data.telefone,
        email: data.email,
        data_nascimento: data.data_nascimento,
        status: 'ativo',
        ...data
      }, { transaction });

      await transaction.commit();
      return await this.getMotoristaById(motorista.id);
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw new Error(`Erro ao criar motorista: ${error.message}`);
    }
  }

  async updateMotorista(id, data) {
    const transaction = await db.sequelize.transaction();

    try {
      const motorista = await db.Motorista.findByPk(id);
      if (!motorista) {
        throw new Error('Motorista não encontrado');
      }

      if (data.cpf && data.cpf !== motorista.cpf) {
        const cpfExistente = await db.Motorista.findOne({
          where: { cpf: data.cpf },
          transaction
        });

        if (cpfExistente) {
          throw new Error('Já existe um motorista cadastrado com este CPF');
        }
      }

      if (data.cnh && data.cnh !== motorista.cnh) {
        const cnhExistente = await db.Motorista.findOne({
          where: { cnh: data.cnh },
          transaction
        });

        if (cnhExistente) {
          throw new Error('Já existe um motorista cadastrado com esta CNH');
        }
      }

      const camposPermitidos = [
        'nome', 'cpf', 'cnh', 'veiculo', 'telefone', 'email',
        'data_nascimento', 'status', 'observacoes'
      ];

      const dadosAtualizacao = {};
      camposPermitidos.forEach(campo => {
        if (data[campo] !== undefined) {
          dadosAtualizacao[campo] = data[campo];
        }
      });

      await db.Motorista.update(dadosAtualizacao, {
        where: { id: Number(id) },
        transaction
      });

      await transaction.commit();
      return await this.getMotoristaById(id);
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw new Error(`Erro ao atualizar motorista: ${error.message}`);
    }
  }

  async inativarMotorista(id) {
    const transaction = await db.sequelize.transaction();

    try {
      const motorista = await db.Motorista.findByPk(id);
      if (!motorista) {
        throw new Error('Motorista não encontrado');
      }

      const transportesAtivos = await db.Transporte.count({
        where: {
          motorista_id: id,
          status_transporte: ['CRIADO', 'EM_TRANSPORTE']
        },
        transaction
      });

      if (transportesAtivos > 0) {
        throw new Error('Não é possível inativar motorista com transportes ativos');
      }

      await db.Motorista.update(
        { status: 'inativo' },
        {
          where: { id: Number(id) },
          transaction
        }
      );

      await transaction.commit();
      return await this.getMotoristaById(id);
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw new Error(`Erro ao inativar motorista: ${error.message}`);
    }
  }

  async reativarMotorista(id) {
    try {
      await db.Motorista.update(
        { status: 'ativo' },
        { where: { id: Number(id) } }
      );
      return await this.getMotoristaById(id);
    } catch (error) {
      throw new Error(`Erro ao reativar motorista: ${error.message}`);
    }
  }

  async getMotoristasPorVeiculo(veiculo) {
    try {
      return await db.Motorista.findAll({
        where: {
          veiculo: {
            [Op.iLike]: `%${veiculo}%`
          },
          status: 'ativo'
        },
        attributes: ['id', 'nome', 'veiculo', 'telefone'],
        order: [['nome', 'ASC']]
      });
    } catch (error) {
      throw new Error(`Erro ao buscar motoristas por veículo: ${error.message}`);
    }
  }

  async verificarDisponibilidade(motoristaId) {
    try {
      const motorista = await db.Motorista.findByPk(motoristaId);
      if (!motorista || motorista.status !== 'ativo') {
        return { disponivel: false, motivo: 'Motorista inativo ou não encontrado' };
      }

      const transportesAtivos = await db.Transporte.count({
        where: {
          motorista_id: motoristaId,
          status_transporte: ['CRIADO', 'EM_TRANSPORTE']
        }
      });

      if (transportesAtivos > 0) {
        return { 
          disponivel: false, 
          motivo: `Motorista possui ${transportesAtivos} transporte(s) em andamento` 
        };
      }

      return { disponivel: true, motorista };
    } catch (error) {
      throw new Error(`Erro ao verificar disponibilidade: ${error.message}`);
    }
  }

  async restoreMotorista(id) {
    try {
      await db.Motorista.restore({ where: { id: Number(id) } });
      return await this.getMotoristaById(id);
    } catch (error) {
      throw new Error(`Erro ao restaurar motorista: ${error.message}`);
    }
  }

  async deleteMotorista(id) {
    const transaction = await db.sequelize.transaction();

    try {
      const motorista = await db.Motorista.findByPk(id);
      if (!motorista) {
        throw new Error('Motorista não encontrado');
      }

      const transportesCount = await db.Transporte.count({
        where: { motorista_id: id },
        transaction
      });

      if (transportesCount > 0) {
        throw new Error('Não é possível excluir motorista com transportes associados');
      }

      const coletasCount = await db.Coletas.count({
        where: { motorista_id: id },
        transaction
      });

      if (coletasCount > 0) {
        throw new Error('Não é possível excluir motorista com coletas associadas');
      }

      await db.Motorista.destroy({
        where: { id: Number(id) },
        transaction
      });

      await transaction.commit();
      return { success: true, message: 'Motorista excluído com sucesso' };
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw new Error(`Erro ao excluir motorista: ${error.message}`);
    }
  }

  async getHistoricoAtividades(motoristaId, periodo = '30dias') {
    try {
      const dataInicio = this.calcularDataInicio(periodo);
      
      const transportes = await db.Transporte.findAll({
        where: {
          motorista_id: motoristaId,
          data_criacao: {
            [Op.gte]: dataInicio
          }
        },
        attributes: ['id', 'numero_transporte', 'status_transporte', 'data_criacao', 'data_conclusao'],
        include: [
          {
            model: db.Hubs,
            as: 'hubOrigem',
            attributes: ['nome', 'cidade']
          },
          {
            model: db.Hubs,
            as: 'hubDestino',
            attributes: ['nome', 'cidade']
          }
        ],
        order: [['data_criacao', 'DESC']]
      });

      const coletas = await db.Coletas.findAll({
        where: {
          motorista_id: motoristaId,
          data_coleta: {
            [Op.gte]: dataInicio
          }
        },
        attributes: ['id', 'numero_coleta', 'status', 'data_coleta'],
        include: [
          {
            model: db.Clientes,
            as: 'cliente',
            attributes: ['nome']
          }
        ],
        order: [['data_coleta', 'DESC']]
      });

      return {
        transportes,
        coletas,
        periodo: {
          inicio: dataInicio,
          fim: new Date()
        }
      };
    } catch (error) {
      throw new Error(`Erro ao buscar histórico de atividades: ${error.message}`);
    }
  }

  calcularDataInicio(periodo) {
    const agora = new Date();
    switch (periodo) {
      case '7dias':
        return new Date(agora.setDate(agora.getDate() - 7));
      case '30dias':
        return new Date(agora.setDate(agora.getDate() - 30));
      case '3meses':
        return new Date(agora.setMonth(agora.getMonth() - 3));
      case '6meses':
        return new Date(agora.setMonth(agora.getMonth() - 6));
      case '1ano':
        return new Date(agora.setFullYear(agora.getFullYear() - 1));
      default:
        return new Date(agora.setDate(agora.getDate() - 30));
    }
  }
}

module.exports = MotoristasServices;