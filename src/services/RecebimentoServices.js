'use strict';

const Services = require('./Services');
const db = require('../models');
const { Op } = require('sequelize');

/**
 * Serviço responsável pela gestão de recebimentos.
 * Inclui criação completa com pedidos, manifestos, transportes e conferência,
 * com tratamento robusto de transações e logs detalhados.
 *
 * CORREÇÕES APLICADAS (fev/2026):
 * - total_AT_TO → total_at_to (alinhamento com schema da conferência)
 * - Removidos campos inexistentes do model Recebimentos: peso_kg, direcao, tipo_recebedor, valor_total, quantidade_notas
 * - Removida atualização e logs de campos inexistentes no recebimento
 * - Conferência agora utiliza campos corretos: data_criacao, data_termino, total_pedidos_iniciais, total_at_to
 * - Adicionado campo obrigatório 'tipo' na criação da conferência (baseado em recebimento.tipo_tarefa)
 * - Mapeamento de tipo_tarefa 'RETORNO' para 'OUTBOUND' na conferência
 * - [FIX] Substituído status 'RECEBIDO' por 'ENTREGUE' na conclusão do recebimento (status válido)
 */
class RecebimentoServices extends Services {
  constructor() {
    super('Recebimentos');
    this.PedidosServices = require('./PedidosServices');
    this.HubsServices = require('./HubsServices');
    this.EstoquesServices = require('./EstoquesServices');
    this.NotasFiscaisServices = require('./NotasFiscaisServices');
    this.ManifestosServices = require('./ManifestosServices');
  }

  // ------------------------------------------------------------------------
  //  VALIDAÇÃO DE TRANSAÇÃO
  // ------------------------------------------------------------------------
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
  //  FILTRO DE ATRIBUTOS PARA CONFERÊNCIA (ALINHAMENTO COM O SCHEMA)
  // ------------------------------------------------------------------------
  _filterConferenciaAttributes(payload) {
    const modelAttributes = Object.keys(db.Conferencias.rawAttributes);
    const filtered = {};
    for (const key of Object.keys(payload)) {
      if (modelAttributes.includes(key)) {
        filtered[key] = payload[key];
      } else {
        console.warn(
          `[Conferencia][FILTER] Atributo '${key}' ignorado – não existe no modelo Conferencias.`
        );
      }
    }
    return filtered;
  }

  // ------------------------------------------------------------------------
  //  UTILITÁRIOS DE CÁLCULO
  // ------------------------------------------------------------------------
  calcularImpactoDivergencia(totalEsperado, totalConferido) {
    const diferenca = Math.abs(totalEsperado - totalConferido);
    const custoPorDivergencia = 100;
    return diferenca * custoPorDivergencia;
  }

  // ------------------------------------------------------------------------
  //  CONSULTAS BÁSICAS
  // ------------------------------------------------------------------------
  async getById(id) {
    try {
      return await db.Recebimentos.findByPk(id, {
        include: [
          { model: db.Usuarios, attributes: ['nome'] },
          { model: db.Pedidos, as: 'pedidos' },
          { model: db.Conferencias, as: 'conferencias' },
          { model: db.Transportes, as: 'transportes' },
          { model: db.Manifestos, as: 'manifestos' },
        ],
      });
    } catch (error) {
      console.error(`[Recebimento] ERRO getById(${id}):`, error.stack);
      throw new Error(`Erro ao buscar recebimento: ${error.message}`);
    }
  }

  // ------------------------------------------------------------------------
  //  NORMALIZAÇÃO E GARANTIA DE PRODUTOS
  // ------------------------------------------------------------------------
  async _normalizeAndEnsureProdutos(itens, transaction, createMissing = true, transactionId = '') {
    const itensNormalizados = [];
    const prefix = transactionId ? `[Recebimento][${transactionId}]` : '[Recebimento]';

    for (const item of itens) {
      try {
        await this._checkTransaction(transaction, 'normalização de produto');

        let produto_id = item.produto_id;
        let produtoCriado = false;

        if (!produto_id && item.produto && item.produto.nome) {
          const nomeTratado = String(item.produto.nome).trim();

          // Apenas campos que existem no modelo Produtos (categoria foi removido)
          const produtoDefaults = {
            nome: nomeTratado,
            descricao: item.produto.descricao || `Produto ${nomeTratado}`,
            preco: item.produto.preco || 0,
            peso_kg: item.produto.peso_kg || 0,
            s_n: item.produto.s_n || '',
            p_n: item.produto.p_n || '',
            mac: item.produto.mac || '',
          };

          const [produto] = await db.Produtos.findOrCreate({
            where: { nome: nomeTratado },
            defaults: produtoDefaults,
            transaction,
          });

          produto_id = produto.id;
          produtoCriado = produto._options?.isNewRecord || false;
          console.debug(
            `${prefix} Produto criado/encontrado: ${produto.id} - ${produto.nome}`
          );
        }

        if (!produto_id && !createMissing) {
          throw new Error(
            `Nenhum produto_id válido encontrado para item: ${JSON.stringify(item)}`
          );
        }

        if (!produto_id) {
          throw new Error(
            `Não foi possível obter/gerar produto para item: ${JSON.stringify(item)}`
          );
        }

        itensNormalizados.push({
          produto_id: Number(produto_id),
          quantidade: Math.max(1, Number(item.quantidade || 1)),
          valor_unitario: Number(item.valor_unitario || 0),
          descricao: item.descricao || item.produto?.descricao || '',
        });
      } catch (error) {
        console.error(`${prefix} Erro ao normalizar produto:`, error.stack);
        throw new Error(`Falha ao processar produto: ${error.message}`);
      }
    }

    return itensNormalizados;
  }

  // ------------------------------------------------------------------------
  //  GARANTIA DE CLIENTE E ENDEREÇO
  // ------------------------------------------------------------------------
  async _ensureClienteAndEndereco(meta, transaction, transactionId = '') {
    const prefix = transactionId ? `[Recebimento][${transactionId}]` : '[Recebimento]';
    let cliente_id = meta.cliente_id;
    let endereco_id = meta.endereco_id;

    try {
      await this._checkTransaction(transaction, 'garantia cliente/endereco');

      // --- Cliente ---
      if (meta.cliente && !cliente_id) {
        const whereCliente = {};

        if (meta.cliente.cpf) whereCliente.cpf = meta.cliente.cpf;
        else if (meta.cliente.email) whereCliente.email = meta.cliente.email;
        else if (meta.cliente.nome) whereCliente.nome = meta.cliente.nome;

        if (Object.keys(whereCliente).length > 0) {
          const clienteDefaults = {
            nome: meta.cliente.nome,
            email: meta.cliente.email || '',
            telefone: meta.cliente.telefone || '',
            cpf: meta.cliente.cpf || '',
            tipo: meta.cliente.tipo || 'FISICA',
          };

          const [cliente] = await db.Clientes.findOrCreate({
            where: whereCliente,
            defaults: clienteDefaults,
            transaction,
          });
          cliente_id = cliente.id;
          console.debug(
            `${prefix} Cliente criado/encontrado: ${cliente.id} - ${cliente.nome}`
          );
        }
      }

      // --- Endereço ---
      if (meta.endereco && cliente_id && !endereco_id) {
        const whereEndereco = {
          cliente_id: cliente_id,
        };

        if (meta.endereco.cep) whereEndereco.cep = meta.endereco.cep;

        const enderecoDefaults = {
          cliente_id: cliente_id,
          cep: meta.endereco.cep || '',
          rua: meta.endereco.rua || '',
          numero: meta.endereco.numero || '',
          complemento: meta.endereco.complemento || '',
          bairro: meta.endereco.bairro || '',
          cidade: meta.endereco.cidade || '',
          estado: meta.endereco.estado || '',
          pais: meta.endereco.pais || 'Brasil',
          tipo: meta.endereco.tipo || 'RESIDENCIAL',
        };

        const [endereco] = await db.Enderecos.findOrCreate({
          where: whereEndereco,
          defaults: enderecoDefaults,
          transaction,
        });
        endereco_id = endereco.id;
        console.debug(
          `${prefix} Endereço criado/encontrado: ${endereco.id} - ${endereco.cep}`
        );
      }

      return { cliente_id, endereco_id };
    } catch (error) {
      console.error(`${prefix} Erro ao garantir cliente/endereço:`, error.stack);
      throw new Error(`Falha ao processar cliente/endereço: ${error.message}`);
    }
  }

  // ------------------------------------------------------------------------
  //  CONVERSÃO DE FORMATO LEGADO
  // ------------------------------------------------------------------------
  _convertLegacyFormat(dados) {
    const {
      pedidosCodigos = [],
      pedidosItens = {},
      pedidosMeta = {},
      createMissingPedidos = true,
    } = dados;
    const pedidosDados = [];

    for (const codigo of pedidosCodigos) {
      const itens = pedidosItens[codigo] || [];
      const meta = pedidosMeta[codigo] || {};

      if (itens.length === 0) {
        console.warn(
          `[Recebimento] Código ${codigo} listado em pedidosCodigos sem entradas em pedidosItens`
        );
      }

      pedidosDados.push({
        codigo,
        itens,
        meta,
        createMissingPedidos,
      });
    }

    return { ...dados, pedidosDados };
  }

  // ------------------------------------------------------------------------
  //  EXTRAÇÃO DE DADOS DE TRANSPORTE
  // ------------------------------------------------------------------------
  _extrairDadosTransporte(recebimento) {
    let dadosTransporte = null;

    if (recebimento?.recebimento?.transporte) {
      dadosTransporte = recebimento.recebimento.transporte;
      console.debug(
        '[Recebimento] Dados de transporte encontrados em recebimento.recebimento.transporte'
      );
    } else if (recebimento?.transporte) {
      dadosTransporte = recebimento.transporte;
      console.debug(
        '[Recebimento] Dados de transporte encontrados em recebimento.transporte'
      );
    }

    if (dadosTransporte) {
      const dadosNormalizados = {
        transportador_nome: dadosTransporte.transportador_nome
          ? String(dadosTransporte.transportador_nome)
          : null,
        cnpj_transportador: dadosTransporte.cnpj_transportador
          ? String(dadosTransporte.cnpj_transportador)
          : null,
        endereco_transportador: dadosTransporte.endereco_transportador
          ? String(dadosTransporte.endereco_transportador)
          : null,
        placa_veiculo: dadosTransporte.placa_veiculo
          ? String(dadosTransporte.placa_veiculo)
          : null,
        uf_veiculo: dadosTransporte.uf_veiculo ? String(dadosTransporte.uf_veiculo) : null,
        frete_por_conta: dadosTransporte.frete_por_conta
          ? String(dadosTransporte.frete_por_conta)
          : null,
        quantidade_volume: dadosTransporte.quantidade_volume
          ? Number(dadosTransporte.quantidade_volume)
          : null,
        especie_volumes: dadosTransporte.especie_volumes
          ? String(dadosTransporte.especie_volumes)
          : null,
        marca_volumes: dadosTransporte.marca_volumes
          ? String(dadosTransporte.marca_volumes)
          : null,
        numero_volumes: dadosTransporte.numero_volumes
          ? String(dadosTransporte.numero_volumes)
          : null,
        peso_bruto: dadosTransporte.peso_bruto ? parseFloat(dadosTransporte.peso_bruto) : null,
        peso_liquido: dadosTransporte.peso_liquido
          ? parseFloat(dadosTransporte.peso_liquido)
          : null,
        informacoes_transporte: dadosTransporte.informacoes_transporte
          ? String(dadosTransporte.informacoes_transporte)
          : null,
      };

      console.debug(
        '[Recebimento] Dados de transporte extraídos e normalizados:',
        dadosNormalizados
      );
      return dadosNormalizados;
    }

    console.debug('[Recebimento] Nenhum dado de transporte encontrado');
    return null;
  }

  // ------------------------------------------------------------------------
  //  CRIAÇÃO / BUSCA DE NOTA FISCAL
  // ------------------------------------------------------------------------
  async _createOrFindNota(notaData, pedidoId, transaction, operador_id, transactionId = '') {
    const notasFiscaisService = new this.NotasFiscaisServices();
    const prefix = transactionId ? `[Recebimento][${transactionId}]` : '[Recebimento]';

    try {
      await this._checkTransaction(transaction, 'criar/buscar nota');

      let notaExistente = null;

      if (notaData.id) {
        notaExistente = await notasFiscaisService.getById(notaData.id, { transaction });
      } else if (notaData.chave_nfe) {
        notaExistente = await db.NotasFiscais.findOne({
          where: { chave_nfe: notaData.chave_nfe },
          transaction,
        });
      } else if (notaData.numero && pedidoId) {
        notaExistente = await db.NotasFiscais.findOne({
          where: {
            numero: notaData.numero,
            pedido_id: pedidoId,
          },
          transaction,
        });
      }

      if (notaExistente) {
        console.debug(`${prefix} Nota encontrada: ${notaExistente.id}`);
        return notaExistente;
      }

      const notaPayload = {
        pedido_id: pedidoId,
        numero:
          notaData.numero ||
          `NF-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        serie: notaData.serie || '1',
        chave_nfe: notaData.chave_nfe || null,
        data_emissao: notaData.data_emissao || new Date(),
        valor_total: 0,
        tipo: notaData.tipo || 'NF-e',
        manifesto_id: notaData.manifesto_id || null,
        itens: [],
      };

      if (notaData.itens && notaData.itens.length > 0) {
        const itensNormalizados = await this._normalizeAndEnsureProdutos(
          notaData.itens,
          transaction,
          true,
          transactionId
        );

        notaPayload.itens = itensNormalizados;
        notaPayload.valor_total = itensNormalizados.reduce(
          (total, item) => total + item.quantidade * item.valor_unitario,
          0
        );
      }

      console.debug(`${prefix} Criando nova nota: ${notaPayload.numero}`);
      const novaNota = await notasFiscaisService.createNotaComItens(notaPayload, {
        transaction,
      });
      return novaNota;
    } catch (error) {
      console.error(`${prefix} Erro ao criar/buscar nota:`, error.stack);
      throw new Error(`Falha ao processar nota fiscal: ${error.message}`);
    }
  }

  // ------------------------------------------------------------------------
  //  NORMALIZAÇÃO DE MANIFESTOS (ACEITA ARRAY, OBJETO, STRING)
  // ------------------------------------------------------------------------
  _normalizeManifestosInput(manifestosInput) {
    if (!manifestosInput) return [];
    if (Array.isArray(manifestosInput)) return manifestosInput;
    if (typeof manifestosInput === 'object') return [manifestosInput];
    if (typeof manifestosInput === 'string')
      return [{ numero_manifesto: manifestosInput }];
    return [];
  }

  // ------------------------------------------------------------------------
  //  PROCESSAMENTO DE NOTAS DE MANIFESTOS
  //  COM VERIFICAÇÃO DE TRANSAÇÃO E LOGS DETALHADOS
  // ------------------------------------------------------------------------
  async _processarNotasManifestos(manifestosData, recebimentoId, transaction, operador_id, transactionId = '') {
    const manifestosProcessados = [];
    const prefix = transactionId ? `[Recebimento][${transactionId}]` : '[Recebimento]';

    console.debug(
      `${prefix} Processando notas para ${manifestosData.length} manifestos`
    );

    for (const manifestoData of manifestosData) {
      const notasProcessadas = [];

      if (manifestoData.notas && Array.isArray(manifestoData.notas)) {
        for (const notaData of manifestoData.notas) {
          try {
            await this._checkTransaction(transaction, `processamento nota do manifesto ${manifestoData.numero_manifesto}`);

            console.debug(
              `${prefix} Processando nota direta do manifesto: ${notaData.numero || 'sem número'}`
            );

            const notaPayload = {
              numero: notaData.numero || `NF-${Date.now()}`,
              serie: notaData.serie || '1',
              data_emissao: notaData.data_emissao || new Date(),
              valor_total: 0,
              tipo: 'NF-e',
              manifesto_id: null, // será atualizado após criação do manifesto
              itens: [],
            };

            if (notaData.itens?.length) {
              const itensNormalizados = await this._normalizeAndEnsureProdutos(
                notaData.itens,
                transaction,
                true,
                transactionId
              );
              notaPayload.itens = itensNormalizados;
              notaPayload.valor_total = itensNormalizados.reduce(
                (total, item) => total + item.quantidade * item.valor_unitario,
                0
              );
              console.debug(
                `${prefix} Nota com ${itensNormalizados.length} itens, valor: ${notaPayload.valor_total}`
              );
            } else {
              console.warn(
                `${prefix} Nota ${notaData.numero} sem itens, será ignorada`
              );
              continue;
            }

            notasProcessadas.push({
              ...notaPayload,
              _originalData: notaData,
            });
          } catch (error) {
            console.error(`${prefix} Erro ao processar nota do manifesto:`, error.stack);
            throw new Error(`Falha no processamento da nota: ${error.message}`);
          }
        }
      }

      manifestosProcessados.push({
        ...manifestoData,
        notas: notasProcessadas,
        _notasCount: notasProcessadas.length,
      });
    }

    return manifestosProcessados;
  }

  // ------------------------------------------------------------------------
  //  CRIAÇÃO DE NOTAS PARA MANIFESTO (APÓS CRIAÇÃO DO MANIFESTO)
  // ------------------------------------------------------------------------
  async _criarNotasParaManifesto(manifestoId, notasData, transaction, operador_id, transactionId = '') {
    const notasFiscaisService = new this.NotasFiscaisServices();
    const notasCriadas = [];
    const prefix = transactionId ? `[Manifesto][${transactionId}]` : '[Manifesto]';

    console.debug(
      `${prefix} Criando ${notasData.length} notas para manifesto ${manifestoId}`
    );

    for (const notaData of notasData) {
      try {
        await this._checkTransaction(transaction, `criação nota manifesto ${manifestoId}`);

        const notaPayload = {
          ...notaData,
          manifesto_id: manifestoId,
          pedido_id: null, // notas de manifesto não têm pedido
        };

        console.debug(
          `${prefix} Criando nota ${notaPayload.numero} para manifesto ${manifestoId}`
        );

        const notaCriada = await notasFiscaisService.createNotaComItens(notaPayload, {
          transaction,
        });
        notasCriadas.push(notaCriada);

        console.debug(
          `${prefix} Nota criada: ${notaCriada.id} - ${notaCriada.numero}`
        );
      } catch (error) {
        console.error(
          `${prefix} Erro ao criar nota para manifesto ${manifestoId}:`,
          error.stack
        );
        throw new Error(`Falha ao criar nota do manifesto: ${error.message}`);
      }
    }

    return notasCriadas;
  }

  // ------------------------------------------------------------------------
  //  CRIAÇÃO DE TRANSPORTE PARA RECEBIMENTO
  // ------------------------------------------------------------------------
  async _criarTransporteParaRecebimento(dadosTransporte, recebimento, operador_id, transaction, transactionId = '') {
    const prefix = transactionId ? `[Transporte][${transactionId}]` : '[Transporte]';

    try {
      await this._checkTransaction(transaction, 'criação de transporte');

      console.debug(`${prefix} Criando transporte para recebimento ${recebimento.id}`);

      const transporteValidAttrs = [
        'tipo_transporte', 'numero_transporte', 'recebimento_id', 'quantidade_total',
        'peso_total_kg', 'volumetria_total', 'status_transporte', 'operador_id', 'direcao',
        'data_criacao', 'nome_transportador', 'cnpj_transportador', 'endereco_transportador',
        'placa_veiculo', 'uf_veiculo', 'frete_por_conta', 'quantidade_volume', 'especie_volumes',
        'marca_volumes', 'numero_volumes', 'peso_bruto', 'peso_liquido', 'informacoes_transporte',
      ];

      const payloadData = {
        tipo_transporte: 'TO',
        numero_transporte: dadosTransporte.numero_transporte || `TO-${Date.now()}`,
        recebimento_id: recebimento.id,
        quantidade_total: 0,
        peso_total_kg: dadosTransporte.peso_bruto || null,
        volumetria_total: dadosTransporte.quantidade_volume || null,
        status_transporte: 'CRIADO',
        operador_id: operador_id,
        direcao: recebimento.tipo_tarefa === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND',
        data_criacao: new Date(),
        nome_transportador: dadosTransporte.transportador_nome,
        cnpj_transportador: dadosTransporte.cnpj_transportador,
        endereco_transportador: dadosTransporte.endereco_transportador,
        placa_veiculo: dadosTransporte.placa_veiculo,
        uf_veiculo: dadosTransporte.uf_veiculo,
        frete_por_conta: dadosTransporte.frete_por_conta,
        quantidade_volume: dadosTransporte.quantidade_volume,
        especie_volumes: dadosTransporte.especie_volumes,
        marca_volumes: dadosTransporte.marca_volumes,
        numero_volumes: dadosTransporte.numero_volumes,
        peso_bruto: dadosTransporte.peso_bruto,
        peso_liquido: dadosTransporte.peso_liquido,
        informacoes_transporte: dadosTransporte.informacoes_transporte,
      };

      const transportePayload = {};
      transporteValidAttrs.forEach((key) => {
        if (payloadData[key] !== undefined) {
          transportePayload[key] = payloadData[key];
        }
      });

      const transporte = await db.Transportes.create(transportePayload, { transaction });
      console.debug(`${prefix} Transporte criado: ${transporte.id}`);
      return transporte;
    } catch (error) {
      console.error(`${prefix} Erro ao criar transporte:`, error.stack);
      throw new Error(`Falha ao criar transporte: ${error.message}`);
    }
  }

  // ------------------------------------------------------------------------
  //  CRIAÇÃO DE CONFERÊNCIA PARA RECEBIMENTO (CORRIGIDO)
  //  - Filtra atributos que realmente existem no modelo
  //  - Mapeia tipo_tarefa para 'INBOUND'/'OUTBOUND'
  //  - Adiciona total_at_to: 0 (evita NOT NULL)
  //  - Log detalhado de erro
  // ------------------------------------------------------------------------
  async _criarConferenciaParaRecebimento(
    recebimento,
    transporte,
    manifesto,
    pedidosCount,
    operador_id,
    transaction,
    transactionId = ''
  ) {
    const prefix = transactionId ? `[Conferencia][${transactionId}]` : '[Conferencia]';

    try {
      await this._checkTransaction(transaction, 'criação de conferência');

      console.debug(`${prefix} Criando conferência para recebimento ${recebimento.id}`);

      // Mapeia tipo_tarefa para valores válidos no ENUM da conferência
      let tipoConferencia = recebimento.tipo_tarefa;
      if (tipoConferencia === 'RETORNO') tipoConferencia = 'OUTBOUND';

      const payloadData = {
        transporte_id: transporte ? transporte.id : null,
        manifesto_id: manifesto ? manifesto.id : null,
        recebimento_id: recebimento.id,
        operador_id: operador_id,
        total_pedidos_iniciais: pedidosCount,
        total_pedidos_finais: pedidosCount,
        total_at_to: 0,                       // ← CAMPO CORRIGIDO (era total_AT_TO)
        nome_estacao: recebimento.localizacao || 'RECEBIMENTO',
        status: 'PENDENTE',
        data_criacao: new Date(),
        data_termino: null,
        percentual_validacao: 0,
        pedidos_escaneados: 0,
        tipo: tipoConferencia,
      };

      // Filtra apenas atributos existentes no modelo
      const conferenciaPayload = this._filterConferenciaAttributes(payloadData);

      const conferencia = await db.Conferencias.create(conferenciaPayload, { transaction });
      console.debug(`${prefix} Conferência criada: ${conferencia.id}`);

      // Atualiza o recebimento com a conferência (se o campo existir no modelo)
      if (recebimento.conferencia_id !== undefined) {
        await recebimento.update({ conferencia_id: conferencia.id }, { transaction });
      }

      return conferencia;
    } catch (error) {
      console.error(`${prefix} Erro ao criar conferência:`);
      console.error(`${prefix} Mensagem: ${error.message}`);
      if (error.parent) {
        console.error(`${prefix} Erro original (PG):`, error.parent.message);
        console.error(`${prefix} SQL:`, error.parent.sql || error.sql);
        console.error(`${prefix} Código:`, error.parent.code);
        console.error(`${prefix} Detalhe:`, error.parent.detail);
        console.error(`${prefix} Coluna:`, error.parent.column);
      }
      console.error(error.stack);
      throw new Error(
        `Falha ao criar conferência: ${error.message}${error.parent ? ' - ' + error.parent.message : ''}`
      );
    }
  }

  // ------------------------------------------------------------------------
  //  MÉTODO PRINCIPAL - CRIA RECEBIMENTO COMPLETO
  //  CORRIGIDO: campos inválidos removidos, conversão numérica no valorTotal
  // ------------------------------------------------------------------------
  async createWithPedidos(dados, options = {}) {
    const externalTx = options.transaction;
    const transaction = externalTx || (await db.sequelize.transaction());
    const createdHere = !externalTx;
    const transactionId = transaction.id || `tx-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const prefix = `[Recebimento][${transactionId}]`;

    try {
      console.debug(`${prefix} ========== INÍCIO DA CRIAÇÃO ==========`);
      console.debug(`${prefix} Operador ID: ${dados.operador_id || dados.usuario_id}`);
      console.debug(`${prefix} Tipo tarefa: ${dados.tipo_tarefa}`);

      const operador_id = dados.operador_id || dados.usuario_id || options.usuario_id || process.env.SYSTEM_USER_ID || 1;

      // Converter formato legado se necessário
      let dadosProcessados = { ...dados };
      if (dados.pedidosCodigos && !dados.pedidosDados) {
        console.debug(`${prefix} Convertendo formato herdado para formato montado`);
        dadosProcessados = this._convertLegacyFormat(dados);
      }

      const { pedidosDados = [], ...dadosRecebimento } = dadosProcessados;
      const createMissingPedidos = dadosProcessados.createMissingPedidos !== false;
      console.debug(`${prefix} Processando ${pedidosDados.length} pedidos`);

      // --------------------------------------------------------------------
      // 1. Hubs (origem/destino)
      // --------------------------------------------------------------------
      await this._checkTransaction(transaction, 'hubs');
      let origemHub = null;
      let destinoHub = null;
      const hubsService = new this.HubsServices();
      const origemNome = dadosProcessados.origem_hub_nome || dadosRecebimento.origem_hub_nome || null;
      const destinoNome = dadosProcessados.destino_hub_nome || dadosRecebimento.destino_hub_nome || null;

      if (origemNome) {
        console.debug(`${prefix} Localizando/criando hub origem: ${origemNome}`);
        try {
          origemHub = await hubsService.createHubAuto(origemNome);
          console.debug(`${prefix} Hub origem definido: ${origemHub?.id} - ${origemHub?.nome}`);
        } catch (err) {
          console.error(`${prefix} Erro ao criar/buscar hub origem:`, err.stack);
          throw new Error(`Falha no hub de origem: ${err.message}`);
        }
      }

      if (destinoNome) {
        console.debug(`${prefix} Localizando/criando hub destino: ${destinoNome}`);
        try {
          destinoHub = await hubsService.createHubAuto(destinoNome);
          console.debug(`${prefix} Hub destino definido: ${destinoHub?.id} - ${destinoHub?.nome}`);
        } catch (err) {
          console.error(`${prefix} Erro ao criar/buscar hub destino:`, err.stack);
          throw new Error(`Falha no hub de destino: ${err.message}`);
        }
      }

      // --------------------------------------------------------------------
      // 2. Criação do Recebimento (somente campos existentes)
      // --------------------------------------------------------------------
      await this._checkTransaction(transaction, 'criação do recebimento');

      const recebimentoValidAttrs = [
        'numero_manifesto', 'numero_recebimento', 'numero_romaneio', 'operador_id', 'status',
        'data_criacao', 'quantidade_pedidos', 'origem_hub_id', 'destino_hub_id', 'localizacao',
        'observacoes', 'tipo_tarefa', 'metodo_recebimento', 'serie', 'data_emissao',
      ];

      const recebimentoPayload = {};
      const recebimentoData = {
        ...dadosRecebimento,
        operador_id,
        status: 'PENDENTE',
        data_criacao: new Date(),
        quantidade_pedidos: 0,
        origem_hub_id: dadosRecebimento.origem_hub_id || origemHub?.id || null,
        destino_hub_id: dadosRecebimento.destino_hub_id || destinoHub?.id || null,
        // Campos que NÃO existem no schema foram completamente removidos:
        // peso_kg, direcao, tipo_recebedor, valor_total, quantidade_notas
      };

      recebimentoValidAttrs.forEach((key) => {
        if (recebimentoData[key] !== undefined) {
          recebimentoPayload[key] = recebimentoData[key];
        }
      });

      const novoRecebimento = await db.Recebimentos.create(recebimentoPayload, { transaction });
      console.debug(`${prefix} Recebimento criado: ${novoRecebimento.id}`);

      // --------------------------------------------------------------------
      // 3. Processamento de Manifestos
      // --------------------------------------------------------------------
      await this._checkTransaction(transaction, 'processamento de manifestos');
      let manifestosCriados = [];
      const manifestosPayloadArray = this._normalizeManifestosInput(
        dadosProcessados.manifestos || dadosProcessados.manifestosCriados || dadosProcessados.manifestosCriadosResultado || []
      );

      if (manifestosPayloadArray.length > 0) {
        console.debug(`${prefix} Processando ${manifestosPayloadArray.length} manifestos do payload`);
        const manifestosProcessados = await this._processarNotasManifestos(
          manifestosPayloadArray,
          novoRecebimento.id,
          transaction,
          operador_id,
          transactionId
        );

        for (const manifestoData of manifestosProcessados) {
          await this._checkTransaction(transaction, `criação do manifesto ${manifestoData.numero_manifesto}`);

          console.debug(`${prefix} Criando manifesto: ${manifestoData.numero_manifesto} com ${manifestoData._notasCount || 0} notas`);

          // Hubs específicos do manifesto (se informados)
          let manifestoOrigemHub = origemHub;
          let manifestoDestinoHub = destinoHub;

          if (manifestoData.origem_hub_nome && manifestoData.origem_hub_nome !== origemNome) {
            console.debug(`${prefix} Localizando hub origem específico do manifesto: ${manifestoData.origem_hub_nome}`);
            try {
              manifestoOrigemHub = await hubsService.createHubAuto(manifestoData.origem_hub_nome);
            } catch (err) {
              console.error(`${prefix} Erro ao criar hub origem do manifesto:`, err.stack);
              throw new Error(`Falha no hub origem do manifesto: ${err.message}`);
            }
          }

          if (manifestoData.destino_hub_nome && manifestoData.destino_hub_nome !== destinoNome) {
            console.debug(`${prefix} Localizando hub destino específico do manifesto: ${manifestoData.destino_hub_nome}`);
            try {
              manifestoDestinoHub = await hubsService.createHubAuto(manifestoData.destino_hub_nome);
            } catch (err) {
              console.error(`${prefix} Erro ao criar hub destino do manifesto:`, err.stack);
              throw new Error(`Falha no hub destino do manifesto: ${err.message}`);
            }
          }

          const { notas, _notasCount, ...dadosManifesto } = manifestoData;
          const manifestoPayload = {
            ...dadosManifesto,
            recebimento_id: novoRecebimento.id,
            origem_hub_id: manifestoData.origem_hub_id || manifestoOrigemHub?.id || null,
            destino_hub_id: manifestoData.destino_hub_id || manifestoDestinoHub?.id || null,
            valor_total: 0,
            quantidade_notas: 0,
          };

          let manifesto;
          try {
            manifesto = await db.Manifestos.create(manifestoPayload, { transaction });
            console.debug(`${prefix} Manifesto criado: ${manifesto.id} com origem: ${manifestoPayload.origem_hub_id}, destino: ${manifestoPayload.destino_hub_id}`);
          } catch (err) {
            console.error(`${prefix} Erro ao criar manifesto ${manifestoData.numero_manifesto}:`, err.stack);
            throw new Error(`Falha na criação do manifesto: ${err.message}`);
          }

          if (notas && notas.length > 0) {
            const notasCriadas = await this._criarNotasParaManifesto(
              manifesto.id,
              notas,
              transaction,
              operador_id,
              transactionId
            );

            const valorTotal = notasCriadas.reduce((total, nota) => {
              const valor = parseFloat(nota.valor_total) || 0;
              return total + valor;
            }, 0);

            await manifesto.update(
              {
                valor_total: valorTotal,
                quantidade_notas: notasCriadas.length,
              },
              { transaction }
            );
            console.debug(`${prefix} Manifesto ${manifesto.id} atualizado: ${notasCriadas.length} notas, R$ ${valorTotal.toFixed(2)}`);
          }

          manifestosCriados.push(manifesto);
        }
      }

      // --------------------------------------------------------------------
      // 4. Criação de Transporte
      // --------------------------------------------------------------------
      await this._checkTransaction(transaction, 'criação de transporte');
      let transporte = null;
      const dadosTransporte = this._extrairDadosTransporte(dadosProcessados);
      if (dadosTransporte) {
        console.debug(`${prefix} Criando transporte a partir dos dados do payload`);
        transporte = await this._criarTransporteParaRecebimento(
          dadosTransporte,
          novoRecebimento,
          operador_id,
          transaction,
          transactionId
        );
      }

      // --------------------------------------------------------------------
      // 5. Criação de Conferência (CORRIGIDO)
      // --------------------------------------------------------------------
      await this._checkTransaction(transaction, 'criação de conferência');
      const conferencia = await this._criarConferenciaParaRecebimento(
        novoRecebimento,
        transporte,
        manifestosCriados.length > 0 ? manifestosCriados[0] : null,
        pedidosDados.length,
        operador_id,
        transaction,
        transactionId
      );
      console.debug(`${prefix} Conferência criada: ${conferencia.id}`);

      // --------------------------------------------------------------------
      // 6. Processamento de Pedidos
      // --------------------------------------------------------------------
      await this._checkTransaction(transaction, 'processamento de pedidos');
      const pedidosCriados = [];
      const pedidosServices = new this.PedidosServices();
      const estoquesService = new this.EstoquesServices();
      const hubParaEntrada =
        novoRecebimento.destino_hub_id ||
        novoRecebimento.origem_hub_id ||
        destinoHub?.id ||
        origemHub?.id ||
        null;
      let totalNotasRecebimento = 0;    // apenas para contagem
      let valorTotalRecebimento = 0;    // apenas para cálculo (não salvo)

      for (const pedidoDados of pedidosDados) {
        await this._checkTransaction(transaction, `criação do pedido ${pedidoDados.codigo}`);

        try {
          const { codigo, itens = [], meta = {}, ...outrosDadosPedido } = pedidoDados;
          console.debug(`${prefix} Processando pedido código: ${codigo}`);

          // Normaliza itens (cria produtos se necessário)
          const itensNormalizados = await this._normalizeAndEnsureProdutos(
            itens,
            transaction,
            createMissingPedidos,
            transactionId
          );

          // Garante cliente e endereço
          const { cliente_id, endereco_id } = await this._ensureClienteAndEndereco(meta, transaction, transactionId);

          const valorPedido = itensNormalizados.reduce(
            (total, item) => total + item.quantidade * item.valor_unitario,
            0
          );
          valorTotalRecebimento += valorPedido;

          // Processa notas do pedido (se houver)
          let notasProcessadas = [];
          if (meta.notas && Array.isArray(meta.notas)) {
            console.debug(`${prefix} Processando ${meta.notas.length} notas do pedido ${codigo}`);
            for (const notaData of meta.notas) {
              let manifesto_id = null;
              if (meta.manifesto_numero) {
                const manifestoPorNumero = manifestosCriados.find(
                  (m) => m.numero_manifesto === meta.manifesto_numero
                );
                if (manifestoPorNumero) manifesto_id = manifestoPorNumero.id;
              }

              const itensNota = (notaData.itens || []).map((item) => ({
                produto: {
                  nome: item.produto?.nome || '',
                  descricao: item.produto?.descricao || null,
                  s_n: item.produto?.s_n || null,
                  p_n: item.produto?.p_n || null,
                  preco: parseFloat(item.produto?.preco) || 0,
                  peso_kg: parseFloat(item.produto?.peso_kg) || 0,
                },
                quantidade: parseInt(item.quantidade) || 1,
                valor_unitario: parseFloat(item.valor_unitario) || 0,
                descricao: item.descricao || null,
              }));

              notasProcessadas.push({
                ...notaData,
                itens: itensNota,
                manifesto_id: manifesto_id,
              });
            }
          }

          // Prepara dados para criação do pedido
          const pedidoParaCriar = {
            codigo_pedido: codigo,
            itens: itensNormalizados,
            cliente_id,
            endereco_id,
            recebimento_id: novoRecebimento.id,
            conferencia_id: conferencia.id,
            status: 'AGUARDANDO_CONFERENCIA',
            manifesto_id: meta.manifesto_numero
              ? manifestosCriados.find((m) => m.numero_manifesto === meta.manifesto_numero)?.id || null
              : null,
            transporte_id: transporte ? transporte.id : null,
            gerarNota: meta.gerarNota !== false,
            valor_total: valorPedido,
            meta: {
              ...meta,
              notas: notasProcessadas,
            },
            ...outrosDadosPedido,
          };

          console.debug(`${prefix} Criando pedido ${codigo} com conferencia_id: ${conferencia.id}`);
          const resultadoPedido = await pedidosServices.createPedidoComItensENota(pedidoParaCriar, {
            transaction,
            usuario_id: operador_id,
          });

          // Extrai ID do pedido (pode vir em diferentes formatos)
          let pedidoId;
          if (resultadoPedido?.pedido) {
            pedidoId = resultadoPedido.pedido.id || resultadoPedido.pedido.dataValues?.id;
          } else if (resultadoPedido?.id) {
            pedidoId = resultadoPedido.id;
          } else if (resultadoPedido?.dataValues?.id) {
            pedidoId = resultadoPedido.dataValues.id;
          }

          if (!pedidoId || isNaN(Number(pedidoId))) {
            console.error(`${prefix} ID inválido retornado para pedido ${codigo}:`, resultadoPedido);
            throw new Error(`ID inválido retornado para pedido ${codigo}`);
          }

          const pedidoIdNum = Number(pedidoId);
          console.debug(`${prefix} Pedido criado com ID: ${pedidoIdNum}`);

          // Cria notas específicas do pedido (se existirem)
          if (notasProcessadas.length > 0) {
            for (const notaData of notasProcessadas) {
              const nota = await this._createOrFindNota(
                { ...notaData, pedido_id: pedidoIdNum },
                pedidoIdNum,
                transaction,
                operador_id,
                transactionId
              );
              if (nota) {
                totalNotasRecebimento++;
                console.debug(`${prefix} Nota ${nota.id} criada/associada ao pedido ${pedidoIdNum}`);
              }
            }
          } else if (meta.gerarNota !== false) {
            totalNotasRecebimento++;
          }

          // Entrada de estoque (INBOUND)
          if (hubParaEntrada) {
            for (const item of itensNormalizados) {
              const produtoId = Number(item.produto_id);
              const quantidade = Number(item.quantidade || 0);
              if (!produtoId || quantidade <= 0) continue;
              await estoquesService.entradaEstoque(
                {
                  produto_id: produtoId,
                  hub_id: hubParaEntrada,
                  quantidade,
                  usuario_id: operador_id,
                  localizacao: dadosRecebimento.localizacao || null,
                  referencia: novoRecebimento.numero_recebimento || `REC-${novoRecebimento.id}`,
                },
                { transaction }
              );
            }
          }

          pedidosCriados.push({ id: pedidoIdNum, codigo_pedido: codigo, criadoAgora: true });
        } catch (error) {
          console.error(`${prefix} Erro ao processar pedido ${pedidoDados.codigo}:`, error.stack);
          throw new Error(`Falha no pedido ${pedidoDados.codigo || '(sem código)'}: ${error.message}`);
        }
      }

      // --------------------------------------------------------------------
      // 7. Atualizações pós-processamento (somente campos existentes)
      // --------------------------------------------------------------------
      await this._checkTransaction(transaction, 'atualizações finais');

      const pedidoIds = pedidosCriados.map((p) => p.id).filter(Boolean);
      if (pedidoIds.length > 0) {
        console.debug(`${prefix} Atualizando ${pedidoIds.length} pedidos com conferencia_id: ${conferencia.id}`);
        await db.Pedidos.update(
          { conferencia_id: conferencia.id, status: 'AGUARDANDO_CONFERENCIA' },
          {
            where: { id: pedidoIds },
            transaction,
          }
        );
      }

      // Atualiza apenas quantidade_pedidos (campos valor_total e quantidade_notas NÃO existem)
      await novoRecebimento.update(
        {
          quantidade_pedidos: pedidosCriados.length,
        },
        { transaction }
      );

      if (transporte) {
        await transporte.update({ quantidade_total: pedidosCriados.length }, { transaction });
      }

      // --------------------------------------------------------------------
      // 8. Commit da transação
      // --------------------------------------------------------------------
      if (createdHere) {
        await this._checkTransaction(transaction, 'commit final');
        await transaction.commit();
        console.debug(`${prefix} Transação commitada com sucesso`);
      }

      // --------------------------------------------------------------------
      // 9. Montagem do resultado
      // --------------------------------------------------------------------
      const result = {
        message: 'Recebimento criado com sucesso',
        recebimento: novoRecebimento,
        conferencia: conferencia,
        pedidosCriados: pedidosCriados,
        manifestosCriados: manifestosCriados,
        totalPedidos: pedidosCriados.length,
        totalNotas: totalNotasRecebimento,
        valorTotal: valorTotalRecebimento,
      };

      if (transporte) result.transporte = transporte;

      console.debug(
        `${prefix} Processo concluído: ${pedidosCriados.length} pedido(s), ${manifestosCriados.length} manifesto(s)`
      );
      console.debug(`${prefix} ========== FIM DA CRIAÇÃO ==========`);
      return result;
    } catch (error) {
      console.error(`${prefix} ERRO GERAL:`, error.message);
      console.error(error.stack);

      if (createdHere && transaction && !transaction.finished) {
        try {
          await transaction.rollback();
          console.debug(`${prefix} Rollback executado com sucesso`);
        } catch (rbErr) {
          console.error(`${prefix} Erro ao tentar rollback:`, rbErr.stack);
        }
      }

      throw new Error(`Erro ao criar recebimento: ${error.message}`);
    }
  }

  // ------------------------------------------------------------------------
  //  MÉTODO CONCLUIR RECEBIMENTO (CORRIGIDO: status RECEBIDO -> ENTREGUE)
  // ------------------------------------------------------------------------
  async concluirRecebimento(id) {
    const transaction = await db.sequelize.transaction();
    const transactionId = transaction.id || `tx-${Date.now()}`;
    const prefix = `[Recebimento][${transactionId}]`;

    try {
      console.debug(`${prefix} Concluindo recebimento ${id}`);

      await this._checkTransaction(transaction, 'início conclusão');

      const recebimento = await db.Recebimentos.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
        include: [{ model: db.Conferencias, as: 'conferencias' }],
      });

      if (!recebimento) throw new Error('Recebimento não encontrado');
      if (recebimento.status === 'CONCLUIDO')
        throw new Error('Recebimento já está concluído');

      const conferencia = recebimento.conferencias?.[0] || null;
      if (!conferencia) {
        throw new Error(
          'Recebimento não possui conferência associada. Use createWithPedidos para criar recebimento com conferência.'
        );
      }

      const pedidos = await db.Pedidos.findAll({
        where: { recebimento_id: id },
        transaction,
      });

      if (!pedidos || pedidos.length === 0) {
        throw new Error(`Não é possível concluir recebimento ${id} sem pedidos`);
      }

      // Divergência de quantidade
      if (recebimento.quantidade_pedidos !== pedidos.length) {
        console.warn(
          `${prefix} Divergência encontrada: esperado ${recebimento.quantidade_pedidos}, recebido ${pedidos.length}`
        );

        await db.Excecao.create(
          {
            numero_ocorrencia: `EXC-${Date.now()}`,
            tipo: 'DIVERGENCIA',
            gravidade: 'ALTA',
            titulo: `Divergência na quantidade de pedidos - Recebimento ${recebimento.id}`,
            descricao: `Quantidade esperada: ${recebimento.quantidade_pedidos}, Quantidade recebida: ${pedidos.length}`,
            recebimento_id: recebimento.id,
            criador_id: recebimento.operador_id,
            data_ocorrencia: new Date(),
            impacto_financeiro: this.calcularImpactoDivergencia(
              recebimento.quantidade_pedidos,
              pedidos.length
            ),
            status: 'ABERTA',
          },
          { transaction }
        );
      }

      // Atualiza status do recebimento
      recebimento.status = 'CONCLUIDO';
      recebimento.data_conclusao = new Date();
      await recebimento.save({ transaction });

      // Atualiza status da conferência
      if (conferencia) {
        await conferencia.update(
          {
            status: 'CONCLUIDO',
            data_termino: new Date(),
            total_pedidos_finais: pedidos.length,
          },
          { transaction }
        );
      }

      // Registra rastreamento e atualiza pedidos
      for (const pedido of pedidos) {
        await db.Rastreamentos.create(
          {
            pedido_id: pedido.id,
            status_atual: 'ENTREGUE', // CORRIGIDO: status válido no ENUM
            data_status: new Date(),
            localizacao: 'Hub destino',
            observacao: `Recebimento ${recebimento.id} concluído`,
          },
          { transaction }
        );

        await pedido.update({ status: 'ENTREGUE' }, { transaction }); // CORRIGIDO
      }

      await this._checkTransaction(transaction, 'commit conclusão');
      await transaction.commit();

      const resultado = {
        message: 'Recebimento concluído com sucesso',
        recebimento,
        conferencia,
        totalPedidos: pedidos.length,
        divergencias: recebimento.quantidade_pedidos !== pedidos.length,
      };

      console.debug(`${prefix} Recebimento ${id} concluído com sucesso`);
      return resultado;
    } catch (error) {
      console.error(`${prefix} Erro ao concluir recebimento:`, error.message);
      console.error(error.stack);
      if (transaction && !transaction.finished) {
        try {
          await transaction.rollback();
          console.debug(`${prefix} Rollback executado`);
        } catch (rbErr) {
          console.error(`${prefix} Erro no rollback:`, rbErr.stack);
        }
      }
      throw new Error(`Erro ao concluir recebimento: ${error.message}`);
    }
  }

  // ------------------------------------------------------------------------
  //  MÉTODOS AUXILIARES (CONSULTAS, DASHBOARD, ETC.)
  // ------------------------------------------------------------------------
  async getPedidosByRecebimento(id) {
    try {
      const recebimento = await db.Recebimentos.findByPk(id, {
        include: [{ model: db.Pedidos, as: 'pedidos' }],
      });
      if (!recebimento) throw new Error('Recebimento não encontrado');
      return recebimento.pedidos || [];
    } catch (error) {
      console.error(`[Recebimento] getPedidosByRecebimento(${id}):`, error.stack);
      throw new Error(`Erro ao buscar pedidos: ${error.message}`);
    }
  }

  async getAllWithFilters(options = {}) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      filters = {},
    } = options;

    const offset = (page - 1) * limit;
    const whereConditions = {};

    if (filters.status) whereConditions.status = filters.status;
    if (filters.operador_id) whereConditions.operador_id = filters.operador_id;
    if (filters.data_inicio && filters.data_fim) {
      whereConditions.data_criacao = {
        [Op.between]: [new Date(filters.data_inicio), new Date(filters.data_fim)],
      };
    }

    try {
      const { count, rows } = await db.Recebimentos.findAndCountAll({
        where: whereConditions,
        include: [
          { model: db.Usuarios, attributes: ['nome'] },
          { model: db.Conferencias, as: 'conferencias', attributes: ['id', 'status'] },
        ],
        order: [[sortBy, sortOrder]],
        limit: parseInt(limit),
        offset,
        distinct: true,
      });

      return {
        recebimentos: rows,
        total: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit,
      };
    } catch (error) {
      console.error('[Recebimento] getAllWithFilters:', error.stack);
      throw new Error(`Erro ao buscar recebimentos: ${error.message}`);
    }
  }

  async searchRecebimentos(query, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    try {
      const { count, rows } = await db.Recebimentos.findAndCountAll({
        where: {
          [Op.or]: [
            { id: !isNaN(query) ? { [Op.eq]: parseInt(query) } : 0 },
            { '$Usuarios.nome$': { [Op.iLike]: `%${query}%` } },
            { status: { [Op.iLike]: `%${query}%` } },
            { numero_manifesto: { [Op.iLike]: `%${query}%` } },
            { manifesto_id: { [Op.iLike]: `${query}` } },
          ],
        },
        include: [{ model: db.Usuarios, attributes: ['nome'] }],
        order: [['data_criacao', 'DESC']],
        limit: parseInt(limit),
        offset,
        distinct: true,
      });

      return {
        recebimentos: rows,
        total: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit,
      };
    } catch (error) {
      console.error('[Recebimento] searchRecebimentos:', error.stack);
      throw new Error(`Erro na busca de recebimentos: ${error.message}`);
    }
  }

  async getRecebimentosDashboard() {
    try {
      const totalRecebimentos = await db.Recebimentos.count();

      const recebimentosPorStatus = await db.Recebimentos.findAll({
        attributes: ['status', [db.sequelize.fn('COUNT', 'status'), 'count']],
        group: ['status'],
        raw: true,
      });

      const recebimentosUltimaSemana = await db.Recebimentos.count({
        where: {
          data_criacao: {
            [Op.gte]: new Date(new Date() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      });

      const topOperadores = await db.Recebimentos.findAll({
        attributes: [
          'operador_id',
          [db.sequelize.fn('COUNT', 'operador_id'), 'total_recebimentos'],
        ],
        include: [{ model: db.Usuarios, attributes: ['nome'] }],
        group: ['operador_id', 'Usuarios.id'],
        order: [[db.sequelize.literal('total_recebimentos'), 'DESC']],
        limit: 5,
      });

      return {
        totalRecebimentos,
        recebimentosPorStatus,
        recebimentosUltimaSemana,
        topOperadores,
      };
    } catch (error) {
      console.error('[Recebimento] getRecebimentosDashboard:', error.stack);
      throw new Error(`Erro ao buscar dados do dashboard: ${error.message}`);
    }
  }

  async atualizarRecebimento(id, dadosAtualizacao) {
    const transaction = await db.sequelize.transaction();
    const transactionId = transaction.id || `tx-${Date.now()}`;
    const prefix = `[Recebimento][${transactionId}]`;

    try {
      console.debug(`${prefix} Atualizando recebimento ${id}`);

      await this._checkTransaction(transaction, 'atualização de recebimento');

      const recebimento = await db.Recebimentos.findByPk(id, { transaction });
      if (!recebimento) throw new Error('Recebimento não encontrado');
      if (recebimento.status === 'CONCLUIDO')
        throw new Error('Não é possível atualizar um recebimento concluído');

      await recebimento.update(dadosAtualizacao, { transaction });

      await this._checkTransaction(transaction, 'commit atualização');
      await transaction.commit();

      return { message: 'Recebimento atualizado com sucesso', recebimento };
    } catch (error) {
      console.error(`${prefix} Erro ao atualizar recebimento:`, error.stack);
      if (transaction && !transaction.finished) {
        try {
          await transaction.rollback();
        } catch (rbErr) {
          console.error(`${prefix} Erro no rollback:`, rbErr.stack);
        }
      }
      throw error;
    }
  }

  async cancelarRecebimento(id, motivo) {
    const transaction = await db.sequelize.transaction();
    const transactionId = transaction.id || `tx-${Date.now()}`;
    const prefix = `[Recebimento][${transactionId}]`;

    try {
      console.debug(`${prefix} Cancelando recebimento ${id}`);

      await this._checkTransaction(transaction, 'cancelamento de recebimento');

      const recebimento = await db.Recebimentos.findByPk(id, { transaction });
      if (!recebimento) throw new Error('Recebimento não encontrado');
      if (recebimento.status === 'CONCLUIDO')
        throw new Error('Não é possível cancelar um recebimento concluído');

      await recebimento.update({ status: 'CANCELADO' }, { transaction });

      await db.Excecao.create(
        {
          numero_ocorrencia: `CANC-${Date.now()}`,
          tipo: 'CANCELAMENTO',
          gravidade: 'MEDIA',
          titulo: `Recebimento ${id} cancelado`,
          descricao: motivo || 'Cancelamento solicitado pelo operador',
          recebimento_id: id,
          criador_id: recebimento.operador_id,
          data_ocorrencia: new Date(),
          status: 'FECHADA',
        },
        { transaction }
      );

      await this._checkTransaction(transaction, 'commit cancelamento');
      await transaction.commit();

      return { message: 'Recebimento cancelado com sucesso', recebimento };
    } catch (error) {
      console.error(`${prefix} Erro ao cancelar recebimento:`, error.stack);
      if (transaction && !transaction.finished) {
        try {
          await transaction.rollback();
        } catch (rbErr) {
          console.error(`${prefix} Erro no rollback:`, rbErr.stack);
        }
      }
      throw error;
    }
  }
}

module.exports = RecebimentoServices;