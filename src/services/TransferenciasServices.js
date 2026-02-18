const Services = require('./Services');
const db = require('../models');
const { Op } = require('sequelize');

class TransferenciaServices extends Services {
  constructor() {
    super('Transferencias');
    this.PedidosServices = require('./PedidosServices');
    this.HubsServices = require('./HubsServices');
    this.EstoquesServices = require('./EstoquesServices');
    this.ManifestosServices = require('./ManifestosServices');
    this.NotasFiscaisServices = require('./NotasFiscaisServices');
  }

  async _normalizeAndEnsureProdutos(itens, transaction, createMissing = true) {
    const itensNormalizados = [];

    for (const item of itens) {
      let produto_id = item.produto_id;

      if (!produto_id && item.produto && item.produto.nome) {
        const nomeTratado = String(item.produto.nome).trim();
        const [produto] = await db.Produtos.findOrCreate({
          where: { nome: nomeTratado },
          defaults: {
            nome: nomeTratado,
            descricao: item.produto.descricao || `Produto ${nomeTratado}`,
            preco: item.produto.preco || 0,
            peso_kg: item.produto.peso_kg || 0,
            categoria: item.produto.categoria || 'GERAL'
          },
          transaction
        });
        produto_id = produto.id;
        console.debug(`Produto criado/encontrado: ${produto.id} - ${produto.nome}`);
      }

      if (!produto_id && !createMissing) {
        throw new Error(`Nenhum produto_id válido encontrado para item: ${JSON.stringify(item)}`);
      }
      if (!produto_id) {
        throw new Error(`Não foi possível obter/gerar produto para item: ${JSON.stringify(item)}`);
      }

      itensNormalizados.push({
        produto_id: Number(produto_id),
        quantidade: Math.max(1, Number(item.quantidade || 1)),
        valor_unitario: Number(item.valor_unitario || 0),
        descricao: item.descricao || (item.produto && item.produto.descricao) || '',
        observacao: item.observacao || ''
      });
    }

    return itensNormalizados;
  }

  async _ensureClienteAndEndereco(meta, transaction) {
    let cliente_id = meta.cliente_id;
    let endereco_id = meta.endereco_id;

    if (meta.cliente && !cliente_id) {
      const whereCliente = {};
      if (meta.cliente.cpf) whereCliente.cpf = meta.cliente.cpf;
      else if (meta.cliente.email) whereCliente.email = meta.cliente.email;
      else if (meta.cliente.nome) whereCliente.nome = meta.cliente.nome;

      if (Object.keys(whereCliente).length > 0) {
        const [cliente] = await db.Clientes.findOrCreate({
          where: whereCliente,
          defaults: {
            nome: meta.cliente.nome,
            email: meta.cliente.email || '',
            telefone: meta.cliente.telefone || '',
            cpf: meta.cliente.cpf || '',
            tipo: meta.cliente.tipo || 'FISICA'
          },
          transaction
        });
        cliente_id = cliente.id;
        console.debug(`Cliente criado/encontrado: ${cliente.id} - ${cliente.nome}`);
      }
    }

    if (meta.endereco && cliente_id && !endereco_id) {
      const whereEndereco = { cliente_id };
      if (meta.endereco.cep) whereEndereco.cep = meta.endereco.cep;

      const [endereco] = await db.Enderecos.findOrCreate({
        where: whereEndereco,
        defaults: {
          cliente_id,
          cep: meta.endereco.cep || '',
          rua: meta.endereco.rua || '',
          numero: meta.endereco.numero || '',
          complemento: meta.endereco.complemento || '',
          bairro: meta.endereco.bairro || '',
          cidade: meta.endereco.cidade || '',
          estado: meta.endereco.estado || '',
          pais: meta.endereco.pais || 'Brasil',
          tipo: meta.endereco.tipo || 'RESIDENCIAL'
        },
        transaction
      });
      endereco_id = endereco.id;
      console.debug(`Endereço criado/encontrado: ${endereco.id} - ${endereco.cep}`);
    }

    return { cliente_id, endereco_id };
  }

  _convertLegacyFormat(dados) {
    const { pedidosCodigos = [], pedidosItens = {}, pedidosMeta = {}, createMissingPedidos = true } = dados;
    const pedidosDados = [];

    for (const codigo of pedidosCodigos) {
      const itens = pedidosItens[codigo] || [];
      const meta = pedidosMeta[codigo] || {};
      if (itens.length === 0) {
        console.warn(`Código ${codigo} listado em pedidosCodigos sem entradas em pedidosItens`);
      }
      pedidosDados.push({ codigo, itens, meta, createMissingPedidos });
    }

    return { ...dados, pedidosDados };
  }

  /**
   * Extrai e normaliza dados de transporte do payload
   * Contrato igual ao usado em RecebimentoServices
   */
  _extrairDadosTransporte(dados) {
    let dadosTransporte = null;

    if (dados.transporte) {
      dadosTransporte = dados.transporte;
      console.debug('Dados de transporte encontrados em dados.transporte');
    } else if (dados.transferencia && dados.transferencia.transporte) {
      dadosTransporte = dados.transferencia.transporte;
      console.debug('Dados de transporte encontrados em dados.transferencia.transporte');
    } else if (dados.recebimento && dados.recebimento.transporte) {
      // para compatibilidade com payload vindo do mesmo formato
      dadosTransporte = dados.recebimento.transporte;
      console.debug('Dados de transporte encontrados em dados.recebimento.transporte');
    }

    if (!dadosTransporte) {
      console.debug('Nenhum dado de transporte encontrado nos dados');
      return null;
    }

    const normal = {
      transportador_nome: dadosTransporte.transportador_nome ? String(dadosTransporte.transportador_nome) : null,
      cnpj_transportador: dadosTransporte.cnpj_transportador ? String(dadosTransporte.cnpj_transportador) : null,
      endereco_transportador: dadosTransporte.endereco_transportador ? String(dadosTransporte.endereco_transportador) : null,
      placa_veiculo: dadosTransporte.placa_veiculo ? String(dadosTransporte.placa_veiculo) : null,
      uf_veiculo: dadosTransporte.uf_veiculo ? String(dadosTransporte.uf_veiculo) : null,
      frete_por_conta: dadosTransporte.frete_por_conta ? String(dadosTransporte.frete_por_conta) : null,
      quantidade_volume: dadosTransporte.quantidade_volume ? Number(dadosTransporte.quantidade_volume) : null,
      especie_volumes: dadosTransporte.especie_volumes ? String(dadosTransporte.especie_volumes) : null,
      marca_volumes: dadosTransporte.marca_volumes ? String(dadosTransporte.marca_volumes) : null,
      numero_volumes: dadosTransporte.numero_volumes ? String(dadosTransporte.numero_volumes) : null,
      peso_bruto: dadosTransporte.peso_bruto ? parseFloat(dadosTransporte.peso_bruto) : null,
      peso_liquido: dadosTransporte.peso_liquido ? parseFloat(dadosTransporte.peso_liquido) : null,
      informacoes_transporte: dadosTransporte.informacoes_transporte ? String(dadosTransporte.informacoes_transporte) : null
    };

    console.debug('Dados de transporte extraídos e normalizados:', normal);
    return normal;
  }

  /**
   * Valida transição de status da transferência
   */
  _validarTransicaoStatus(statusAtual, novoStatus) {
    const transicoesValidas = {
      'CRIADO': ['EM_TRANSPORTE', 'CANCELADO'],
      'EM_TRANSPORTE': ['RECEBIDO', 'CANCELADO'],
      'RECEBIDO': [],
      'CANCELADO': []
    };

    if (!transicoesValidas[statusAtual]?.includes(novoStatus)) {
      throw new Error(`Transição de status inválida: ${statusAtual} -> ${novoStatus}`);
    }
  }

  /**
   * Valida início do transporte (motorista não é mais obrigatório)
   */
  _validarInicioTransporte(transferencia) {
    if (transferencia.status !== 'CRIADO') {
      throw new Error('Só é possível iniciar transporte de transferências com status CRIADO');
    }

    if (!transferencia.pedidos || transferencia.pedidos.length === 0) {
      throw new Error('Não é possível iniciar transporte sem pedidos associados');
    }

    console.debug('Validação de início de transporte passou');
  }

    /**
     * Cria ou busca uma nota fiscal
     */
    async _createOrFindNota(notaData, pedidoId, transaction, operador_id) {
      const notasFiscaisService = new this.NotasFiscaisServices();
  
      let notaExistente = null;
  
      if (notaData.id) {
        notaExistente = await notasFiscaisService.getById(notaData.id, { transaction });
      } else if (notaData.chave_nfe) {
        notaExistente = await db.NotasFiscais.findOne({
          where: { chave_nfe: notaData.chave_nfe },
          transaction
        });
      } else if (notaData.numero && pedidoId) {
        notaExistente = await db.NotasFiscais.findOne({
          where: {
            numero: notaData.numero,
            pedido_id: pedidoId
          },
          transaction
        });
      }
  
      if (notaExistente) {
        console.debug(`Nota encontrada: ${notaExistente.id}`);
        return notaExistente;
      }
  
      const notaPayload = {
        pedido_id: pedidoId,
        numero: notaData.numero || `NF-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        serie: notaData.serie || '1',
        chave_nfe: notaData.chave_nfe || null,
        data_emissao: notaData.data_emissao || new Date(),
        valor_total: 0,
        tipo: notaData.tipo || 'NF-e',
        manifesto_id: notaData.manifesto_id || null,
        itens: []
      };
  
      if (notaData.itens && notaData.itens.length > 0) {
        const itensNormalizados = await this._normalizeAndEnsureProdutos(
          notaData.itens,
          transaction,
          true
        );
  
        notaPayload.itens = itensNormalizados;
        notaPayload.valor_total = itensNormalizados.reduce((total, item) =>
          total + (item.quantidade * item.valor_unitario), 0
        );
      }
  
      console.debug(`Criando nova nota: ${notaPayload.numero}`);
      const novaNota = await notasFiscaisService.createNotaComItens(notaPayload, { transaction });
      return novaNota;
    }

      _normalizeManifestosInput(manifestosInput) {
    if (!manifestosInput) {
      return [];
    }

    if (Array.isArray(manifestosInput)) {
      return manifestosInput;
    }

    if (typeof manifestosInput === 'object') {
      return [manifestosInput];
    }

    if (typeof manifestosInput === 'string') {
      return [{ numero_manifesto: manifestosInput }];
    }

    return [];
  }
  
    /**
   * Cria notas de manifesto após o manifesto ser criado
   */
  async _criarNotasParaManifesto(manifestoId, notasData, transaction, operador_id) {
    const notasFiscaisService = new this.NotasFiscaisServices();
    const notasCriadas = [];

    console.debug(`[Manifesto] Criando ${notasData.length} notas para manifesto ${manifestoId}`);

    for (const notaData of notasData) {
      try {
        const notaPayload = {
          ...notaData,
          manifesto_id: manifestoId,
          pedido_id: null 
        };

        console.debug(`[Manifesto] Criando nota ${notaPayload.numero} para manifesto ${manifestoId}`);

        const notaCriada = await notasFiscaisService.createNotaComItens(notaPayload, { transaction });
        notasCriadas.push(notaCriada);

        console.debug(`[Manifesto] Nota criada: ${notaCriada.id} - ${notaCriada.numero}`);
      } catch (error) {
        console.error(`[Manifesto] Erro ao criar nota para manifesto ${manifestoId}:`, error);
      }
    }

    return notasCriadas;
  }

  /**
   * Cria ou busca um manifesto
   */
  async _createOrFindManifesto(manifestoData, recebimentoId, transaction, operador_id) {
    const manifestosService = new this.ManifestosServices();

    const normalizedData = this._normalizeManifestosInput(manifestoData);
    if (normalizedData.length === 0) {
      return null;
    }

    const primeiroManifesto = normalizedData[0];
    let manifestoExistente = null;

    if (primeiroManifesto.id) {
      manifestoExistente = await manifestosService.getById(primeiroManifesto.id, { transaction });
    }

    if (!manifestoExistente && primeiroManifesto.numero_manifesto) {
      manifestoExistente = await db.Manifestos.findOne({
        where: { numero_manifesto: primeiroManifesto.numero_manifesto },
        transaction
      });
    }

    if (manifestoExistente) {
      console.debug(`Manifesto encontrado: ${manifestoExistente.id}`);

      if (recebimentoId && manifestoExistente.recebimento_id !== recebimentoId) {
        await manifestoExistente.update({ recebimento_id: recebimentoId }, { transaction });
        console.debug(`Manifesto ${manifestoExistente.id} atualizado com recebimento_id: ${recebimentoId}`);
      }

      return manifestoExistente;
    }

    const manifestoValidAttrs = [
      'numero_manifesto', 'serie', 'data_emissao', 'origem_hub_id',
      'destino_hub_id', 'valor_total', 'quantidade_notas', 'observacoes', 'recebimento_id'
    ];

    const manifestoPayload = {};
    manifestoValidAttrs.forEach(key => {
      if (primeiroManifesto[key] !== undefined) {
        manifestoPayload[key] = primeiroManifesto[key];
      }
    });

    manifestoPayload.numero_manifesto = primeiroManifesto.numero_manifesto || `MAN-${Date.now()}`;
    manifestoPayload.serie = primeiroManifesto.serie || '1';
    manifestoPayload.data_emissao = primeiroManifesto.data_emissao ? new Date(primeiroManifesto.data_emissao) : new Date();
    manifestoPayload.recebimento_id = recebimentoId;

    console.debug(`Criando novo manifesto: ${manifestoPayload.numero_manifesto}`);

    const novoManifesto = await db.Manifestos.create(manifestoPayload, { transaction });
    console.debug(`Manifesto criado: ${novoManifesto.id} com recebimento_id: ${recebimentoId}`);

    return novoManifesto;
  }


  /**
 * Processa notas de manifestos (incluindo notas de pedidos)
 */
  async _processarNotasManifestos(manifestosData, transferenciaId, transaction, operador_id) {
    const manifestosProcessados = [];

    console.debug(`[Transferência] Processando notas para ${manifestosData.length} manifestos`);

    for (const manifestoData of manifestosData) {
      const notasProcessadas = [];

      if (manifestoData.notas && Array.isArray(manifestoData.notas)) {
        for (const notaData of manifestoData.notas) {
          try {
            console.debug(`[Manifesto] Processando nota direta do manifesto: ${notaData.numero || 'sem número'}`);

            const notaPayload = {
              numero: notaData.numero || `NF-${Date.now()}`,
              serie: notaData.serie || '1',
              data_emissao: notaData.data_emissao || new Date(),
              valor_total: 0,
              tipo: 'NF-e',
              manifesto_id: null,
              itens: []
            };

            if (notaData.itens && Array.isArray(notaData.itens) && notaData.itens.length > 0) {
              const itensNormalizados = await this._normalizeAndEnsureProdutos(
                notaData.itens,
                transaction,
                true
              );

              notaPayload.itens = itensNormalizados;
              notaPayload.valor_total = itensNormalizados.reduce((total, item) =>
                total + (item.quantidade * item.valor_unitario), 0
              );

              console.debug(`[Manifesto] Nota com ${itensNormalizados.length} itens, valor: ${notaPayload.valor_total}`);
            } else {
              console.warn(`[Manifesto] Nota ${notaData.numero} sem itens, será ignorada`);
              continue; 
            }

            notasProcessadas.push({
              ...notaPayload,
              _originalData: notaData
            });
          } catch (error) {
            console.error(`[Manifesto] Erro ao processar nota:`, error);
          }
        }
      }

      manifestosProcessados.push({
        ...manifestoData,
        notas: notasProcessadas,
        _notasCount: notasProcessadas.length
      });
    }

    return manifestosProcessados;
  }

  /**
   * Cria uma conferência vinculada a transferência
   */
  async _criarConferenciaParaTransferencia(transferencia, transporte, manifesto, pedidosCount, operador_id, transaction) {
    console.debug(`[Conferencia] Criando conferência para transferencia ${transferencia.id}`);

    const conferenciaValidAttrs = [
      'transporte_id', 'manifesto_id', 'operador_id', 'total_pedidos_iniciais',
      'total_pedidos_finais', 'nome_estacao', 'status', 'data_criacao',
      'percentual_validacao', 'pedidos_escaneados'
    ];

    const conferenciaPayload = {};
    const payloadData = {
      transporte_id: transporte ? transporte.id : null,
      manifesto_id: manifesto ? manifesto.id : null,
      operador_id: operador_id,
      total_pedidos_iniciais: pedidosCount,
      total_pedidos_finais: pedidosCount,
      nome_estacao: transferencia.localizacao || 'TRANSFERÊNCIA',
      status: 'PENDENTE',
      data_criacao: new Date(),
      percentual_validacao: 0,
      pedidos_escaneados: 0
    };

    conferenciaValidAttrs.forEach(key => {
      if (payloadData[key] !== undefined) {
        conferenciaPayload[key] = payloadData[key];
      }
    });

    const conferencia = await db.Conferencias.create(conferenciaPayload, { transaction });
    console.debug(`[Conferencia] Conferência criada: ${conferencia.id}, manifesto_id: ${conferencia.manifesto_id}, transporte_id: ${conferencia.transporte_id}`);

    // Atualiza o recebimento com a conferência
    await recebimento.update({ conferencia_id: conferencia.id }, { transaction });

    return conferencia;
  }


   /**
    * Cria transporte vinculado a transferência
    */
   async _criarTransporteParaTransferencia(dadosTransporte, transferencia, operador_id, transaction) {
     console.debug(`[Transporte] Criando transporte para transferencia ${transferencia.id}`);
 
     const transporteValidAttrs = [
       'tipo_transporte', 'numero_transporte', 'transferencia_id', 'quantidade_total',
       'peso_total_kg', 'volumetria_total', 'status_transporte', 'operador_id',
       'direcao', 'data_criacao', 'nome_transportador', 'cnpj_transportador',
       'endereco_transportador', 'placa_veiculo', 'uf_veiculo', 'frete_por_conta',
       'quantidade_volume', 'especie_volumes', 'marca_volumes', 'numero_volumes',
       'peso_bruto', 'peso_liquido', 'informacoes_transporte'
     ];
 
     const payloadData = {
       tipo_transporte: 'TO',
       numero_transporte: dadosTransporte.numero_transporte || `TO-${Date.now()}`,
       transferencia_id: transferencia.id,
       quantidade_total: 0,
       peso_total_kg: dadosTransporte.peso_bruto || null,
       volumetria_total: dadosTransporte.quantidade_volume || null,
       status_transporte: 'CRIADO',
       operador_id: operador_id,
       direcao: transferencia.tipo_tarefa === 'OUTBOUND',
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
       informacoes_transporte: dadosTransporte.informacoes_transporte
     };
 
     const transportePayload = {};
     transporteValidAttrs.forEach(key => {
       if (payloadData[key] !== undefined) {
         transportePayload[key] = payloadData[key];
       }
     });
 
     const transporte = await db.Transportes.create(transportePayload, { transaction });
     console.debug(`[Transporte] Transporte criado: ${transporte.id}`);
 
     return transporte;
   }
  


  async createWithPedidos(dados, options = {}) {
    const externalTx = options.transaction;
    const transaction = externalTx || await db.sequelize.transaction();
    const createdHere = !externalTx;

    try {
      console.debug('[Transferencia] Iniciando criação de transferência com payload estilo Recebimento');

      // 1. Determinar operador
      const operador_id = dados.operador_id || dados.usuario_id || options.usuario_id || process.env.SYSTEM_USER_ID || 1;
      console.debug(`[Transferencia] Operador ID determinado: ${operador_id}`);

      // 2. Converter formato herdado se necessário
      let dadosProcessados = { ...dados };
      if (dados.pedidosCodigos && !dados.pedidosDados) {
        console.debug('[Transferencia] Convertendo formato herdado para formato montado');
        dadosProcessados = this._convertLegacyFormat(dados);
      }

      const { pedidosDados = [], ...dadosTransferencia } = dadosProcessados;
      const createMissingPedidos = dadosProcessados.createMissingPedidos !== false;
      console.debug(`[Transferencia] Processando ${pedidosDados.length} pedidos`);

      // 3. Processar Hubs
      let origemHub = null;
      let destinoHub = null;
      const hubsService = new this.HubsServices();

      const origemNome = dadosProcessados.origem_hub_nome || dadosTransferencia.origem_hub_nome || null;
      const destinoNome = dadosProcessados.destino_hub_nome || dadosTransferencia.destino_hub_nome || null;

      if (origemNome) {
        console.debug(`[Transferencia] Localizando/criando hub origem: ${origemNome}`);
        origemHub = await hubsService.createHubAuto(origemNome, { transaction });
      }

      if (destinoNome) {
        console.debug(`[Transferencia] Localizando/criando hub destino: ${destinoNome}`);
        destinoHub = await hubsService.createHubAuto(destinoNome, { transaction });
      }

      const numero_TO = dadosTransferencia.numero_TO || `TO-${Date.now()}`;
      const tipoTarefa = String(dadosTransferencia.tipo_tarefa || dadosProcessados.tipo_tarefa || 'OUTBOUND').toUpperCase();

      const transferenciaValidAttrs = [
        'numero_TO', 'operador_id', 'direcao', 'status', 'data_criacao',
        'quantidade', 'peso_kg', 'origem_hub_id', 'destino_hub_id',
        'tipo_tarefa', 'observacoes', 'transportador_nome', 'cnpj_transportador',
        'endereco_transportador', 'placa_veiculo', 'uf_veiculo', 'frete_por_conta',
        'quantidade_volume', 'especie_volumes', 'marca_volumes', 'numero_volumes',
        'informacoes_transporte'
      ];

      const transferenciaData = {
        ...dadosTransferencia,
        numero_TO,
        operador_id,
        direcao: 'OUTBOUND',
        status: 'CRIADO',
        data_criacao: new Date(),
        quantidade: 0,
        peso_kg: 0,
        tipo_tarefa,
        origem_hub_id: dadosTransferencia.origem_hub_id || (origemHub && origemHub.id) || null,
        destino_hub_id: dadosTransferencia.destino_hub_id || (destinoHub && destinoHub.id) || null
      };

      const dadosTransporte = this._extrairDadosTransporte(dadosProcessados);
      if (dadosTransporte) {
        Object.assign(transferenciaData, {
          transportador_nome: dadosTransporte.transportador_nome,
          cnpj_transportador: dadosTransporte.cnpj_transportador,
          endereco_transportador: dadosTransporte.endereco_transportador,
          placa_veiculo: dadosTransporte.placa_veiculo,
          uf_veiculo: dadosTransporte.uf_veiculo,
          frete_por_conta: dadosTransporte.frete_por_conta,
          quantidade_volume: dadosTransporte.quantidade_volume,
          especie_volumes: dadosTransporte.especie_volumes,
          marca_volumes: dadosTransporte.marca_volumes,
          numero_volumes: dadosTransporte.numero_volumes,
          peso_kg: dadosTransporte.peso_bruto || 0,
          informacoes_transporte: dadosTransporte.informacoes_transporte
        });
      }

      const transferenciaPayload = {};
      transferenciaValidAttrs.forEach(key => {
        if (transferenciaData[key] !== undefined) {
          transferenciaPayload[key] = transferenciaData[key];
        }
      });

      const novaTransferencia = await db.Transferencias.create(transferenciaPayload, { transaction });
      console.debug(`[Transferencia] Transferência criada: ${novaTransferencia.id}`);

      let manifestosCriados = [];
      const manifestosPayloadArray = this._normalizeManifestosInput(
        dadosProcessados.manifestos ||
        dadosProcessados.manifestosCriados ||
        dadosProcessados.manifestosCriadosResultado
      );

      if (manifestosPayloadArray.length > 0) {
        console.debug(`[Transferencia] Processando ${manifestosPayloadArray.length} manifestos do payload`);

        for (const manifestoData of manifestosPayloadArray) {
          console.debug(`[Transferencia] Criando manifesto: ${manifestoData.numero_manifesto} com ${manifestoData._notasCount || 0} notas`);

          const { notas, _notasCount, ...dadosManifesto } = manifestoData;

          const manifestoPayload = {
            ...dadosManifesto,
            transferencia_id: novaTransferencia.id,
            origem_hub_id: novaTransferencia.origem_hub_id,
            destino_hub_id: novaTransferencia.destino_hub_id,
            valor_total: 0,
            quantidade_notas: 0
          };

          const manifesto = await db.Manifestos.create(manifestoPayload, { transaction });
          console.debug(`[Transferencia] Manifesto criado: ${manifesto.id}`);

          if (notas && notas.length > 0) {
            const notasCriadas = await this._criarNotasParaManifesto(
              manifesto.id,
              notas,
              transaction,
              operador_id
            );

            const valorTotal = notasCriadas.reduce((total, nota) =>
              total + (nota.valor_total || 0), 0
            );

            await manifesto.update({
              valor_total: valorTotal,
              quantidade_notas: notasCriadas.length
            }, { transaction });

            console.debug(`[Transferencia] Manifesto ${manifesto.id} atualizado: ${notasCriadas.length} notas, R$ ${valorTotal}`);
          }

          manifestosCriados.push(manifesto);
        }
      }

      let transporte = null;
      if (dadosTransporte) {
        console.debug('[Transferencia] Criando transporte a partir dos dados do payload');
        transporte = await db.Transportes.create({
          tipo_transporte: 'TO',
          numero_transporte: numero_TO,
          transferencia_id: novaTransferencia.id,
          quantidade_total: 0,
          peso_total_kg: dadosTransporte.peso_bruto || null,
          volumetria_total: dadosTransporte.quantidade_volume || null,
          status_transporte: 'CRIADO',
          operador_id,
          direcao: 'OUTBOUND',
          data_criacao: new Date(),
          hub_origem_id: novaTransferencia.origem_hub_id,
          hub_destino_id: novaTransferencia.destino_hub_id,
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
          informacoes_transporte: dadosTransporte.informacoes_transporte
        }, { transaction });

        console.debug(`[Transferencia] Transporte criado: ${transporte.id}`);
      }

      const pedidosCriados = [];
      const pedidosServices = new this.PedidosServices();
      const estoquesService = new this.EstoquesServices();

      const hubOrigemId = novaTransferencia.origem_hub_id;
      let totalNotasTransferencia = 0;
      let valorTotalTransferencia = 0;

      for (const pedidoDados of pedidosDados) {
        try {
          const { codigo, itens = [], meta = {}, ...outrosDadosPedido } = pedidoDados;
          console.debug(`[Transferencia] Processando pedido código: ${codigo}`);

          const itensNormalizados = await this._normalizeAndEnsureProdutos(itens, transaction, createMissingPedidos);

          const { cliente_id, endereco_id } = await this._ensureClienteAndEndereco(meta, transaction);

          const valorPedido = itensNormalizados.reduce((total, item) =>
            total + (item.quantidade * item.valor_unitario), 0
          );
          valorTotalTransferencia += valorPedido;

          let notasProcessadas = [];
          if (meta.notas && Array.isArray(meta.notas)) {
            console.debug(`[Transferencia] Processando ${meta.notas.length} notas do pedido ${codigo}`);

            for (const notaData of meta.notas) {
              let manifesto_id = null;
              if (meta.manifesto_numero) {
                const manifestoPorNumero = manifestosCriados.find(m =>
                  m.numero_manifesto === meta.manifesto_numero
                );
                if (manifestoPorNumero) {
                  manifesto_id = manifestoPorNumero.id;
                }
              }

              const itensNota = (notaData.itens || []).map(item => ({
                produto: {
                  nome: item.produto?.nome || '',
                  descricao: item.produto?.descricao || null,
                  s_n: item.produto?.s_n || null,
                  p_n: item.produto?.p_n || null,
                  preco: parseFloat(item.produto?.preco) || 0,
                  peso_kg: parseFloat(item.produto?.peso_kg) || 0
                },
                quantidade: parseInt(item.quantidade) || 1,
                valor_unitario: parseFloat(item.valor_unitario) || 0,
                descricao: item.descricao || null
              }));

              notasProcessadas.push({
                ...notaData,
                itens: itensNota,
                manifesto_id: manifesto_id
              });
            }
          }

          const pedidoParaCriar = {
            codigo_pedido: codigo,
            itens: itensNormalizados,
            cliente_id,
            endereco_id,
            transferencia_id: novaTransferencia.id,
            transporte_id: transporte ? transporte.id : null,
            status: 'EM_TRANSITO',
            manifesto_id: meta.manifesto_numero ?
              (manifestosCriados.find(m => m.numero_manifesto === meta.manifesto_numero)?.id || null)
              : null,
            gerarNota: meta.gerarNota !== false,
            valor_total: valorPedido,
            meta: {
              ...meta,
              notas: notasProcessadas
            },
            ...outrosDadosPedido
          };

          console.debug(`[Transferencia] Criando pedido ${codigo} com transferencia_id: ${novaTransferencia.id}`);

          const resultadoPedido = await pedidosServices.createPedidoComItensENota(
            pedidoParaCriar,
            { transaction, usuario_id: operador_id }
          );

          let pedidoId;
          if (resultadoPedido && resultadoPedido.pedido) {
            pedidoId = resultadoPedido.pedido.id || (resultadoPedido.pedido.dataValues && resultadoPedido.pedido.dataValues.id);
          } else if (resultadoPedido && resultadoPedido.id) {
            pedidoId = resultadoPedido.id;
          } else if (resultadoPedido && resultadoPedido.dataValues) {
            pedidoId = resultadoPedido.dataValues.id;
          }

          if (!pedidoId || isNaN(Number(pedidoId))) {
            console.error(`[Transferencia] ID inválido retornado para pedido ${codigo}:`, resultadoPedido);
            throw new Error(`ID inválido retornado para pedido ${codigo}`);
          }

          const pedidoIdNum = Number(pedidoId);
          console.debug(`[Transferencia] Pedido criado com ID: ${pedidoIdNum}`);

          if (notasProcessadas.length > 0) {
            for (const notaData of notasProcessadas) {
              const nota = await this._createOrFindNota(
                { ...notaData, pedido_id: pedidoIdNum },
                pedidoIdNum,
                transaction,
                operador_id
              );

              if (nota) {
                totalNotasTransferencia++;
                console.debug(`[Transferencia] Nota ${nota.id} criada/associada ao pedido ${pedidoIdNum}`);
              }
            }
          } else if (meta.gerarNota !== false) {
            totalNotasTransferencia++;
          }

          if (hubOrigemId) {
            for (const item of itensNormalizados) {
              const produtoId = Number(item.produto_id);
              const quantidade = Number(item.quantidade || 0);
              if (!produtoId || quantidade <= 0) continue;

              await estoquesService.saidaEstoque({
                produto_id: produtoId,
                hub_id: hubOrigemId,
                quantidade,
                usuario_id: operador_id,
                referencia: novaTransferencia.numero_TO || `TO-${novaTransferencia.id}`,
                consumirReservas: true
              }, { transaction });
            }
          }

          pedidosCriados.push({
            id: pedidoIdNum,
            codigo_pedido: codigo,
            criadoAgora: true
          });

        } catch (error) {
          console.error(`[Transferencia] Erro ao processar pedido ${pedidoDados.codigo}:`, error);
          throw new Error(`Falha no pedido ${pedidoDados.codigo || '(sem código)'}: ${error.message}`);
        }
      }

      await novaTransferencia.update({
        quantidade: pedidosCriados.length,
        peso_kg: dadosTransporte?.peso_bruto || 0
      }, { transaction });

      if (transporte) {
        await transporte.update({
          quantidade_total: pedidosCriados.length,
          peso_total_kg: dadosTransporte?.peso_bruto || transporte.peso_total_kg
        }, { transaction });
      }

      if (manifestosCriados.length > 0) {
        await novaTransferencia.update({
          possui_manifestos: true
        }, { transaction });
      }

      if (createdHere) {
        await transaction.commit();
        console.debug('[Transferencia] Transação commitada com sucesso');
      }

      const result = {
        message: "Transferência criada com sucesso",
        transferencia: novaTransferencia,
        pedidosCriados: pedidosCriados,
        manifestosCriados: manifestosCriados,
        totalPedidos: pedidosCriados.length,
        totalNotas: totalNotasTransferencia,
        valorTotal: valorTotalTransferencia
      };

      if (transporte) {
        result.transporte = transporte;
      }

      console.debug(`[Transferencia] Processo concluído: ${pedidosCriados.length} pedido(s), ${manifestosCriados.length} manifesto(s)`);
      return result;

    } catch (error) {
      if (createdHere && transaction && !transaction.finished) {
        try {
          await transaction.rollback();
          console.debug('[Transferencia] Transação revertida devido a erro');
        } catch (rbErr) {
          console.error('Erro ao tentar rollback da transação:', rbErr);
        }
      }

      console.error('[Transferencia] Erro ao criar transferência:', error);
      throw new Error(`Erro ao criar transferência: ${error.message}`);
    }
  }

  async getAllTransferencias(filters = {}) {
    const { status, direcao, numero_TO } = filters;
    const where = {};

    if (status) where.status = status;
    if (direcao) where.direcao = direcao;
    if (numero_TO) where.numero_TO = { [Op.like]: `%${numero_TO}%` };

    return await db.Transferencias.findAll({
      where,
      include: [
        { model: db.Hubs, as: 'origemHub', attributes: ['id', 'nome', 'codigo_hub'] },
        { model: db.Hubs, as: 'destinoHub', attributes: ['id', 'nome', 'codigo_hub'] },
        { model: db.Motoristas, attributes: ['id', 'nome', 'veiculo'] },
        {
          model: db.Pedidos,
          as: 'pedidos',
          attributes: ['id', 'codigo_pedido', 'status'],
          include: [
            { model: db.Clientes, as: 'clientes', attributes: ['id', 'nome'] },
            { model: db.Produtos, as: 'produtos', attributes: ['id', 'nome'] }
          ]
        },
        {
          model: db.Transportes,
          as: 'transportes',
          attributes: ['id', 'numero_transporte', 'status_transporte']
        }
      ],
      order: [['data_criacao', 'DESC']]
    });
  }

async getById(id) {
    return await db.Transferencias.findByPk(id, {
        include: [
            { model: db.Hubs, as: 'origemHub' },
            { model: db.Hubs, as: 'destinoHub' },
            { model: db.Motoristas },
            { 
                model: db.Pedidos, 
                as: 'pedidos',
                include: [
                    { model: db.Clientes, as: 'clientes', attributes:['nome', 'telefone', 'email'] },
                    { model: db.Produtos, as: 'produtos' },
                    { model: db.Enderecos, as: 'enderecos' }
                ],
            },
            {
                model: db.Transportes,
                as: 'transportes',
                include: [
                    { model: db.Motoristas }
                ]
            },
            {
                model: db.Manifestos,
                as: 'manifestos',
                include: [
                    {
                        model: db.NotasFiscais,
                        as: 'notas',
                        include: [
                            {
                                model: db.ItensNota,
                                as: 'itens',
                                include: [
                                    { model: db.Produtos, as: 'produto' }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    });
}
  async getPedidosByTransferencia(id) {
    const transferencia = await db.Transferencias.findByPk(id, {
      include: [{
        model: db.Pedidos,
        as: 'pedidos',
        include: [
          { model: db.Clientes, as: 'clientes', attributes: ['id', 'nome', 'telefone'] },
          { model: db.Produtos, as: 'produtos', attributes: ['id', 'nome', 'peso_kg'] },
          { model: db.Enderecos, as: 'enderecos', attributes: ['id', 'rua', 'bairro', 'cidade', 'estado', 'cep'] }
        ]
      }]
    });
    if (!transferencia) throw new Error('Transferência não encontrada');
    return transferencia.pedidos;
  }

  async iniciarTransporte(id) {
    const transaction = await db.sequelize.transaction();

    try {
      const transferencia = await db.Transferencias.findByPk(id, {
        include: [
          { model: db.Pedidos, as: 'pedidos' },
          { model: db.Transportes, as: 'transportes' }
        ],
        transaction
      });

      if (!transferencia) throw new Error('Transferência não encontrada');

      // Validar início do transporte (motorista não é mais obrigatório)
      this._validarInicioTransporte(transferencia);

      // Atualizar status da transferência
      transferencia.status = 'EM_TRANSPORTE';
      transferencia.data_inicio = new Date();
      await transferencia.save({ transaction });

      // Atualizar status dos transportes associados
      if (transferencia.transportes && transferencia.transportes.length > 0) {
        for (const transporte of transferencia.transportes) {
          transporte.status_transporte = 'EM_TRANSPORTE';
          await transporte.save({ transaction });
        }
      }

      // Atualizar status dos pedidos para "EM_TRANSPORTE"
      await db.Pedidos.update(
        { status: 'EM_TRANSPORTE' },
        { where: { transferencia_id: id }, transaction }
      );

      await transaction.commit();

      console.debug(`Transporte iniciado para transferência ${id}`);
      return transferencia;

    } catch (error) {
      await transaction.rollback();
      console.error('Erro ao iniciar transporte:', error);
      throw error;
    }
  }

  async concluirTransferencia(id) {
    const transaction = await db.sequelize.transaction();

    try {
      const transferencia = await db.Transferencias.findByPk(id, {
        include: [
          { model: db.Pedidos, as: 'pedidos' },
          { model: db.Transportes, as: 'transportes' }
        ],
        transaction
      });

      if (!transferencia) throw new Error('Transferência não encontrada');

      if (transferencia.status === 'RECEBIDO') {
        throw new Error('Transferência já está concluída');
      }

      if (transferencia.status !== 'EM_TRANSPORTE') {
        throw new Error('Só é possível concluir transferências em transporte');
      }

      // Criar manifesto automaticamente se não existir
      let manifesto = null;
      if (transferencia.pedidos && transferencia.pedidos.length > 0) {
        try {
          const ManifestosServices = require('./ManifestosServices');
          const manifestosService = new ManifestosServices();

          manifesto = await manifestosService.createManifestoFromPedidos({
            pedidosIds: transferencia.pedidos.map(p => p.id),
            origem_hub_id: transferencia.origem_hub_id,
            destino_hub_id: transferencia.destino_hub_id,
            transferencia_id: transferencia.id,
            numero_manifesto: `MAN-TO-${Date.now()}`,
            data_emissao: new Date(),
            observacoes: `Manifesto gerado automaticamente pela transferência ${transferencia.numero_TO}`
          }, { transaction });

          console.debug(`Manifesto criado: ${manifesto.id}`);
        } catch (error) {
          console.warn('Não foi possível criar manifesto automaticamente:', error.message);
        }
      }

      // Criar conferência se aplicável
      let conferencia = null;
      if (transferencia.transportes && transferencia.transportes.length > 0) {
        try {
          const ConferenciaServices = require('./ConferenciaServices');
          const conferenciaService = new ConferenciaServices();

          conferencia = await conferenciaService.createComPedidos({
            tipo: 'OUTBOUND',
            operador_id: transferencia.operador_id,
            transporte_id: transferencia.transportes[0].id, // Usar primeiro transporte
            pedidos: transferencia.pedidos.map(p => p.id),
            manifesto_id: manifesto?.id,
            nome_estacao: `Conferência ${transferencia.numero_TO}`,
            data_inicio: new Date()
          }, { transaction });

          console.debug(`Conferência criada: ${conferencia.id}`);
        } catch (error) {
          console.warn('Não foi possível criar conferência automaticamente:', error.message);
        }
      }

      // Atualizar status da transferência
      transferencia.status = 'RECEBIDO';
      transferencia.data_conclusao = new Date();
      await transferencia.save({ transaction });

      // Atualizar status dos transportes associados
      if (transferencia.transportes && transferencia.transportes.length > 0) {
        for (const transporte of transferencia.transportes) {
          transporte.status_transporte = 'RECEBIDO';
          transporte.data_conclusao = new Date();
          await transporte.save({ transaction });
        }
      }

      // Atualizar status dos pedidos
      if (transferencia.pedidos && transferencia.pedidos.length > 0) {
        const pedidoIds = transferencia.pedidos.map(pedido => pedido.id);

        await db.Pedidos.update(
          {
            status: 'ENTREGUE',
            conferencia_id: conferencia?.id,
            manifesto_id: manifesto?.id
          },
          { where: { id: pedidoIds }, transaction }
        );

        // Criar registros de rastreamento
        for (const pedido of transferencia.pedidos) {
          await db.Rastreamentos.create({
            pedido_id: pedido.id,
            status: 'ENTREGUE',
            data: new Date(),
            local: `Hub ${transferencia.destino_hub_id}`,
            observacao: 'Transferência concluída'
          }, { transaction });
        }

        console.debug(`${transferencia.pedidos.length} pedidos atualizados para ENTREGUE`);
      }

      await transaction.commit();

      console.debug(`Transferência ${id} concluída com sucesso`);

      const resultado = {
        message: "Transferência concluída com sucesso",
        transferencia,
        totalPedidos: transferencia.pedidos?.length || 0
      };

      if (manifesto) resultado.manifesto = manifesto;
      if (conferencia) resultado.conferencia = conferencia;

      return resultado;

    } catch (error) {
      await transaction.rollback();
      console.error('Erro ao concluir transferência:', error);
      throw error;
    }
  }

  async cancelarTransferencia(id, motivo) {
    const transaction = await db.sequelize.transaction();

    try {
      const transferencia = await db.Transferencias.findByPk(id, {
        include: [
          { model: db.Pedidos, as: 'pedidos' },
          { model: db.Transportes, as: 'transportes' }
        ],
        transaction
      });

      if (!transferencia) throw new Error('Transferência não encontrada');

      if (['RECEBIDO', 'CANCELADO'].includes(transferencia.status)) {
        throw new Error(`Não é possível cancelar uma transferência com status ${transferencia.status}`);
      }

      transferencia.status = 'CANCELADO';
      await transferencia.save({ transaction });

      // Atualizar status dos transportes associados
      if (transferencia.transportes && transferencia.transportes.length > 0) {
        for (const transporte of transferencia.transportes) {
          transporte.status_transporte = 'CANCELADO';
          await transporte.save({ transaction });
        }
      }

      // Reverter pedidos para status anterior
      if (transferencia.pedidos && transferencia.pedidos.length > 0) {
        const pedidoIds = transferencia.pedidos.map(pedido => pedido.id);

        await db.Pedidos.update(
          {
            status: 'VALIDADO',
            transferencia_id: null,
            transporte_id: null
          },
          { where: { id: pedidoIds }, transaction }
        );

        console.debug(`${pedidoIds.length} pedidos desvinculados da transferência cancelada`);
      }

      await transaction.commit();

      console.debug(`Transferência ${id} cancelada`);
      return transferencia;

    } catch (error) {
      await transaction.rollback();
      console.error('Erro ao cancelar transferência:', error);
      throw error;
    }
  }

  async associarMotorista(id, motoristaId) {
    const transaction = await db.sequelize.transaction();

    try {
      const transferencia = await db.Transferencias.findByPk(id, { transaction });
      if (!transferencia) throw new Error('Transferência não encontrada');

      const motorista = await db.Motoristas.findByPk(Number(motoristaId), { transaction });
      if (!motorista) throw new Error('Motorista não encontrado');

      transferencia.motorista_id = motoristaId;
      await transferencia.save({ transaction });

      // Se houver transportes associados, atualizar também
      const transportes = await db.Transportes.findAll({
        where: { transferencia_id: id },
        transaction
      });

      for (const transporte of transportes) {
        transporte.motorista_id = motoristaId;
        await transporte.save({ transaction });
      }

      await transaction.commit();

      console.debug(`Motorista ${motoristaId} associado à transferência ${id}`);
      return transferencia;

    } catch (error) {
      await transaction.rollback();
      console.error('Erro ao associar motorista:', error);
      throw error;
    }
  }

  async adicionarPedidos(id, pedidosIds) {
    const transaction = await db.sequelize.transaction();

    try {
      const transferencia = await db.Transferencias.findByPk(id, {
        include: [{ model: db.Transportes, as: 'transportes' }],
        transaction
      });

      if (!transferencia) throw new Error('Transferência não encontrada');

      if (!['CRIADO'].includes(transferencia.status)) {
        throw new Error('Só é possível adicionar pedidos a transferências com status CRIADO');
      }

      const pedidos = await db.Pedidos.findAll({
        where: {
          id: pedidosIds.map(id => Number(id)),
          status: 'VALIDADO'
        },
        transaction
      });

      if (pedidos.length !== pedidosIds.length) {
        throw new Error('Um ou mais pedidos não foram encontrados ou não estão com status válido');
      }

      // Verificar se algum pedido já está em outra transferência ativa
      const pedidosEmOutraTransferencia = await db.Pedidos.findAll({
        where: {
          id: pedidosIds.map(id => Number(id)),
          transferencia_id: {
            [Op.not]: null
          }
        },
        transaction
      });

      if (pedidosEmOutraTransferencia.length > 0) {
        throw new Error('Um ou mais pedidos já estão associados a outra transferência');
      }

      // Atualizar pedidos com a transferência
      await db.Pedidos.update(
        {
          transferencia_id: id,
          status: 'AGUARDANDO_TRANSPORTE'
        },
        { where: { id: pedidosIds.map(id => Number(id)) }, transaction }
      );

      // Se houver transporte, vincular também ao transporte
      if (transferencia.transportes && transferencia.transportes.length > 0) {
        const transporte = transferencia.transportes[0]; // Usar primeiro transporte
        await db.Pedidos.update(
          { transporte_id: transporte.id },
          { where: { id: pedidosIds.map(id => Number(id)) }, transaction }
        );
      }

      // Atualizar contagem de pedidos e peso
      const totalPedidos = await db.Pedidos.count({
        where: { transferencia_id: id },
        transaction
      });

      const pesoTotal = await db.Pedidos.sum('peso_total', {
        where: { transferencia_id: id },
        transaction
      });

      transferencia.quantidade = totalPedidos;
      transferencia.peso_kg = pesoTotal || transferencia.peso_kg;
      await transferencia.save({ transaction });

      // Atualizar transporte se existir
      if (transferencia.transportes && transferencia.transportes.length > 0) {
        const transporte = transferencia.transportes[0];
        transporte.quantidade_total = totalPedidos;
        transporte.peso_total_kg = pesoTotal || transporte.peso_total_kg;
        await transporte.save({ transaction });
      }

      await transaction.commit();

      console.debug(`${pedidosIds.length} pedidos adicionados à transferência ${id}`);
      return transferencia;

    } catch (error) {
      await transaction.rollback();
      console.error('Erro ao adicionar pedidos:', error);
      throw error;
    }
  }

  async removerPedidos(id, pedidosIds) {
    const transaction = await db.sequelize.transaction();

    try {
      const transferencia = await db.Transferencias.findByPk(id, { transaction });
      if (!transferencia) throw new Error('Transferência não encontrada');

      if (!['CRIADO'].includes(transferencia.status)) {
        throw new Error('Só é possível remover pedidos de transferências com status CRIADO');
      }

      await db.Pedidos.update(
        {
          transferencia_id: null,
          transporte_id: null,
          status: 'VALIDADO'
        },
        {
          where: {
            id: pedidosIds.map(id => Number(id)),
            transferencia_id: id
          }, transaction
        }
      );

      // Atualizar contagem de pedidos
      const totalPedidos = await db.Pedidos.count({
        where: { transferencia_id: id },
        transaction
      });

      const pesoTotal = await db.Pedidos.sum('peso_total', {
        where: { transferencia_id: id },
        transaction
      });

      transferencia.quantidade = totalPedidos;
      transferencia.peso_kg = pesoTotal || 0;
      await transferencia.save({ transaction });

      // Atualizar transporte se existir
      const transportes = await db.Transportes.findAll({
        where: { transferencia_id: id },
        transaction
      });

      for (const transporte of transportes) {
        transporte.quantidade_total = totalPedidos;
        transporte.peso_total_kg = pesoTotal || 0;
        await transporte.save({ transaction });
      }

      await transaction.commit();

      console.debug(`${pedidosIds.length} pedidos removidos da transferência ${id}`);
      return transferencia;

    } catch (error) {
      await transaction.rollback();
      console.error('Erro ao remover pedidos:', error);
      throw error;
    }
  }

  async getTransferenciasPorPeriodo(dataInicio, dataFim) {
    const where = {};

    if (dataInicio && dataFim) {
      where.data_criacao = {
        [Op.between]: [new Date(dataInicio), new Date(dataFim)]
      };
    }

    return await db.Transferencias.findAll({
      where,
      include: [
        { model: db.Hubs, as: 'origemHub', attributes: ['id', 'nome'] },
        { model: db.Hubs, as: 'destinoHub', attributes: ['id', 'nome'] },
        { model: db.Motoristas, attributes: ['id', 'nome'] }
      ],
      order: [['data_criacao', 'DESC']]
    });
  }

  async getEstatisticas() {
    const total = await db.Transferencias.count();
    const porStatus = await db.Transferencias.findAll({
      attributes: [
        'status',
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'quantidade']
      ],
      group: ['status']
    });

    const porDirecao = await db.Transferencias.findAll({
      attributes: [
        'direcao',
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'quantidade']
      ],
      group: ['direcao']
    });

    return {
      total,
      porStatus,
      porDirecao
    };
  }

  async getHubsDisponiveis() {
    return await db.Hubs.findAll({
      attributes: ['id', 'nome', 'codigo_hub']
    });
  }

  async getMotoristasDisponiveis() {
    return await db.Motoristas.findAll({
      attributes: ['id', 'nome', 'veiculo'],
      where: { ativo: true }
    });
  }

  async createFromRecebimento(recebimentoId) {
    const transaction = await db.sequelize.transaction();

    try {
      const recebimento = await db.Recebimentos.findByPk(recebimentoId, {
        include: [{ model: db.Pedidos, as: 'pedidos' }],
        transaction
      });

      if (!recebimento) throw new Error('Recebimento não encontrado');

      const transferencia = await db.Transferencias.create({
        numero_TO: `TO-REC-${Date.now()}`,
        origem_hub_id: recebimento.hub_id,
        destino_hub_id: null, // Pode ser definido posteriormente
        motorista_id: null,
        quantidade: recebimento.pedidos?.length || 0,
        direcao: 'OUTBOUND',
        status: 'CRIADO',
        data_criacao: new Date()
      }, { transaction });

      // Se houver pedidos no recebimento, associá-los à transferência
      if (recebimento.pedidos && recebimento.pedidos.length > 0) {
        const pedidoIds = recebimento.pedidos.map(pedido => pedido.id);
        await db.Pedidos.update(
          { transferencia_id: transferencia.id },
          { where: { id: pedidoIds }, transaction }
        );
      }

      await transaction.commit();

      console.debug(`Transferência criada a partir do recebimento ${recebimentoId}`);
      return transferencia;

    } catch (error) {
      await transaction.rollback();
      console.error('Erro ao criar transferência a partir do recebimento:', error);
      throw error;
    }
  }

  async searchTransferencias(query, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    try {
      const { count, rows } = await db.Transferencias.findAndCountAll({
        where: {
          [Op.or]: [
            { id: { [Op.eq]: !isNaN(query) ? parseInt(query) : 0 } },
            { numero_TO: { [Op.iLike]: `%${query}%` } },
            { status: { [Op.iLike]: `%${query}%` } },
            { '$origemHub.nome$': { [Op.iLike]: `%${query}%` } },
            { '$destinoHub.nome$': { [Op.iLike]: `%${query}%` } }
          ]
        },
        include: [
          {
            model: db.Hubs,
            as: 'origemHub',
            attributes: ['nome']
          },
          {
            model: db.Hubs,
            as: 'destinoHub',
            attributes: ['nome']
          }
        ],
        order: [['data_criacao', 'DESC']],
        limit: parseInt(limit),
        offset: offset,
        distinct: true
      });

      return {
        transferencias: rows,
        total: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit: limit
      };
    } catch (error) {
      throw new Error(`Erro na busca de transferências: ${error.message}`);
    }
  }
}

module.exports = TransferenciaServices;