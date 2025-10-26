const Services = require('./Services');
const db = require('../models');
const { Op } = require('sequelize');

class RotaServices extends Services {
  constructor() {
    super('Rota');
  }

  async findRota(identifier) {
    try {
      const id = Number(identifier);
      
      if (!isNaN(id)) {
        return await db.Rota.findByPk(id, {
          include: [
            {
              model: db.Motorista,
              as: 'motorista',
              attributes: ['id', 'nome', 'veiculo', 'telefone']
            },
            {
              model: db.Parada,
              as: 'paradas',
              include: [
                {
                  model: db.Pedidos,
                  as: 'pedido',
                  attributes: ['id', 'codigo_pedido', 'status'],
                  include: [
                    {
                      model: db.Clientes,
                      as: 'cliente',
                      attributes: ['id', 'nome', 'telefone']
                    },
                    {
                      model: db.Endereco,
                      as: 'endereco',
                      attributes: ['id', 'logradouro', 'cidade', 'estado', 'cep']
                    }
                  ]
                }
              ],
              order: [['ordem_entrega', 'ASC']]
            },
            {
              model: db.Transporte,
              as: 'transporte',
              attributes: ['id', 'numero_transporte', 'status_transporte'],
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
                }
              ]
            }
          ]
        });
      } else {
        return await db.Rota.findOne({
          where: {
            cluster: {
              [Op.iLike]: `%${identifier}%`
            }
          },
          include: [
            {
              model: db.Motorista,
              as: 'motorista',
              attributes: ['id', 'nome', 'veiculo']
            },
            {
              model: db.Parada,
              as: 'paradas',
              attributes: ['id', 'ordem_entrega', 'status_parada'],
              order: [['ordem_entrega', 'ASC']]
            }
          ]
        });
      }
    } catch (error) {
      throw new Error(`Erro ao buscar rota: ${error.message}`);
    }
  }

  async getRotasDisponiveis() {
    try {
      return await db.Rota.findAll({
        where: {
          status_rota: ['CRIADA', 'EM_ANDAMENTO'],
          id: {
            [Op.notIn]: db.sequelize.literal(
              `(SELECT rota_id FROM Transporte WHERE rota_id IS NOT NULL)`
            )
          }
        },
        include: [
          { 
            model: db.Motorista, 
            as: 'motorista', 
            attributes: ['id', 'nome', 'veiculo'] 
          },
          {
            model: db.Parada,
            as: 'paradas',
            attributes: ['id'],
            required: false
          }
        ],
        attributes: [
          'id', 'cluster', 'status_rota', 'numero_paradas', 
          'distancia_total_km', 'data_criacao', 'data_finalizacao'
        ],
        order: [['data_criacao', 'DESC']]
      });
    } catch (error) {
      throw new Error(`Erro ao buscar rotas disponíveis: ${error.message}`);
    }
  }

  async getById(id) {
    try {
      return await db.Rota.findByPk(id, {
        include: [
          {
            model: db.Motorista,
            as: 'motorista',
            attributes: ['id', 'nome', 'veiculo', 'telefone', 'email']
          },
          {
            model: db.Parada,
            as: 'paradas',
            include: [
              {
                model: db.Pedidos,
                as: 'pedido',
                attributes: ['id', 'codigo_pedido', 'status', 'prioridade'],
                include: [
                  {
                    model: db.Clientes,
                    as: 'cliente',
                    attributes: ['id', 'nome', 'telefone', 'email']
                  },
                  {
                    model: db.Produtos,
                    as: 'produto',
                    attributes: ['id', 'nome', 'peso', 'dimensoes']
                  },
                  {
                    model: db.Endereco,
                    as: 'endereco',
                    attributes: ['id', 'logradouro', 'numero', 'bairro', 'cidade', 'estado', 'cep', 'complemento']
                  }
                ]
              }
            ],
            order: [['ordem_entrega', 'ASC']]
          },
          {
            model: db.Transporte,
            as: 'transporte',
            attributes: ['id', 'numero_transporte', 'tipo_transporte', 'status_transporte'],
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
              }
            ]
          }
        ]
      });
    } catch (error) {
      throw new Error(`Erro ao buscar rota por ID: ${error.message}`);
    }
  }

  async getParadasByRota(idRota) {
    try {
      return await db.Parada.findAll({
        where: { id_rota: idRota },
        include: [
          {
            model: db.Pedidos,
            as: 'pedido',
            include: [
              { 
                model: db.Clientes, 
                as: 'cliente',
                attributes: ['id', 'nome', 'telefone', 'email']
              },
              {
                model: db.Produtos,
                as: 'produto',
                attributes: ['id', 'nome', 'codigo']
              },
              {
                model: db.Endereco,
                as: 'endereco',
                attributes: ['id', 'logradouro', 'cidade', 'estado', 'cep']
              }
            ]
          }
        ],
        order: [['ordem_entrega', 'ASC']]
      });
    } catch (error) {
      throw new Error(`Erro ao buscar paradas da rota: ${error.message}`);
    }
  }

  async getPedidosDisponiveis(filters = {}) {
    try {
      const whereConditions = {
        status: 'VALIDADO',
        id: {
          [Op.notIn]: db.sequelize.literal(
            `(SELECT id_pedido FROM Parada WHERE id_rota IS NOT NULL)`
          )
        }
      };

      if (filters.cidade) {
        whereConditions['$endereco.cidade$'] = {
          [Op.iLike]: `%${filters.cidade}%`
        };
      }

      if (filters.cluster) {
        whereConditions['$endereco.bairro$'] = {
          [Op.iLike]: `%${filters.cluster}%`
        };
      }

      if (filters.prioridade) {
        whereConditions.prioridade = filters.prioridade;
      }

      return await db.Pedidos.findAll({
        where: whereConditions,
        include: [
          { 
            model: db.Clientes, 
            as: 'cliente', 
            attributes: ['id', 'nome', 'telefone'] 
          },
          { 
            model: db.Produtos, 
            as: 'produto', 
            attributes: ['id', 'nome', 'peso', 'volume'] 
          },
          { 
            model: db.Endereco, 
            as: 'endereco', 
            attributes: ['id', 'logradouro', 'bairro', 'cidade', 'estado', 'cep'] 
          }
        ],
        order: [
          ['prioridade', 'DESC'],
          ['createdAt', 'ASC']
        ]
      });
    } catch (error) {
      throw new Error(`Erro ao buscar pedidos disponíveis: ${error.message}`);
    }
  }

  async createRotaFromTransporte(transporteId, dadosRota) {
    const transaction = await db.sequelize.transaction();

    try {
      const transporte = await db.Transporte.findByPk(transporteId, {
        include: [
          {
            model: db.Pedidos,
            as: 'pedidos',
            where: { status: 'VALIDADO' },
            required: false,
            include: [
              {
                model: db.Endereco,
                as: 'endereco',
                attributes: ['cidade', 'bairro', 'logradouro']
              }
            ]
          }
        ],
        transaction
      });

      if (!transporte) {
        throw new Error('Transporte não encontrado');
      }

      if (transporte.rota_id) {
        throw new Error('Transporte já possui uma rota associada');
      }

      if (!transporte.pedidos || transporte.pedidos.length === 0) {
        throw new Error('Transporte não possui pedidos válidos para criar rota');
      }

      const rota = await db.Rota.create({
        id_motorista: dadosRota.id_motorista,
        cluster: dadosRota.cluster || await this.definirCluster(transporte.pedidos),
        numero_paradas: transporte.pedidos.length,
        distancia_total_km: dadosRota.distancia_total_km || await this.calcularDistanciaTotal(transporte.pedidos),
        status_rota: 'CRIADA',
        data_criacao: new Date(),
        observacoes: dadosRota.observacoes
      }, { transaction });

      let ordem = 1;
      for (const pedido of transporte.pedidos) {
        await db.Parada.create({
          id_rota: rota.id,
          id_pedido: pedido.id,
          ordem_entrega: ordem++,
          endereco_entrega: `${pedido.endereco.logradouro}, ${pedido.endereco.bairro} - ${pedido.endereco.cidade}`,
          status_parada: 'PENDENTE',
          tempo_estimado_minutos: await this.calcularTempoEstimado(ordem),
          observacoes: `Pedido ${pedido.codigo_pedido} - ${pedido.cliente.nome}`
        }, { transaction });

        await pedido.update({ status: 'EM_ROTA' }, { transaction });
      }

      await transporte.update({ rota_id: rota.id }, { transaction });

      await transaction.commit();
      return await this.getById(rota.id);
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw new Error(`Erro ao criar rota a partir do transporte: ${error.message}`);
    }
  }

  async adicionarParadasRota(rotaId, pedidosIds) {
    const transaction = await db.sequelize.transaction();

    try {
      const rota = await db.Rota.findByPk(rotaId, { transaction });
      if (!rota) {
        throw new Error('Rota não encontrada');
      }

      if (rota.status_rota !== 'CRIADA') {
        throw new Error('Só é possível adicionar paradas a rotas com status CRIADA');
      }

      const ultimaParada = await db.Parada.findOne({
        where: { id_rota: rotaId },
        order: [['ordem_entrega', 'DESC']],
        transaction
      });

      let ordem = ultimaParada ? ultimaParada.ordem_entrega + 1 : 1;

      for (const pedidoId of pedidosIds) {
        const pedido = await db.Pedidos.findByPk(pedidoId, {
          include: [
            {
              model: db.Endereco,
              as: 'endereco',
              attributes: ['logradouro', 'bairro', 'cidade']
            },
            {
              model: db.Clientes,
              as: 'cliente',
              attributes: ['nome']
            }
          ],
          transaction
        });

        if (!pedido) {
          throw new Error(`Pedido ${pedidoId} não encontrado`);
        }

        if (pedido.status !== 'VALIDADO') {
          throw new Error(`Pedido ${pedidoId} não está válido para entrega`);
        }

        await db.Parada.create({
          id_rota: rotaId,
          id_pedido: pedidoId,
          ordem_entrega: ordem++,
          endereco_entrega: `${pedido.endereco.logradouro}, ${pedido.endereco.bairro} - ${pedido.endereco.cidade}`,
          status_parada: 'PENDENTE',
          tempo_estimado_minutos: await this.calcularTempoEstimado(ordem),
          observacoes: `Pedido ${pedido.codigo_pedido} - ${pedido.cliente.nome}`
        }, { transaction });

        await pedido.update({ status: 'EM_ROTA' }, { transaction });
      }

      const totalParadas = await db.Parada.count({
        where: { id_rota: rotaId },
        transaction
      });

      await rota.update({ numero_paradas: totalParadas }, { transaction });

      await transaction.commit();
      return await this.getById(rotaId);
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw new Error(`Erro ao adicionar paradas à rota: ${error.message}`);
    }
  }

  async atualizarStatusRota(rotaId, novoStatus, dados = {}) {
    const transaction = await db.sequelize.transaction();

    try {
      const rota = await db.Rota.findByPk(rotaId, {
        include: [
          {
            model: db.Parada,
            as: 'paradas',
            attributes: ['id', 'status_parada']
          }
        ],
        transaction
      });

      if (!rota) {
        throw new Error('Rota não encontrada');
      }

      this.validarTransicaoStatus(rota.status_rota, novoStatus);

      const atualizacao = {
        status_rota: novoStatus
      };

      if (novoStatus === 'EM_ANDAMENTO' && !rota.data_inicio) {
        atualizacao.data_inicio = new Date();
      } else if (novoStatus === 'FINALIZADA') {
        atualizacao.data_finalizacao = new Date();
        
        const paradasPendentes = rota.paradas.filter(p => p.status_parada !== 'ENTREGUE');
        if (paradasPendentes.length > 0) {
          throw new Error('Não é possível finalizar rota com paradas pendentes');
        }
      } else if (novoStatus === 'CANCELADA') {
        atualizacao.data_cancelamento = new Date();
        atualizacao.motivo_cancelamento = dados.motivo_cancelamento;
      }

      await db.Rota.update(atualizacao, {
        where: { id: rotaId },
        transaction
      });

      if (novoStatus === 'CANCELADA') {
        await db.Pedidos.update(
          { status: 'PENDENTE' },
          {
            where: {
              id: {
                [Op.in]: rota.paradas.map(p => p.id_pedido).filter(id => id)
              }
            },
            transaction
          }
        );
      }

      await transaction.commit();
      return await this.getById(rotaId);
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw new Error(`Erro ao atualizar status da rota: ${error.message}`);
    }
  }

  async atualizarStatusParada(paradaId, novoStatus, observacoes = null) {
    const transaction = await db.sequelize.transaction();

    try {
      const parada = await db.Parada.findByPk(paradaId, {
        include: [
          {
            model: db.Rota,
            as: 'rota',
            attributes: ['id', 'status_rota']
          }
        ],
        transaction
      });

      if (!parada) {
        throw new Error('Parada não encontrada');
      }

      if (parada.rota.status_rota === 'FINALIZADA' || parada.rota.status_rota === 'CANCELADA') {
        throw new Error('Não é possível alterar paradas de rota finalizada ou cancelada');
      }

      const atualizacao = {
        status_parada: novoStatus
      };

      if (novoStatus === 'EM_ANDAMENTO' && !parada.data_chegada) {
        atualizacao.data_chegada = new Date();
      } else if (novoStatus === 'ENTREGUE') {
        atualizacao.data_saida = new Date();
        
        if (parada.id_pedido) {
          await db.Pedidos.update(
            { status: 'ENTREGUE' },
            {
              where: { id: parada.id_pedido },
              transaction
            }
          );
        }
      }

      if (observacoes) {
        atualizacao.observacoes = observacoes;
      }

      await db.Parada.update(atualizacao, {
        where: { id: paradaId },
        transaction
      });

      await transaction.commit();
      return await db.Parada.findByPk(paradaId, {
        include: [
          {
            model: db.Pedidos,
            as: 'pedido',
            attributes: ['id', 'codigo_pedido', 'status']
          }
        ]
      });
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw new Error(`Erro ao atualizar status da parada: ${error.message}`);
    }
  }

  async getEstatisticasRota(rotaId) {
    try {
      const rota = await db.Rota.findByPk(rotaId, {
        include: [
          {
            model: db.Parada,
            as: 'paradas',
            attributes: ['id', 'status_parada', 'tempo_estimado_minutos']
          }
        ]
      });

      if (!rota) {
        throw new Error('Rota não encontrada');
      }

      const estatisticas = {
        totalParadas: rota.paradas.length,
        paradasConcluidas: rota.paradas.filter(p => p.status_parada === 'ENTREGUE').length,
        paradasPendentes: rota.paradas.filter(p => p.status_parada === 'PENDENTE').length,
        paradasEmAndamento: rota.paradas.filter(p => p.status_parada === 'EM_ANDAMENTO').length,
        tempoTotalEstimado: rota.paradas.reduce((total, p) => total + (p.tempo_estimado_minutos || 0), 0),
        percentualConclusao: rota.paradas.length > 0 ? 
          (rota.paradas.filter(p => p.status_parada === 'ENTREGUE').length / rota.paradas.length) * 100 : 0
      };

      return {
        rota: {
          id: rota.id,
          cluster: rota.cluster,
          status: rota.status_rota
        },
        estatisticas
      };
    } catch (error) {
      throw new Error(`Erro ao buscar estatísticas da rota: ${error.message}`);
    }
  }

  async otimizarOrdemParadas(rotaId) {
    const transaction = await db.sequelize.transaction();

    try {
      const paradas = await db.Parada.findAll({
        where: { id_rota: rotaId },
        include: [
          {
            model: db.Pedidos,
            as: 'pedido',
            include: [
              {
                model: db.Endereco,
                as: 'endereco',
                attributes: ['bairro', 'cidade']
              }
            ]
          }
        ],
        order: [['ordem_entrega', 'ASC']],
        transaction
      });

      if (paradas.length === 0) {
        throw new Error('Rota não possui paradas para otimizar');
      }

      const paradasOtimizadas = this.aplicarAlgoritmoOtimizacao(paradas);

      for (let i = 0; i < paradasOtimizadas.length; i++) {
        await db.Parada.update(
          { ordem_entrega: i + 1 },
          {
            where: { id: paradasOtimizadas[i].id },
            transaction
          }
        );
      }

      const novaDistancia = await this.calcularDistanciaOtimizada(paradasOtimizadas);
      await db.Rota.update(
        { distancia_total_km: novaDistancia },
        {
          where: { id: rotaId },
          transaction
        }
      );

      await transaction.commit();
      return await this.getParadasByRota(rotaId);
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw new Error(`Erro ao otimizar ordem das paradas: ${error.message}`);
    }
  }

  validarTransicaoStatus(statusAtual, novoStatus) {
    const transicoesValidas = {
      'CRIADA': ['EM_ANDAMENTO', 'CANCELADA'],
      'EM_ANDAMENTO': ['FINALIZADA', 'CANCELADA'],
      'FINALIZADA': [],
      'CANCELADA': []
    };

    if (!transicoesValidas[statusAtual]?.includes(novoStatus)) {
      throw new Error(`Transição de status inválida: ${statusAtual} -> ${novoStatus}`);
    }
  }

  async definirCluster(pedidos) {
    if (!pedidos || pedidos.length === 0) return 'GERAL';
    
    const cidades = pedidos.map(p => p.endereco?.cidade).filter(Boolean);
    const cidadeMaisFrequente = cidades.reduce((a, b, i, arr) => 
      arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
    );
    
    return cidadeMaisFrequente || 'GERAL';
  }

  async calcularDistanciaTotal(pedidos) {
    return Math.max(pedidos.length * 5, 10); // Mínimo 10km
  }

  async calcularTempoEstimado(ordem) {
    return ordem * 15; // 15 minutos por parada
  }

  aplicarAlgoritmoOtimizacao(paradas) {
    return [...paradas].sort((a, b) => {
      const bairroA = a.pedido?.endereco?.bairro || '';
      const bairroB = b.pedido?.endereco?.bairro || '';
      return bairroA.localeCompare(bairroB) || a.ordem_entrega - b.ordem_entrega;
    });
  }

  async calcularDistanciaOtimizada(paradas) {
    return Math.max(paradas.length * 4, 8); // Distância ligeiramente menor após otimização
  }

  async createComParadas() {
    throw new Error('Rota agora só pode ser criada via TransporteServices');
  }

  async atualizarStatus() {
    throw new Error('Status de rota deve ser atualizado apenas via TransporteServices');
  }

  async getRotasDisponiveisParaTransportes() {
    return await this.getRotasDisponiveis();
  }
}

module.exports = RotaServices;