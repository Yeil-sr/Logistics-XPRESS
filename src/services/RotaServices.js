const Services = require('./Services');
const db = require('../models');
const { Op } = require('sequelize');

class RotaServices extends Services {
  constructor() {
    super('Rotas');
  }

  async findRota(identifier) {
    try {
      const id = Number(identifier);

      if (!isNaN(id)) {
        return await db.Rotas.findByPk(id, {
          include: [
            {
              model: db.Motoristas,
              attributes: ['id', 'nome', 'veiculo', 'telefone']
            },
            {
              model: db.Paradas,
              as: 'paradas',
              include: [
                {
                  model: db.Pedidos,
                  include: [
                    {
                      model: db.Clientes,
                      as: 'clientes',
                      attributes: ['id', 'nome', 'telefone']
                    },
                    {
                      model: db.Enderecos,
                      as: 'enderecos',
                      attributes: ['id', 'cidade', 'estado', 'cep']
                    }
                  ],
                  attributes: ['id', 'codigo_pedido', 'status']
                }
              ],
              order: [['ordem_entrega', 'ASC']]
            },
            {
              model: db.Transportes,
              as: 'transportes',
              attributes: ['id', 'numero_transporte', 'status_transporte'],
              include: [
                {
                  model: db.Hubs,
                  as: 'hubOrigem',
                  attributes: ['id', 'nome'],
                  include: [
                    {
                      model: db.Enderecos,
                      attributes: ['cidade', 'estado']
                    }
                  ]
                },
                {
                  model: db.Hubs,
                  as: 'hubDestino',
                  attributes: ['id', 'nome'],
                  include: [
                    {
                      model: db.Enderecos,
                      attributes: ['cidade', 'estado']
                    }
                  ]
                }
              ]
            }
          ]
        });
      } else {
        return await db.Rotas.findOne({
          where: {
            cluster: {
              [Op.iLike]: `%${identifier}%`
            }
          },
          include: [
            {
              model: db.Motoristas,
              attributes: ['id', 'nome', 'veiculo']
            },
            {
              model: db.Paradas,
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
      return await db.Rotas.findAll({
        where: {
          status_rota: ['CRIADA', 'EM_ANDAMENTO'],
          id: {
            [Op.notIn]: db.sequelize.literal(
              `(SELECT rota_id FROM Transportes WHERE rota_id IS NOT NULL)`
            )
          }
        },
        include: [
          {
            model: db.Motoristas,
            attributes: ['id', 'nome', 'veiculo']
          },
          {
            model: db.Paradas,
            as: 'paradas',
            attributes: ['id'],
            required: false
          }
        ],
        attributes: [
          'id', 'cluster', 'status_rota', 'numero_paradas',
          'distancia_total_km', 'createdAt', 'updatedAt'
        ],
        order: [['createdAt', 'DESC']]
      });
    } catch (error) {
      throw new Error(`Erro ao buscar rotas disponíveis: ${error.message}`);
    }
  }

  async getById(id) {
    try {
      return await db.Rotas.findByPk(id, {
        include: [
          {
            model: db.Motoristas,
            attributes: ['id', 'nome', 'veiculo', 'telefone']
          },
          {
            model: db.Paradas,
            as: 'paradas',
            include: [
              {
                model: db.Pedidos,
                attributes: ['id', 'codigo_pedido', 'status'],
                include: [
                  {
                    model: db.Clientes,
                    as: 'clientes',
                    attributes: ['id', 'nome', 'telefone', 'email']
                  },
                  {
                    model: db.Produtos,
                    as: 'produtos',
                    attributes: ['id', 'nome', 'peso_kg', 'tipo_entrega']
                  },
                  {
                    model: db.Enderecos,
                    as: 'enderecos',
                    attributes: ['id', 'rua', 'numero', 'bairro', 'cidade', 'estado', 'cep', 'complemento']
                  }
                ]
              }
            ],
            order: [['ordem_entrega', 'ASC']]
          },
          {
            model: db.Transportes,
            as: 'transportes',
            attributes: ['id', 'numero_transporte', 'tipo_transporte', 'status_transporte'],
            include: [
              {
                model: db.Hubs,
                as: 'hubOrigem',
                attributes: ['id', 'nome'],
                include: [
                  {
                    model: db.Enderecos,
                    attributes: ['cidade', 'estado']
                  }
                ]
              },
              {
                model: db.Hubs,
                as: 'hubDestino',
                attributes: ['id', 'nome'],
                include: [
                  {
                    model: db.Enderecos,
                    attributes: ['cidade', 'estado']
                  }
                ]
              }
            ]
          }
        ]
      });
    } catch (error) {
      throw new Error(`Erro ao buscar rota por ID: ${error.message}`);
    }
  }

  async getParadasByRota(rotaId) {
    try {
      return await db.Paradas.findAll({
        where: { rota_id: rotaId },
        include: [
          {
            model: db.Pedidos,
            include: [
              {
                model: db.Clientes,
                as: 'clientes',
                attributes: ['id', 'nome', 'telefone', 'email']
              },
              {
                model: db.Produtos,
                as: 'produtos',
                attributes: ['id', 'nome']
              },
              {
                model: db.Enderecos,
                as: 'enderecos',
                attributes: ['id', 'rua', 'bairro', 'cidade', 'estado', 'cep']
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
            `(SELECT pedido_id FROM Paradas WHERE rota_id IS NOT NULL)`
          )
        }
      };

      if (filters.cidade) {
        whereConditions['$enderecos.cidade$'] = {
          [Op.iLike]: `%${filters.cidade}%`
        };
      }

      if (filters.cluster) {
        whereConditions['$enderecos.bairro$'] = {
          [Op.iLike]: `%${filters.cluster}%`
        };
      }

      return await db.Pedidos.findAll({
        where: whereConditions,
        include: [
          {
            model: db.Clientes,
            as: 'clientes',
            attributes: ['id', 'nome', 'telefone']
          },
          {
            model: db.Produtos,
            as: 'produtos',
            attributes: ['id', 'nome', 'peso_kg', 'volume']
          },
          {
            model: db.Enderecos,
            as: 'enderecos',
            attributes: ['id', 'rua', 'bairro', 'cidade', 'estado', 'cep']
          }
        ],
        order: [['createdAt', 'ASC']]
      });
    } catch (error) {
      throw new Error(`Erro ao buscar pedidos disponíveis: ${error.message}`);
    }
  }

  async createRotaFromTransporte(transporteId, dadosRota) {
    const transaction = await db.sequelize.transaction();

    try {
      const transporte = await db.Transportes.findByPk(transporteId, {
        include: [
          {
            model: db.Pedidos,
            as: 'pedidos',
            where: { status: 'VALIDADO' },
            required: false,
            include: [
              {
                model: db.Enderecos,
                as: 'enderecos',
                attributes: ['rua', 'bairro', 'cidade', 'cep']
              },
              {
                model: db.Clientes,
                as: 'clientes',
                attributes: ['nome']
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

      const rota = await db.Rotas.create({
        motorista_id: dadosRota.motorista_id,
        cluster: dadosRota.cluster || await this.definirCluster(transporte.pedidos),
        numero_paradas: transporte.pedidos.length,
        distancia_total_km: dadosRota.distancia_total_km || await this.calcularDistanciaTotal(transporte.pedidos),
        status_rota: 'CRIADA'
      }, { transaction });

      let ordem = 1;
      for (const pedido of transporte.pedidos) {
        await db.Paradas.create({
          rota_id: rota.id,
          pedido_id: pedido.id,
          ordem_entrega: ordem,
          gaiola_codigo: dadosRota.gaiola_codigo || `GAI${ordem}`,
          status_parada: 'PENDENTE'
        }, { transaction });

        await pedido.update({ status: 'EM_ROTA' }, { transaction });
        ordem++;
      }

      await transporte.update({ rota_id: rota.id }, { transaction });

      await transaction.commit();
      return await this.getById(rota.id);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Erro ao criar rota a partir do transporte: ${error.message}`);
    }
  }

  async adicionarParadasRota(rotaId, pedidosIds) {
    const transaction = await db.sequelize.transaction();

    try {
      const rota = await db.Rotas.findByPk(rotaId, { transaction });
      if (!rota) {
        throw new Error('Rota não encontrada');
      }

      if (rota.status_rota !== 'CRIADA') {
        throw new Error('Só é possível adicionar paradas a rotas com status CRIADA');
      }

      const ultimaParada = await db.Paradas.findOne({
        where: { rota_id: rotaId },
        order: [['ordem_entrega', 'DESC']],
        transaction
      });

      let ordem = ultimaParada ? ultimaParada.ordem_entrega + 1 : 1;

      for (const pedidoId of pedidosIds) {
        const pedido = await db.Pedidos.findByPk(pedidoId, {
          include: [
            {
              model: db.Enderecos,
              as: 'enderecos',
              attributes: ['rua', 'bairro', 'cidade', 'cep']
            },
            {
              model: db.Clientes,
              as: 'clientes',
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

        await db.Paradas.create({
          rota_id: rotaId,
          pedido_id: pedidoId,
          ordem_entrega: ordem,
          gaiola_codigo: `GAI${ordem}`,
          status_parada: 'PENDENTE'
        }, { transaction });

        await pedido.update({ status: 'EM_ROTA' }, { transaction });
        ordem++;
      }

      const totalParadas = await db.Paradas.count({
        where: { rota_id: rotaId },
        transaction
      });

      await rota.update({ numero_paradas: totalParadas }, { transaction });

      await transaction.commit();
      return await this.getById(rotaId);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Erro ao adicionar paradas à rota: ${error.message}`);
    }
  }

  async atualizarStatusRota(rotaId, novoStatus, dados = {}) {
    const transaction = await db.sequelize.transaction();

    try {
      const rota = await db.Rotas.findByPk(rotaId, {
        include: [
          {
            model: db.Paradas,
            as: 'paradas',
            attributes: ['id', 'status_parada', 'pedido_id']
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

      await db.Rotas.update(atualizacao, {
        where: { id: rotaId },
        transaction
      });

      if (novoStatus === 'CANCELADA') {
        const pedidoIds = rota.paradas.map(p => p.pedido_id).filter(id => id);
        if (pedidoIds.length > 0) {
          await db.Pedidos.update(
            { status: 'VALIDADO' },
            {
              where: { id: pedidoIds },
              transaction
            }
          );
        }
      }

      await transaction.commit();
      return await this.getById(rotaId);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Erro ao atualizar status da rota: ${error.message}`);
    }
  }

  async atualizarStatusParada(paradaId, novoStatus, observacoes = null) {
    const transaction = await db.sequelize.transaction();

    try {
      const parada = await db.Paradas.findByPk(paradaId, {
        include: [
          {
            model: db.Rotas,
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

      if (observacoes) {
        atualizacao.observacoes = observacoes;
      }

      if (novoStatus === 'ENTREGUE' && parada.pedido_id) {
        await db.Pedidos.update(
          { status: 'ENTREGUE' },
          {
            where: { id: parada.pedido_id },
            transaction
          }
        );
      }

      await db.Paradas.update(atualizacao, {
        where: { id: paradaId },
        transaction
      });

      await transaction.commit();
      return await db.Paradas.findByPk(paradaId, {
        include: [
          {
            model: db.Pedidos,
            attributes: ['id', 'codigo_pedido', 'status']
          }
        ]
      });
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Erro ao atualizar status da parada: ${error.message}`);
    }
  }

async getRotasDisponiveisParaTransportes() {
    try {
      // Reaproveita a lógica de getRotasDisponiveis, mas retornando os campos mais
      // enxutos/úteis para associação com Transportes.
      return await db.Rotas.findAll({
        where: {
          status_rota: ['CRIADA', 'EM_ANDAMENTO'],
          id: {
            [Op.notIn]: db.sequelize.literal(
              `(SELECT rota_id FROM Transportes WHERE rota_id IS NOT NULL)`
            )
          }
        },
        include: [
          {
            model: db.Motoristas,
            attributes: ['id', 'nome']
          }
        ],
        attributes: ['id', 'cluster', 'numero_paradas', 'distancia_total_km', 'createdAt'],
        order: [['createdAt', 'DESC']]
      });
    } catch (error) {
      throw new Error(`Erro ao buscar rotas disponíveis para transportes: ${error.message}`);
    }
  }
  
  async getEstatisticasRota(rotaId) {
    try {
      const rota = await db.Rotas.findByPk(rotaId, {
        include: [
          {
            model: db.Paradas,
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
        paradasEmAndamento: rota.paradas.filter(p => p.status_parada === 'EM_ENTREGA').length,
        paradasComFalha: rota.paradas.filter(p => p.status_parada === 'FALHA').length,
        percentualConclusao: rota.paradas.length > 0 ?
          (rota.paradas.filter(p => p.status_parada === 'ENTREGUE').length / rota.paradas.length) * 100 : 0
      };

      return {
        rota: {
          id: rota.id,
          cluster: rota.cluster,
          status: rota.status_rota,
          numero_paradas: rota.numero_paradas,
          distancia_total_km: rota.distancia_total_km
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
      const paradas = await db.Paradas.findAll({
        where: { rota_id: rotaId },
        include: [
          {
            model: db.Pedidos,
            include: [
              {
                model: db.Enderecos,
                as: 'enderecos',
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
        await db.Paradas.update(
          { ordem_entrega: i + 1 },
          {
            where: { id: paradasOtimizadas[i].id },
            transaction
          }
        );
      }

      const novaDistancia = await this.calcularDistanciaOtimizada(paradasOtimizadas);
      await db.Rotas.update(
        { distancia_total_km: novaDistancia },
        {
          where: { id: rotaId },
          transaction
        }
      );

      await transaction.commit();
      return await this.getParadasByRota(rotaId);
    } catch (error) {
      await transaction.rollback();
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

    const cidades = pedidos.map(p => {
      return p.enderecos?.[0]?.cidade || p.endereco?.cidade;
    }).filter(Boolean);

    const cidadeMaisFrequente = cidades.reduce((a, b, i, arr) =>
      arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
    , null);

    return cidadeMaisFrequente || 'GERAL';
  }

  async calcularDistanciaTotal(pedidos) {
    return Math.max(pedidos.length * 5, 10);
  }

  async calcularTempoEstimado(ordem) {
    return ordem * 15;
  }

  aplicarAlgoritmoOtimizacao(paradas) {
    return [...paradas].sort((a, b) => {
      const bairroA = a.Pedido?.Endereco?.bairro || a.pedido?.endereco?.bairro || a.pedido?.enderecos?.[0]?.bairro || '';
      const bairroB = b.Pedido?.Endereco?.bairro || b.pedido?.endereco?.bairro || b.pedido?.enderecos?.[0]?.bairro || '';
      return bairroA.localeCompare(bairroB) || (a.ordem_entrega - b.ordem_entrega);
    });
  }

  async calcularDistanciaOtimizada(paradas) {
    return Math.max(paradas.length * 4, 8);
  }
}

module.exports = RotaServices;