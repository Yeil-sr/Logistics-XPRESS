module.exports = (models) => {
  /**
   * ENTRADA (RECEBIMENTO)
   */

  // Hook para Recebimento concluído → cria Transporte + Conferência + vincula pedidos
  models.Recebimento.addHook('afterUpdate', async (recebimento, { transaction }) => {
    if (recebimento.status === 'CONCLUIDO' && !recebimento.data_conclusao) {
      try {
        await models.sequelize.transaction({ transaction }, async (t) => {
          // Atualiza data de conclusão
          recebimento.data_conclusao = new Date();
          await recebimento.save({ transaction: t });

          // Busca todos os pedidos vinculados ao recebimento
          const pedidos = await models.Pedidos.findAll({
            where: { recebimento_id: recebimento.id },
            transaction: t
          });

          // Verifica se há divergência entre quantidade esperada e recebida
          if (recebimento.quantidade_pedidos !== pedidos.length) {
            await criarExcecao({
              tipo: 'DIVERGENCIA',
              gravidade: 'ALTA',
              titulo: `Divergência na quantidade de pedidos - Recebimento ${recebimento.id}`,
              descricao: `Quantidade esperada: ${recebimento.quantidade_pedidos}, Quantidade recebida: ${pedidos.length}`,
              recebimento_id: recebimento.id,
              criador_id: recebimento.operador_id,
              data_ocorrencia: new Date(),
              impacto_financeiro: calcularImpactoDivergencia(recebimento.quantidade_pedidos, pedidos.length),
              models,
              transaction: t
            });
          }

          // Cria transporte relacionado
          const transporte = await models.Transporte.create({
            tipo_transporte: 'TO',
            numero_transporte: `TO${Date.now()}`,
            recebimento_id: recebimento.id,
            quantidade_total: pedidos.length, // Usa a quantidade real
            status_transporte: 'CRIADO',
            operador_id: recebimento.operador_id,
            direcao: 'INBOUND',
            data_criacao: new Date()
          }, { transaction: t });

          // Cria conferência para o transporte recém-criado
          const conferencia = await models.Conferencia.create({
            transferencia_id: transporte.id,
            tipo: 'INBOUND',
            status: 'PENDENTE',
            total_pedidos_esperados: pedidos.length,
            operador_id: recebimento.operador_id,
            data_inicio: new Date()
          }, { transaction: t });

          // Atualiza transporte com conferência_id
          transporte.conferencia_id = conferencia.id;
          await transporte.save({ transaction: t });

          // Atualiza pedidos com transferencia_id
          await models.Pedidos.update(
            { transferencia_id: transporte.id },
            { 
              where: { recebimento_id: recebimento.id },
              transaction: t 
            }
          );

          // Cria registro de rastreamento para cada pedido
          for (const pedido of pedidos) {
            await models.Rastreamento.create({
              pedido_id: pedido.id,
              status_atual: 'RECEIVED',
              data_status: new Date(),
              localizacao: 'Hub origem'
            }, { transaction: t });
          }

          console.log(`Conferência ${conferencia.id} criada para transporte ${transporte.id}`);
        });
      } catch (error) {
        console.error('Erro no hook de recebimento:', error);
        throw error;
      }
    }
  });

  /**
   * PROCESSAMENTO INTERNO
   */

  // Hook para Conferência inbound concluída
  models.Conferencia.addHook('afterUpdate', async (conferencia, { transaction }) => {
    if (conferencia.status === 'CONCLUIDO' && conferencia.transferencia_id && conferencia.tipo === 'INBOUND') {
      try {
        await models.sequelize.transaction({ transaction }, async (t) => {
          const transporte = await models.Transporte.findByPk(
            conferencia.transferencia_id,
            { transaction: t }
          );

          if (transporte) {
            // Verifica divergência na conferência
            const pedidosTransporte = await models.Pedidos.count({
              where: { transferencia_id: transporte.id },
              transaction: t
            });

            if (conferencia.total_pedidos_finais !== pedidosTransporte) {
              await criarExcecao({
                tipo: 'DIVERGENCIA',
                gravidade: 'MEDIA',
                titulo: `Divergência na conferência - Transporte ${transporte.numero_transporte}`,
                descricao: `Quantidade esperada: ${conferencia.total_pedidos_finais}, Quantidade conferida: ${pedidosTransporte}`,
                transporte_id: transporte.id,
                recebimento_id: transporte.recebimento_id,
                criador_id: conferencia.operador_id,
                data_ocorrencia: new Date(),
                models,
                transaction: t
              });
            }

            // Atualiza status do transporte
            transporte.status_transporte = 'RECEBIDO';
            transporte.data_conclusao = new Date();
            await transporte.save({ transaction: t });

            // Atualiza pedidos e estoque
            const pedidos = await models.Pedidos.findAll({
              where: { transferencia_id: transporte.id },
              transaction: t
            });

            for (const pedido of pedidos) {
              // Verifica avarias antes de armazenar
              const possuiAvaria = await verificarAvariaPedido(pedido.id, t);
              if (possuiAvaria) {
                await criarExcecao({
                  tipo: 'AVARIA',
                  gravidade: 'ALTA',
                  titulo: `Produto avariado - Pedido ${pedido.codigo_pedido}`,
                  descricao: `Produto identificado com avaria durante a conferência`,
                  pedido_id: pedido.id,
                  transporte_id: transporte.id,
                  criador_id: conferencia.operador_id,
                  data_ocorrencia: new Date(),
                  impacto_financeiro: await calcularValorPedido(pedido.id, t),
                  models,
                  transaction: t
                });
              }

              // Atualiza status do pedido
              await pedido.update(
                { status: 'EM_ESTOQUE', conferencia_id: conferencia.id },
                { transaction: t }
              );

              // Cria registro de estoque
              await models.Estoque.create({
                id_produto: pedido.produto_id,
                id_pedido: pedido.id,
                quantidade: 1,
                localizacao: 'Hub destino',
                data_entrada: new Date()
              }, { transaction: t });

              // Atualiza rastreamento
              await models.Rastreamento.create({
                pedido_id: pedido.id,
                status_atual: 'STOCKED',
                data_status: new Date(),
                localizacao: 'Estoque'
              }, { transaction: t });
            }
          }
        });
      } catch (error) {
        console.error('Erro no hook de conferência inbound:', error);
        throw error;
      }
    }
  });

  /**
   * SAÍDA (EXPEDIÇÃO)
   */

  // Hook para Separação concluída
  models.Separacao.addHook('afterUpdate', async (separacao, { transaction }) => {
    if (separacao.status === 'SEPARADO') {
      try {
        await models.sequelize.transaction({ transaction }, async (t) => {
          const pedido = await models.Pedidos.findByPk(
            separacao.id_pedido,
            { transaction: t }
          );

          if (pedido) {
            const emEstoque = await models.Estoque.findOne({
              where: { id_pedido: pedido.id, quantidade: { [models.Sequelize.Op.gt]: 0 } },
              transaction: t
            });

            if (!emEstoque) {
              await criarExcecao({
                tipo: 'BACKLOG',
                gravidade: 'ALTA',
                titulo: `Pedido não encontrado em estoque - ${pedido.codigo_pedido}`,
                descricao: `Pedido marcado como separado mas não encontrado no estoque`,
                pedido_id: pedido.id,
                criador_id: separacao.operador_id,
                data_ocorrencia: new Date(),
                impacto_financeiro: await calcularValorPedido(pedido.id, t),
                models,
                transaction: t
              });
            }

            await pedido.update(
              { status: 'AGUARDANDO_EXPEDICAO' },
              { transaction: t }
            );

            await models.Rastreamento.create({
              pedido_id: pedido.id,
              status_atual: 'READY_FOR_SHIPPING',
              data_status: new Date(),
              localizacao: 'Área de expedição'
            }, { transaction: t });
          }
        });
      } catch (error) {
        console.error('Erro no hook de separação:', error);
        throw error;
      }
    }
  });

  // Hook para Conferência outbound concluída → cria Rota + Transporte
  models.Conferencia.addHook('afterUpdate', async (conferencia, { transaction }) => {
    if (conferencia.status === 'CONCLUIDO' && conferencia.transferencia_id && conferencia.tipo === 'OUTBOUND') {
      try {
        await models.sequelize.transaction({ transaction }, async (t) => {
          const transporte = await models.Transporte.findByPk(
            conferencia.transferencia_id,
            { 
              include: [models.Motorista],
              transaction: t 
            }
          );

          if (transporte) {
            if (!transporte.Motorista) {
              await criarExcecao({
                tipo: 'NOSHOW',
                gravidade: 'ALTA',
                titulo: `Transporte sem motorista - ${transporte.numero_transporte}`,
                descricao: `Transporte pronto para expedição mas sem motorista atribuído`,
                transporte_id: transporte.id,
                criador_id: conferencia.operador_id,
                data_ocorrencia: new Date(),
                impacto_financeiro: calcularImpactoAtrasoTransporte(),
                models,
                transaction: t
              });
            }

            if (transporte.Motorista) {
              const rota = await models.Rota.create({
                id_motorista: transporte.motorista_id,
                cluster: 'A DEFINIR',
                status_rota: 'CRIADA',
                data_criacao: new Date()
              }, { transaction: t });

              transporte.rota_id = rota.id;
              transporte.status_transporte = 'EM_TRANSPORTE';
              await transporte.save({ transaction: t });

              // Atualiza pedidos e cria paradas
              const pedidos = await models.Pedidos.findAll({
                where: { transferencia_id: transporte.id },
                transaction: t
              });

              let ordem = 1;
              for (const pedido of pedidos) {
                await pedido.update(
                  { status: 'EM_ROTA' },
                  { transaction: t }
                );

                await models.Rastreamento.create({
                  pedido_id: pedido.id,
                  status_atual: 'EM_ROTA',
                  data_status: new Date(),
                  localizacao: 'Em transporte'
                }, { transaction: t });

                // Cria parada na rota
                await models.Parada.create({
                  id_rota: rota.id,
                  id_pedido: pedido.id,
                  ordem_entrega: ordem++,
                  status_parada: 'PENDENTE'
                }, { transaction: t });
              }

              // Atualiza número de paradas na rota
              await rota.update(
                { numero_paradas: ordem - 1 },
                { transaction: t }
              );
            }
          }
        });
      } catch (error) {
        console.error('Erro no hook de conferência outbound:', error);
        throw error;
      }
    }
  });

  // Hook para Coleta realizada
  models.Coleta.addHook('afterUpdate', async (coleta, { transaction }) => {
    if (coleta.status === 'REALIZADA') {
      try {
        await models.sequelize.transaction({ transaction }, async (t) => {
          const pedido = await models.Pedidos.findByPk(
            coleta.id_pedido,
            { transaction: t }
          );

          if (pedido) {
            // Verifica atraso na coleta
            const agora = new Date();
            const diferencaHoras = (agora - new Date(coleta.agendamento)) / (1000 * 60 * 60);
            
            if (diferencaHoras > 2) { // Mais de 2 horas de atraso
              await criarExcecao({
                tipo: 'ATRASO',
                gravidade: 'MEDIA',
                titulo: `Coleta com atraso - Pedido ${pedido.codigo_pedido}`,
                descricao: `Coleta realizada com ${diferencaHoras.toFixed(1)} horas de atraso`,
                pedido_id: pedido.id,
                criador_id: coleta.id_motorista,
                data_ocorrencia: new Date(),
                models,
                transaction: t
              });
            }

            await pedido.update(
              { status: 'EM_TRANSITO' },
              { transaction: t }
            );

            await models.Rastreamento.create({
              pedido_id: pedido.id,
              status_atual: 'EM_TRANSITO',
              data_status: new Date(),
              localizacao: 'Em trânsito para hub'
            }, { transaction: t });
          }
        });
      } catch (error) {
        console.error('Erro no hook de coleta:', error);
        throw error;
      }
    }
  });

  // Hook para Rota finalizada
  models.Rota.addHook('afterUpdate', async (rota, { transaction }) => {
    if (rota.status_rota === 'FINALIZADA') {
      try {
        await models.sequelize.transaction({ transaction }, async (t) => {
          const transporte = await models.Transporte.findOne({
            where: { rota_id: rota.id },
            transaction: t
          });

          if (transporte) {
            // Verifica entregas não realizadas
            const paradasPendentes = await models.Parada.count({
              where: { 
                id_rota: rota.id,
                status_parada: 'PENDENTE'
              },
              transaction: t
            });

            if (paradasPendentes > 0) {
              await criarExcecao({
                tipo: 'PARCEL',
                gravidade: 'ALTA',
                titulo: `Entregas pendentes - Rota ${rota.id}`,
                descricao: `${paradasPendentes} entregas não realizadas na rota finalizada`,
                transporte_id: transporte.id,
                criador_id: rota.id_motorista,
                data_ocorrencia: new Date(),
                impacto_financeiro: paradasPendentes * 50, // Custo estimado por entrega não realizada
                models,
                transaction: t
              });
            }

            // Atualiza transporte
            transporte.status_transporte = 'ENTREGUE';
            transporte.data_conclusao = new Date();
            await transporte.save({ transaction: t });

            // Atualiza pedidos e paradas
            const pedidos = await models.Pedidos.findAll({
              where: { transferencia_id: transporte.id },
              transaction: t
            });

            for (const pedido of pedidos) {
              // Atualiza pedido
              await pedido.update(
                { status: 'ENTREGUE' },
                { transaction: t }
              );

              // Cria registro de expedição
              await models.Expediacao.create({
                id_pedido: pedido.id,
                nota_fiscal: `NF${Date.now()}`,
                codigo_rastreamento: `TRACK${Date.now()}`,
                data_envio: new Date()
              }, { transaction: t });

              // Atualiza rastreamento
              await models.Rastreamento.create({
                pedido_id: pedido.id,
                status_atual: 'DELIVERED',
                data_status: new Date(),
                localizacao: 'Entregue ao cliente'
              }, { transaction: t });

              // Atualiza parada correspondente
              await models.Parada.update(
                { status_parada: 'ENTREGUE' },
                { 
                  where: { 
                    id_pedido: pedido.id,
                    id_rota: rota.id 
                  },
                  transaction: t 
                }
              );
            }
          }
        });
      } catch (error) {
        console.error('Erro no hook de rota:', error);
        throw error;
      }
    }
  });

  // Hook para Pedido com status de exceção
  models.Pedidos.addHook('afterUpdate', async (pedido, { transaction }) => {
    if (pedido.changed('status') && pedido.status === 'EXCECAO') {
      try {
        await models.sequelize.transaction({ transaction }, async (t) => {
          await criarExcecao({
            tipo: 'OUTROS',
            gravidade: 'MEDIA',
            titulo: `Pedido com status de exceção - ${pedido.codigo_pedido}`,
            descricao: `Pedido marcado manualmente com status de exceção`,
            pedido_id: pedido.id,
            criador_id: 1, // Sistema
            data_ocorrencia: new Date(),
            impacto_financeiro: await calcularValorPedido(pedido.id, t),
            models,
            transaction: t
          });
        });
      } catch (error) {
        console.error('Erro no hook de pedido com exceção:', error);
      }
    }
  });

  // Hook para Transporte cancelado
  models.Transporte.addHook('afterUpdate', async (transporte, { transaction }) => {
    if (transporte.changed('status_transporte') && transporte.status_transporte === 'CANCELADO') {
      try {
        await models.sequelize.transaction({ transaction }, async (t) => {
          await criarExcecao({
            tipo: 'EXTRAVIADO',
            gravidade: 'CRITICA',
            titulo: `Transporte cancelado - ${transporte.numero_transporte}`,
            descricao: `Transporte cancelado durante o processo`,
            transporte_id: transporte.id,
            criador_id: 1, // Sistema
            data_ocorrencia: new Date(),
            impacto_financeiro: await calcularValorTransporte(transporte.id, t),
            models,
            transaction: t
          });
        });
      } catch (error) {
        console.error('Erro no hook de transporte cancelado:', error);
      }
    }
  });

  // ===== FUNÇÕES AUXILIARES =====

  async function criarExcecao({ tipo, gravidade, titulo, descricao, pedido_id, transporte_id, recebimento_id, criador_id, data_ocorrencia, impacto_financeiro = 0, models, transaction }) {
    try {
      const excecao = await models.Excecao.create({
        tipo,
        gravidade,
        titulo,
        descricao,
        pedido_id,
        transporte_id,
        recebimento_id,
        criador_id,
        data_ocorrencia,
        impacto_financeiro,
        status: 'ABERTA'
      }, { transaction });

      // Adiciona ao histórico
      const historico = [{
        timestamp: new Date(),
        acao: 'CRIACAO',
        descricao: 'Exceção criada automaticamente pelo sistema',
        usuario_id: criador_id
      }];

      await excecao.update({ historico }, { transaction });
      
      return excecao;
    } catch (error) {
      console.error('Erro ao criar exceção:', error);
      throw error;
    }
  }

  function calcularImpactoDivergencia(esperado, recebido) {
    const diferenca = Math.abs(esperado - recebido);
    return diferenca * 100; // Custo estimado de R$ 100 por item divergente
  }

  function calcularImpactoAtrasoTransporte() {
    return 500; // Custo fixo de R$ 500 por atraso
  }

  async function verificarAvariaPedido(pedidoId, transaction) {
    // Simulação - em produção, isso viria de uma inspeção real
    return Math.random() < 0.05; // 5% de chance de avaria
  }

  async function calcularValorPedido(pedidoId, transaction) {
    // Simulação - em produção, buscaria o valor real do pedido
    return 150; // Valor médio de R$ 150 por pedido
  }

  async function calcularValorTransporte(transporteId, transaction) {
    // Simulação - em produção, calcularia baseado nos pedidos
    const pedidosCount = await models.Pedidos.count({
      where: { transferencia_id: transporteId },
      transaction
    });
    return pedidosCount * 50; // Custo médio de R$ 50 por pedido no transporte
  }
};