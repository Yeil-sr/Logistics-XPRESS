const Services = require('./Services');
const db = require('../models');
const NotasFiscaisServices = require('./NotasFiscaisServices');
const PedidosServices = require('./PedidosServices');
const ProdutosServices = require('./ProdutosServices');

/**
 * Função para retry com SQLite, incluindo verificação de estado da transação
 */
async function withSqliteRetry(fn, attempts = 10, delayMs = 50, transaction = null) {
  let lastError;
  
  for (let i = 0; i < attempts; i++) {
    try {
      // Verificar se a transação está válida
      if (transaction && transaction.finished) {
        throw new Error(`Transação já finalizada (estado: ${transaction.finished})`);
      }
      
      const result = await fn();
      
      // Verificar se houve erro de transação após a execução
      if (transaction && transaction.finished === 'rollback') {
        throw new Error('Transação foi revertida durante a operação');
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Verificar se é erro de transação abortada ou SQLITE_BUSY
      const errorMsg = error.message || '';
      const shouldRetry = errorMsg.includes('aborted') || 
                         errorMsg.includes('SQLITE_BUSY') ||
                         errorMsg.includes('transaction') ||
                         errorMsg.includes('locked');
      
      if (shouldRetry && i < attempts - 1) {
        console.debug(`[SQLITE_RETRY] Tentativa ${i + 1}/${attempts} - Erro: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
      } else {
        // Não tentar novamente para outros erros
        throw error;
      }
    }
  }
  
  throw new Error(`Falha após ${attempts} tentativas: ${lastError?.message || 'Erro desconhecido'}`);
}

/**
 * Função para garantir uma transação válida
 */
async function ensureTransaction(transaction = null) {
  if (!transaction || transaction.finished) {
    return await db.sequelize.transaction();
  }
  return transaction;
}

/**
 * Função para rollback seguro
 */
async function safeRollback(transaction, isLocal) {
  if (isLocal && transaction && !transaction.finished) {
    try {
      console.debug('[TRANSACTION] Realizando rollback seguro...');
      await transaction.rollback();
      console.debug('[TRANSACTION] Rollback realizado com sucesso');
      return true;
    } catch (rollbackError) {
      console.error(`[TRANSACTION] Erro no rollback: ${rollbackError.message}`);
      return false;
    }
  }
  return false;
}

/**
 * Função para commit seguro
 */
async function safeCommit(transaction, isLocal) {
  if (isLocal && transaction && !transaction.finished) {
    try {
      console.debug('[TRANSACTION] Realizando commit seguro...');
      await transaction.commit();
      console.debug('[TRANSACTION] Commit realizado com sucesso');
      return true;
    } catch (commitError) {
      console.error(`[TRANSACTION] Erro no commit: ${commitError.message}`);
      return false;
    }
  }
  return false;
}

function pick(obj, keys) {
  const result = {};
  keys.forEach(key => {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  });
  return result;
}

const manifestoProcessingLocks = new Set();

let recebimentoService = null;
function getRecebimentoService() {
  if (!recebimentoService) {
    const RecebimentoServices = require('./RecebimentoServices');
    recebimentoService = new RecebimentoServices();
  }
  return recebimentoService;
}

const notasFiscaisService = new NotasFiscaisServices();
const pedidosService = new PedidosServices();
const produtosService = new ProdutosServices();

class ManifestosServices extends Services {
  constructor() {
    super('Manifestos');
  }

  async verificarTransacao(transaction) {
    if (!transaction) return false;
    
    try {
      // Verificar se a transação está finalizada
      if (transaction.finished) {
        console.debug(`[TRANSACTION] Transação finalizada com estado: ${transaction.finished}`);
        return false;
      }
      
      // Testar a transação com uma consulta simples
      await db.sequelize.query('SELECT 1', { transaction });
      return true;
    } catch (error) {
      console.error(`[TRANSACTION] Erro ao verificar transação: ${error.message}`);
      return false;
    }
  }

  normalizeManifestosArray(payload) {
    if (Array.isArray(payload.manifestosCriados)) {
      return payload.manifestosCriados;
    }
    if (Array.isArray(payload.manifestos)) {
      return payload.manifestos;
    }
    const { manifestosCriados, manifestos, ...rest } = payload;
    return Object.keys(rest).length > 0 ? [rest] : [];
  }

  /**
   * @param {Object} clienteData 
   * @param {Object} options 
   */
  async criarOuBuscarCliente(clienteData = {}, options = {}) {
    const transaction = options.transaction;

    if (clienteData.id) {
      const clienteExistente = await db.Clientes.findByPk(clienteData.id, { transaction });
      if (clienteExistente) {
        return clienteExistente;
      }
    }

    if (clienteData.cpf) {
      const clienteExistente = await db.Clientes.findOne({
        where: { cpf: clienteData.cpf },
        transaction
      });
      if (clienteExistente) {
        return clienteExistente;
      }
    }

    if (clienteData.email) {
      const clienteExistente = await db.Clientes.findOne({
        where: { email: clienteData.email },
        transaction
      });
      if (clienteExistente) {
        return clienteExistente;
      }
    }

    if (!clienteData.nome) {
      throw new Error('Nome é obrigatório para criar novo cliente');
    }

    const clienteAttributes = ['nome', 'cpf', 'email', 'telefone', 'status'];
    const clientePayload = pick(clienteData, clienteAttributes);

    clientePayload.nome = clienteData.nome;
    clientePayload.cpf = clienteData.cpf || null;
    clientePayload.email = clienteData.email || null;
    clientePayload.telefone = clienteData.telefone || null;
    clientePayload.status = clienteData.status || 'ATIVO';

    console.debug(`[Manifesto] Criando novo cliente: ${clienteData.nome}`);
    const clienteCriado = await withSqliteRetry(
      () => db.Clientes.create(clientePayload, { transaction }),
      6,
      100,
      transaction
    );
    console.debug(`[Manifesto] Cliente criado: ${clienteCriado.id}`);

    return clienteCriado;
  }

  /**
   * Cria ou busca endereço baseado nos dados fornecidos
   * @param {Object} enderecoData - Dados do endereço
   * @param {number} cliente_id - ID do cliente para associar
   * @param {Object} options - Opções incluindo transaction
   */
  async criarOuBuscarEndereco(enderecoData = {}, cliente_id = null, options = {}) {
    const transaction = options.transaction;

    if (enderecoData.id) {
      const enderecoExistente = await db.Enderecos.findByPk(enderecoData.id, { transaction });
      if (enderecoExistente) {
        return enderecoExistente;
      }
    }

    if (!enderecoData.cep || !enderecoData.rua || !enderecoData.numero) {
      throw new Error('Endereço inválido ou incompleto para criar: cep, rua e numero são obrigatórios');
    }

    const whereClause = {
      cep: enderecoData.cep,
      rua: enderecoData.rua,
      numero: enderecoData.numero
    };

    if (cliente_id) {
      whereClause.cliente_id = cliente_id;
    }

    const enderecoExistente = await db.Enderecos.findOne({
      where: whereClause,
      transaction
    });

    if (enderecoExistente) {
      return enderecoExistente;
    }

    const enderecoAttributes = ['cliente_id', 'rua', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'cep'];
    const enderecoPayload = pick(enderecoData, enderecoAttributes);

    enderecoPayload.cliente_id = cliente_id;
    enderecoPayload.rua = enderecoData.rua;
    enderecoPayload.numero = enderecoData.numero;
    enderecoPayload.cep = enderecoData.cep;
    enderecoPayload.complemento = enderecoData.complemento || null;
    enderecoPayload.bairro = enderecoData.bairro || null;
    enderecoPayload.cidade = enderecoData.cidade || null;
    enderecoPayload.estado = enderecoData.estado || null;

    console.debug(`[Manifesto] Criando novo endereço para cliente ${cliente_id}`);
    const enderecoCriado = await withSqliteRetry(
      () => db.Enderecos.create(enderecoPayload, { transaction }),
      6,
      100,
      transaction
    );
    console.debug(`[Manifesto] Endereço criado: ${enderecoCriado.id}`);

    return enderecoCriado;
  }

  async criarOuBuscarTransporte(transporteData = {}, options = {}) {
    const transaction = options.transaction;

    if (transporteData.id) {
      const transporteExistente = await db.Transportes.findByPk(transporteData.id, { transaction });
      if (transporteExistente) {
        return transporteExistente;
      }
    }

    let transporteExistente = null;

    if (transporteData.numero_transporte) {
      transporteExistente = await db.Transportes.findOne({
        where: { numero_transporte: transporteData.numero_transporte },
        transaction
      });
    }

    if (!transporteExistente && transporteData.placa_veiculo && transporteData.nome_transportador) {
      transporteExistente = await db.Transportes.findOne({
        where: {
          placa_veiculo: transporteData.placa_veiculo,
          nome_transportador: transporteData.nome_transportador
        },
        transaction
      });
    }

    if (transporteExistente) {
      console.debug(`[Manifesto] Reutilizando transporte existente: ${transporteExistente.id}`);
      return transporteExistente;
    }

    const transporteAttributes = [
      'numero_transporte', 'placa_veiculo', 'nome_transportador',
      'status_transporte', 'observacoes', 'data_saida', 'data_chegada'
    ];
    const transportePayload = pick(transporteData, transporteAttributes);

    transportePayload.numero_transporte = transporteData.numero_transporte || `TRP-${Date.now()}`;
    transportePayload.status_transporte = transporteData.status_transporte || 'PENDENTE';

    console.debug(`[Manifesto] Criando novo transporte: ${transportePayload.numero_transporte}`);
    const transporteCriado = await withSqliteRetry(
      () => db.Transportes.create(transportePayload, { transaction }),
      6,
      100,
      transaction
    );
    console.debug(`[Manifesto] Transporte criado: ${transporteCriado.id}`);

    return transporteCriado;
  }

  async getAll(filters = {}, options = {}) {
    const transaction = options.transaction;
    const where = {};

    if (filters.numero_manifesto) where.numero_manifesto = filters.numero_manifesto;
    if (filters.origem_hub_id) where.origem_hub_id = filters.origem_hub_id;
    if (filters.destino_hub_id) where.destino_hub_id = filters.destino_hub_id;
    if (filters.transporte_id) where.transporte_id = filters.transporte_id;
    if (filters.recebimento_id) where.recebimento_id = filters.recebimento_id;
    if (filters.transferencia_id) where.transferencia_id = filters.transferencia_id;

    return db.Manifestos.findAll({
      where,
      include: this.getDefaultIncludes(),
      order: [['data_emissao', 'DESC']],
      transaction
    });
  }

  async getById(id, options = {}) {
    const transaction = options.transaction;
    return db.Manifestos.findByPk(id, {
      include: this.getDefaultIncludes(),
      transaction
    });
  }

  async createManifesto(data = {}, options = {}) {
    const transaction = options.transaction;
    
    try {
      const numero_manifesto = data.numero_manifesto || `MAN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Validar dados obrigatórios
      if (!data.origem_hub_id && !data.origem_hub_nome) {
        console.warn('[Manifesto] Origem do manifesto não especificada');
      }
      
      // Verificar se número do manifesto já existe
      if (data.numero_manifesto) {
        const existingManifesto = await withSqliteRetry(
          () => db.Manifestos.findOne({
            where: { numero_manifesto: data.numero_manifesto },
            transaction
          }),
          6,
          100,
          transaction
        );
        
        if (existingManifesto) {
          throw new Error(`Já existe um manifesto com o número ${data.numero_manifesto}`);
        }
      }

      const manifestoPayload = {
        numero_manifesto,
        serie: data.serie || '1',
        data_emissao: data.data_emissao || new Date(),
        origem_hub_id: data.origem_hub_id || null,
        destino_hub_id: data.destino_hub_id || null,
        transporte_id: data.transporte_id || null,
        recebimento_id: data.recebimento_id || null,
        transferencia_id: data.transferencia_id || null,
        valor_total: data.valor_total || 0,
        quantidade_notas: data.quantidade_notas || 0,
        observacoes: data.observacoes || null,
        ...data
      };

      console.debug(`[Manifesto] Criando manifesto: ${numero_manifesto}`);
      
      const manifesto = await withSqliteRetry(
        () => db.Manifestos.create(manifestoPayload, { 
          transaction,
          validate: true // Garantir validação do modelo
        }),
        6,
        100,
        transaction
      );

      console.debug(`[Manifesto] Manifesto criado com ID: ${manifesto.id}`);
      return manifesto;
      
    } catch (error) {
      console.error(`[Manifesto] Erro ao criar manifesto: ${error.message}`);
      
      // Verificar se é erro de unicidade
      if (error.name === 'SequelizeUniqueConstraintError') {
        throw new Error(`Número de manifesto já existe: ${data.numero_manifesto}`);
      }
      
      throw error;
    }
  }

  /**
   * Cria manifesto com notas fiscais - VERSÃO REVISADA COM TRATAMENTO ROBUSTO
   */
  async createManifestoComNotas(payload = {}, options = {}) {
    const externalTx = options.transaction;
    const transaction = externalTx || await db.sequelize.transaction();
    const createdHere = !externalTx;

    console.debug(`[Manifesto] createManifestoComNotas iniciado. Transação criada localmente? ${createdHere}`);

    try {
      const { notasIds = [], ...manifestoData } = payload;

      console.debug(`[Manifesto] Notas IDs recebidas: ${notasIds.join(', ')}`);
      console.debug(`[Manifesto] Manifesto data: ${JSON.stringify(manifestoData)}`);

      // Validação básica
      if (!Array.isArray(notasIds) || notasIds.length === 0) {
        throw new Error('É necessário informar pelo menos uma nota fiscal');
      }

      // Verificar se o manifesto já existe (evitar violação de unicidade)
      if (manifestoData.numero_manifesto) {
        const existingManifesto = await withSqliteRetry(
          () => db.Manifestos.findOne({
            where: { numero_manifesto: manifestoData.numero_manifesto },
            transaction
          }),
          6,
          100,
          transaction
        );
        
        if (existingManifesto) {
          throw new Error(`Já existe um manifesto com o número ${manifestoData.numero_manifesto}`);
        }
      }

      // Buscar notas com tratamento de erro
      console.debug(`[Manifesto] Buscando notas fiscais...`);
      const notas = await withSqliteRetry(
        () => db.NotasFiscais.findAll({
          where: { id: notasIds },
          transaction
        }),
        6,
        100,
        transaction
      );

      console.debug(`[Manifesto] Notas encontradas: ${notas.length}`);

      if (notas.length !== notasIds.length) {
        const encontradosIds = notas.map(n => n.id);
        const naoEncontrados = notasIds.filter(id => !encontradosIds.includes(id));
        throw new Error(`Notas fiscais não encontradas: ${naoEncontrados.join(', ')}`);
      }

      // Verificar se alguma nota já está associada a outro manifesto
      const notasComManifesto = notas.filter(nota => nota.manifesto_id !== null);
      if (notasComManifesto.length > 0) {
        const ids = notasComManifesto.map(nota => nota.id);
        throw new Error(`As seguintes notas já estão associadas a um manifesto: ${ids.join(', ')}`);
      }

      // Calcular valor total
      const valorTotal = notas.reduce((total, nota) => {
        return total + (parseFloat(nota.valor_total) || 0);
      }, 0);

      console.debug(`[Manifesto] Valor total das notas: ${valorTotal}`);

      // Criar manifesto
      console.debug(`[Manifesto] Criando manifesto...`);
      const manifesto = await this.createManifesto({
        ...manifestoData,
        valor_total: valorTotal,
        quantidade_notas: notas.length
      }, { transaction });

      console.debug(`[Manifesto] Manifesto criado com ID: ${manifesto.id}`);

      // Associar notas ao manifesto
      console.debug(`[Manifesto] Atualizando notas com manifesto_id...`);
      await withSqliteRetry(
        () => db.NotasFiscais.update(
          { manifesto_id: manifesto.id },
          { 
            where: { id: notasIds },
            transaction,
            validate: false // Evitar validações desnecessárias
          }
        ),
        6,
        100,
        transaction
      );

      console.debug(`[Manifesto] Notas atualizadas com manifesto_id: ${manifesto.id}`);

      // Verificar se a transação ainda está ativa antes do commit
      if (createdHere) {
        const isValid = await this.verificarTransacao(transaction);
        if (isValid) {
          await safeCommit(transaction, createdHere);
          console.debug(`[Manifesto] Commit realizado com sucesso`);
        } else {
          console.error(`[Manifesto] Transação inválida antes do commit`);
          throw new Error('Transação foi abortada durante o processamento');
        }
      }

      // Buscar manifesto completo
      const manifestoCompleto = await this.getById(manifesto.id, { 
        transaction: externalTx || undefined 
      });

      console.debug(`[Manifesto] Operação concluída com sucesso.`);
      return manifestoCompleto;

    } catch (error) {
      console.error(`[Manifesto] Erro em createManifestoComNotas: ${error.message}`);
      console.error(`[Manifesto] Stack trace: ${error.stack}`);

      // Tratamento robusto da transação
      if (createdHere && transaction) {
        await safeRollback(transaction, createdHere);
      } else {
        console.debug(`[Manifesto] Transação externa, não farei rollback.`);
      }

      // Enriquecer mensagem de erro
      const mensagemErro = error.message.includes('unique constraint') 
        ? `Número de manifesto já existe: ${payload.numero_manifesto}`
        : error.message.includes('foreign key constraint')
        ? 'Erro de integridade referencial. Verifique se as notas fiscais existem.'
        : error.message.includes('aborted')
        ? 'A transação foi abortada. Verifique se há conflitos de concorrência ou dados inválidos.'
        : error.message;

      throw new Error(`Falha ao criar manifesto com notas: ${mensagemErro}`);
    }
  }

  /**
   * Associa pedidos a um manifesto existente
   * @param {number} manifestoId - ID do manifesto
   * @param {Array} pedidosIds - Array de IDs de pedidos
   * @param {Object} options - Opções incluindo transaction
   */
  async associarPedidosAoManifesto(manifestoId, pedidosIds = [], options = {}) {
    const transaction = options.transaction;

    if (!Array.isArray(pedidosIds) || pedidosIds.length === 0) {
      throw new Error('É necessário informar pelo menos um pedido para associar ao manifesto');
    }

    const pedidos = await db.Pedidos.findAll({
      where: { id: pedidosIds.map(id => Number(id)) },
      transaction
    });

    if (pedidos.length !== pedidosIds.length) {
      const encontradosIds = pedidos.map(p => p.id);
      const naoEncontrados = pedidosIds.filter(id => !encontradosIds.includes(Number(id)));
      throw new Error(`Pedidos não encontrados: ${naoEncontrados.join(', ')}`);
    }

    await db.Pedidos.update(
      { manifesto_id: manifestoId },
      { where: { id: pedidosIds }, transaction }
    );

    return { success: true, pedidosAssociados: pedidos.length };
  }

  /**
   * Cria ou busca produto baseado nos dados fornecidos
   * @param {Object} produtoData - Dados do produto
   * @param {Object} options - Opções incluindo transaction
   */
  async criarOuBuscarProduto(produtoData, options = {}) {
    const transaction = options.transaction;

    if (produtoData.id) {
      const produtoExistente = await db.Produtos.findByPk(produtoData.id, { transaction });
      if (produtoExistente) {
        return produtoExistente;
      }
    }

    if (produtoData.nome) {
      const produtoExistente = await db.Produtos.findOne({
        where: { nome: produtoData.nome },
        transaction
      });
      if (produtoExistente) {
        return produtoExistente;
      }
    }

    // Filtrar apenas atributos válidos do modelo Produtos
    const produtoAttributes = [
      'nome', 'descricao', 'preco', 'altura', 'largura', 'volume',
      'peso_kg', 'status', 'tipo_entrega', 'estoque_minimo'
    ];
    const produtoPayload = pick(produtoData, produtoAttributes);

    // Garantir valores padrão
    produtoPayload.nome = produtoData.nome;
    produtoPayload.status = produtoData.status || 'ATIVO';
    produtoPayload.tipo_entrega = produtoData.tipo_entrega || 'CAMINHAO';
    produtoPayload.estoque_minimo = produtoData.estoque_minimo || 0;

    return await produtosService.createProduto(produtoPayload, { transaction });
  }

  /**
   * Processa itens de pedido, criando produtos quando necessário
   * @param {Array} itens 
   * @param {Object} options 
   */
  async processarItensPedido(itens = [], options = {}) {
    const transaction = options.transaction;
    const itensProcessados = [];

    for (const item of itens) {
      let produtoId = item.produto_id;

      if (item.produto && !produtoId) {
        console.debug(`[Manifesto] Criando produto: ${item.produto.nome}`);
        const produtoCriado = await this.criarOuBuscarProduto(item.produto, { transaction });
        produtoId = produtoCriado.id;
        console.debug(`[Manifesto] Produto criado/obtido: ${produtoCriado.id} - ${produtoCriado.nome}`);
      }

      if (!produtoId) {
        throw new Error('Item sem produto_id válido e sem dados para criar produto');
      }

      const produtoExistente = await db.Produtos.findByPk(produtoId, { transaction });
      if (!produtoExistente) {
        throw new Error(`Produto com ID ${produtoId} não encontrado`);
      }

      itensProcessados.push({
        ...item,
        produto_id: produtoId
      });
    }

    return itensProcessados;
  }

  /**
   * Cria pedido com itens processados, incluindo cliente e endereço
   * @param {Object} pedidoData - Dados do pedido
   * @param {Object} options - Opções incluindo transaction e usuario_id
   */
  async criarPedidoComItens(pedidoData, options = {}) {
    const transaction = options.transaction;

    try {
      let clienteId = pedidoData.cliente_id;
      let enderecoId = pedidoData.endereco_id;

      if (pedidoData.cliente && !clienteId) {
        console.debug(`[Manifesto] Processando cliente para pedido: ${pedidoData.codigo_pedido}`);
        const clienteProcessado = await this.criarOuBuscarCliente(pedidoData.cliente, { transaction });
        clienteId = clienteProcessado.id;
        console.debug(`[Manifesto] Cliente processado: ${clienteId}`);
      }

      if (!clienteId) {
        clienteId = options.cliente_id || pedidoData.cliente_id || process.env.SYSTEM_CLIENTE_ID || 1;
      }

      if (pedidoData.endereco && !enderecoId) {
        console.debug(`[Manifesto] Processando endereço para pedido: ${pedidoData.codigo_pedido}`);
        const enderecoProcessado = await this.criarOuBuscarEndereco(
          pedidoData.endereco,
          clienteId,
          { transaction }
        );
        enderecoId = enderecoProcessado.id;
        console.debug(`[Manifesto] Endereço processado: ${enderecoId}`);
      }

      const itensProcessados = await this.processarItensPedido(pedidoData.itens, { transaction });

      const pedidoPayload = {
        codigo_pedido: pedidoData.codigo_pedido,
        cliente_id: clienteId,
        endereco_id: enderecoId,
        status: pedidoData.status || 'PENDENTE',
        itens: itensProcessados,
        gerarNota: true,
        usuario_id: options.usuario_id
      };

      console.debug(`[Manifesto] Criando pedido: ${pedidoData.codigo_pedido}`);
      const resultado = await pedidosService.createPedidoComItensENota(pedidoPayload, {
        transaction,
        usuario_id: options.usuario_id
      });

      return resultado.pedido || resultado;
    } catch (error) {
      throw new Error(`Erro ao criar pedido ${pedidoData.codigo_pedido}: ${error.message}`);
    }
  }

  /**
   * Cria recebimento automaticamente para manifesto INBOUND
   * @param {Object} manifesto - Instância do manifesto
   * @param {Object} payload - Payload original
   * @param {Object} options - Opções incluindo transaction
   */
  async criarRecebimentoParaManifesto(manifesto, payload, options = {}) {
    const transaction = options.transaction;

    try {
      const pedidosCount = await db.Pedidos.count({
        where: { manifesto_id: manifesto.id },
        transaction
      });

      const recebimentoData = {
        numero_manifesto: payload.recebimento?.numero_manifesto || `TO-${Date.now()}`,
        manifesto_id: manifesto.id,
        serie: payload.recebimento?.serie,
        numero_recebimento: payload.recebimento?.numero_recebimento,
        numero_romaneio: payload.recebimento?.numero_romaneio,
        localizacao: payload.localizacao?.localizacao,
        observacoes: payload.observacoes?.observacoes,
        operador_id: payload.usuario_id || payload.operador_id,
        origem_hub_id: payload.origem_hub_id,
        destino_hub_id: payload.destino_hub_id,
        tipo_recebedor: payload.recebimento?.tipo_recebedor || 'HUB',
        quantidade_pedidos: payload.recebimento?.quantidade_pedidos || pedidosCount,
        peso_kg: payload.recebimento?.peso_kg || 0,
        direcao: payload.tipo || 'INBOUND',
        status: 'CRIADO',
        data_criacao: new Date(),
        ...payload.recebimento
      };

      console.debug(`[Manifesto] Criando recebimento para manifesto ${manifesto.id}`);
      const recebimento = await withSqliteRetry(
        () => db.Recebimentos.create(recebimentoData, { transaction }),
        6,
        100,
        transaction
      );

      await db.Manifestos.update(
        { recebimento_id: recebimento.id },
        { where: { id: manifesto.id }, transaction }
      );

      return recebimento;
    } catch (error) {
      throw new Error(`Erro ao criar recebimento: ${error.message}`);
    }
  }

  /**
   * Cria transferência automaticamente para manifesto OUTBOUND
   * @param {Object} manifesto - Instância do manifesto
   * @param {Object} payload - Payload original
   * @param {Object} options - Opções incluindo transaction
   */
  async criarTransferenciaParaManifesto(manifesto, payload, options = {}) {
    const transaction = options.transaction;

    try {
      const pedidosCount = await db.Pedidos.count({
        where: { manifesto_id: manifesto.id },
        transaction
      });

      const transferenciaData = {
        numero_to: payload.transferencia?.numero_to || `TO-${Date.now()}`,
        manifesto_id: manifesto.id,
        operador_id: payload.usuario_id || payload.operador_id,
        origem_hub_id: payload.origem_hub_id,
        destino_hub_id: payload.destino_hub_id,
        tipo_recebedor: payload.transferencia?.tipo_recebedor || 'HUB',
        quantidade: payload.transferencia?.quantidade || pedidosCount,
        peso_kg: payload.transferencia?.peso_kg || 0,
        direcao: payload.tipo || 'OUTBOUND',
        status: 'CRIADO',
        data_criacao: new Date(),
        ...payload.transferencia
      };

      console.debug(`[Manifesto] Criando transferência para manifesto ${manifesto.id}`);
      const transferencia = await withSqliteRetry(
        () => db.Transferencias.create(transferenciaData, { transaction }),
        6,
        100,
        transaction
      );

      await db.Manifestos.update(
        { transferencia_id: transferencia.id },
        { where: { id: manifesto.id }, transaction }
      );

      return transferencia;
    } catch (error) {
      throw new Error(`Erro ao criar transferência: ${error.message}`);
    }
  }

  /**
   * Cria manifesto e processa automaticamente Recebimento/Transferência
   * Versão reformulada que cria tudo em uma única transação
   * @param {Object} payload - Dados do manifesto e processamento
   * @param {Object} options - Opções incluindo transaction
   */
  async createManifestoAndProcess(payload = {}, options = {}) {
    const manifestosArray = this.normalizeManifestosArray(payload);
    const externalTx = options.transaction;
    const transaction = externalTx || await db.sequelize.transaction();
    const createdHere = !externalTx;
    const manifestosCriadosResultado = [];

    try {
      for (const manifestoData of manifestosArray) {
        const requestKey = manifestoData.numero_manifesto || payload.request_id || `req-${Date.now()}-${Math.random()}`;
        if (manifestoProcessingLocks.has(requestKey)) {
          console.debug(`[Manifesto] Processamento já em andamento para ${requestKey}`);
          throw new Error(`Processamento em andamento para ${requestKey}`);
        }

        try {
          manifestoProcessingLocks.add(requestKey);
          console.debug(`[Manifesto] Lock adquirido para ${requestKey}`);

          const { pedidosIds = [], pedidosCodigos = [], pedidos = [], createMissingPedidos = false, pedidosItens = {}, pedidosMeta = {}, tipo = 'OUTBOUND', cliente_id, usuario_id, operador_id, allowEmpty = false, forceCreate = false, recebimento = {}, transferencia = {}, ...manifestoPayload } = manifestoData;
          console.debug(`[Manifesto] Iniciando createManifestoAndProcess com tipo: ${tipo}, manifesto: ${manifestoPayload.numero_manifesto || 'sem-numero'}`);

          const uidToUse = usuario_id || operador_id || process.env.SYSTEM_USER_ID || 1;
          const clienteIdToUse = cliente_id || process.env.SYSTEM_CLIENTE_ID || 1;

          // Verificar se o manifesto já existe
          if (manifestoPayload.numero_manifesto && !forceCreate) {
            const existingManifesto = await db.Manifestos.findOne({
              where: { numero_manifesto: manifestoPayload.numero_manifesto },
              transaction
            });
            if (existingManifesto) {
              console.debug(`[Manifesto] Manifesto já existe: ${existingManifesto.id}`);
              manifestosCriadosResultado.push(existingManifesto);
              continue;
            }
          }

          // Processar hubs de origem e destino do manifesto
          let origemHubId = manifestoPayload.origem_hub_id || null;
          let destinoHubId = manifestoPayload.destino_hub_id || null;

          if (manifestoPayload.origem_hub_nome && !origemHubId) {
            const hub = await this.criarOuBuscarHubPorNome(manifestoPayload.origem_hub_nome, { transaction });
            origemHubId = hub ? hub.id : null;
          }

          if (manifestoPayload.destino_hub_nome && !destinoHubId) {
            const hub = await this.criarOuBuscarHubPorNome(manifestoPayload.destino_hub_nome, { transaction });
            destinoHubId = hub ? hub.id : null;
          }

          const todosPedidos = [
            ...pedidosIds.map(id => ({ type: 'id', value: id })),
            ...pedidosCodigos.map(codigo => ({ type: 'codigo', value: codigo })),
            ...pedidos.map(pedido => ({ type: 'objeto', value: pedido }))
          ];

          const pedidosToProcess = [];
          const pedidosEncontrados = [];
          const pedidosCriados = [];
          console.debug(`[Manifesto] Processando ${todosPedidos.length} pedidos para manifesto ${manifestoPayload.numero_manifesto || 'novo'}`);

          for (const pedidoInfo of todosPedidos) {
            let pedido;
            if (pedidoInfo.type === 'id') {
              pedido = await db.Pedidos.findByPk(pedidoInfo.value, { include: this.getPedidoIncludes(), transaction });
              if (!pedido && createMissingPedidos) {
                const codigoPedido = `PED${pedidoInfo.value}`;
                const itensParaCriar = pedidosItens[codigoPedido] || [];
                const meta = pedidosMeta[codigoPedido] || {};
                console.debug(`[Manifesto] Usando pedidosMeta para criar pedido por ID: ${codigoPedido}`, meta.cliente ? 'com cliente' : 'sem cliente', meta.endereco ? 'com endereco' : 'sem endereco');
                pedido = await this.criarPedidoComItens({
                  codigo_pedido: codigoPedido,
                  cliente_id: clienteIdToUse,
                  itens: itensParaCriar,
                  cliente: meta.cliente,
                  endereco: meta.endereco
                }, { transaction, usuario_id: uidToUse });
                pedidosCriados.push(pedido.id);
              }
            } else if (pedidoInfo.type === 'codigo') {
              pedido = await db.Pedidos.findOne({
                where: { codigo_pedido: pedidoInfo.value },
                include: this.getPedidoIncludes(),
                transaction
              });
              if (!pedido && createMissingPedidos) {
                const itensParaCriar = pedidosItens[pedidoInfo.value] || [];
                const meta = pedidosMeta[pedidoInfo.value] || {};
                console.debug(`[Manifesto] Usando pedidosMeta para criar pedido por código: ${pedidoInfo.value}`, meta.cliente ? 'com cliente' : 'sem cliente', meta.endereco ? 'com endereco' : 'sem endereco');
                pedido = await this.criarPedidoComItens({
                  codigo_pedido: pedidoInfo.value,
                  cliente_id: clienteIdToUse,
                  itens: itensParaCriar,
                  cliente: meta.cliente,
                  endereco: meta.endereco
                }, { transaction, usuario_id: uidToUse });
                pedidosCriados.push(pedido.id);
              }
            } else if (pedidoInfo.type === 'objeto') {
              const pedidoObj = pedidoInfo.value;
              if (pedidoObj.id) {
                pedido = await db.Pedidos.findByPk(pedidoObj.id, { include: this.getPedidoIncludes(), transaction });
              } else if (pedidoObj.codigo_pedido) {
                pedido = await db.Pedidos.findOne({
                  where: { codigo_pedido: pedidoObj.codigo_pedido },
                  include: this.getPedidoIncludes(),
                  transaction
                });
              }
              if (!pedido && createMissingPedidos) {
                const meta = pedidosMeta[pedidoObj.codigo_pedido] || {};
                console.debug(`[Manifesto] Usando pedidosMeta para criar pedido por objeto: ${pedidoObj.codigo_pedido}`, meta.cliente ? 'com cliente' : 'sem cliente', meta.endereco ? 'com endereco' : 'sem endereco');
                const pedidoParaCriar = {
                  ...pedidoObj,
                  cliente_id: pedidoObj.cliente_id || clienteIdToUse,
                  cliente: pedidoObj.cliente || meta.cliente,
                  endereco: pedidoObj.endereco || meta.endereco
                };
                pedido = await this.criarPedidoComItens(pedidoParaCriar, { transaction, usuario_id: uidToUse });
                pedidosCriados.push(pedido.id);
              }
            }
            if (!pedido) {
              throw new Error(`Pedido não encontrado: ${JSON.stringify(pedidoInfo)}`);
            }
            pedidosToProcess.push(pedido);
            pedidosEncontrados.push(pedido.id);
          }

          if (pedidosToProcess.length === 0 && !allowEmpty) {
            throw new Error('Nenhum pedido válido encontrado ou criado para o manifesto');
          }
          console.debug(`[Manifesto] Pedidos processados: ${pedidosToProcess.length} (${pedidosCriados.length} criados)`);

          const notaIds = [];
          let valorTotal = 0;
          for (const pedido of pedidosToProcess) {
            let nota = pedido.nota && pedido.nota.length > 0 ? pedido.nota[0] : null;
            if (!nota) {
              console.debug(`[Manifesto] Criando nota para pedido ${pedido.id}`);
              try {
                if (!pedido.itens || pedido.itens.length === 0) {
                  const pedidoComItens = await db.Pedidos.findByPk(pedido.id, {
                    include: [{
                      model: db.PedidoItens,
                      as: 'itens',
                      include: [{ model: db.Produtos, as: 'produtos', attributes: ['id', 'nome', 'peso_kg', 'preco'] }]
                    }],
                    transaction
                  });
                  pedido.itens = pedidoComItens.itens;
                }
                nota = await notasFiscaisService.createNotaParaPedido(pedido, { transaction });
              } catch (error) {
                if (error.message.includes('produto') || error.message.includes('Produto')) {
                  console.debug(`[Manifesto] Recriando itens do pedido ${pedido.id} para garantir produtos`);
                  const itensProcessados = await this.processarItensPedido(pedido.itens.map(item => ({
                    produto_id: item.produto_id,
                    produto: item.produtos,
                    quantidade: item.quantidade,
                    valor_unitario: item.valor_unitario,
                    descricao: item.descricao
                  })), { transaction });
                  await db.PedidoItens.destroy({ where: { pedido_id: pedido.id }, transaction });
                  const novosItens = itensProcessados.map(item => ({
                    pedido_id: pedido.id,
                    produto_id: item.produto_id,
                    quantidade: item.quantidade,
                    valor_unitario: item.valor_unitario,
                    valor_total: item.quantidade * item.valor_unitario,
                    descricao: item.descricao
                  }));
                  await db.PedidoItens.bulkCreate(novosItens, { transaction });
                  const pedidoAtualizado = await db.Pedidos.findByPk(pedido.id, {
                    include: [{
                      model: db.PedidoItens,
                      as: 'itens',
                      include: [{ model: db.Produtos, as: 'produtos', attributes: ['id', 'nome', 'peso_kg', 'preco'] }]
                    }],
                    transaction
                  });
                  nota = await notasFiscaisService.createNotaParaPedido(pedidoAtualizado, { transaction });
                } else {
                  throw error;
                }
              }
            }
            if (nota) {
              notaIds.push(nota.id);
              const valorNota = parseFloat(nota.valor_total) || 0;
              valorTotal += valorNota;
              console.debug(`[Manifesto] Nota ${nota.id} valor: R$ ${valorNota.toFixed(2)}`);
            }
          }

          if (notaIds.length === 0 && !allowEmpty) {
            throw new Error('Não foi possível criar notas fiscais para os pedidos');
          }
          console.debug(`[Manifesto] Total de notas: ${notaIds.length}, Valor total: R$ ${valorTotal.toFixed(2)}`);

          // Criar manifesto com origem/destino
          const manifesto = await this.createManifesto({
            ...manifestoPayload,
            origem_hub_id: origemHubId,
            destino_hub_id: destinoHubId,
            valor_total: valorTotal,
            quantidade_notas: notaIds.length
          }, { transaction });

          if (notaIds.length > 0) {
            await db.NotasFiscais.update({ manifesto_id: manifesto.id }, {
              where: { id: notaIds },
              transaction
            });
          }

          if (pedidosEncontrados.length > 0) {
            await db.Pedidos.update({ manifesto_id: manifesto.id }, {
              where: { id: pedidosEncontrados },
              transaction
            });
          }

          let recebimentoCriado = null;
          let transferenciaCriada = null;
          if (tipo === 'INBOUND') {
            console.debug(`[Manifesto] Criando recebimento automático para INBOUND`);
            recebimentoCriado = await this.criarRecebimentoParaManifesto(manifesto, { ...payload, ...manifestoData }, { transaction });
          } else {
            console.debug(`[Manifesto] Criando transferência automática para ${tipo}`);
            transferenciaCriada = await this.criarTransferenciaParaManifesto(manifesto, { ...payload, ...manifestoData }, { transaction });
          }

          const manifestoFull = await this.getById(manifesto.id, { transaction: externalTx || undefined });
          manifestoFull.dataValues.pedidosProcessados = {
            total: pedidosToProcess.length,
            encontrados: pedidosEncontrados.length - pedidosCriados.length,
            criados: pedidosCriados.length,
            idsCriados: pedidosCriados
          };

          if (recebimentoCriado) {
            manifestoFull.dataValues.recebimento = recebimentoCriado;
          }

          if (transferenciaCriada) {
            manifestoFull.dataValues.transferencia = transferenciaCriada;
          }

          manifestosCriadosResultado.push(manifestoFull);
          console.debug(`[Manifesto] Manifesto ${manifesto.id} processado com sucesso`);
        } finally {
          manifestoProcessingLocks.delete(requestKey);
          console.debug(`[Manifesto] Lock liberado para ${requestKey}`);
        }
      }

      if (manifestosArray.length === 0) {
        console.debug(`[Manifesto] Nenhum manifesto no array, usando payload como manifesto único`);
        const requestKey = payload.numero_manifesto || payload.request_id || `req-${Date.now()}-${Math.random()}`;
        if (manifestoProcessingLocks.has(requestKey)) {
          console.debug(`[Manifesto] Processamento já em andamento para ${requestKey}`);
          throw new Error(`Processamento em andamento para ${requestKey}`);
        }

        try {
          manifestoProcessingLocks.add(requestKey);
          console.debug(`[Manifesto] Lock adquirido para ${requestKey}`);
          const manifestoFull = await this._createManifestoFromPedidosOriginal(payload, { transaction });
          manifestosCriadosResultado.push(manifestoFull);
        } finally {
          manifestoProcessingLocks.delete(requestKey);
          console.debug(`[Manifesto] Lock liberado para ${requestKey}`);
        }
      }

      if (createdHere) {
        await safeCommit(transaction, createdHere);
      }

      const resultado = { success: true };
      resultado.dataValues = { manifestosCriados: manifestosCriadosResultado };
      console.debug(`[Manifesto] Processo concluído com sucesso: ${manifestosCriadosResultado.length} manifesto(s) criado(s)`);
      return resultado;
    } catch (error) {
      console.error(`[Manifesto] Erro no processamento: ${error.message}`);
      if (createdHere) {
        await safeRollback(transaction, createdHere);
      }
      throw error;
    }
  }

  async criarOuBuscarHubPorNome(nome, options = {}) {
    const transaction = options.transaction;

    if (!nome || typeof nome !== 'string' || nome.trim() === '') {
      console.debug('[Manifesto] Nome de hub vazio ou inválido fornecido');
      return null;
    }

    const nomeNormalizado = nome.trim();
    console.debug(`[Manifesto] Buscando/criando hub por nome: ${nomeNormalizado}`);

    try {
      // Primeiro, tentar buscar por nome exato
      let hub = await db.Hubs.findOne({
        where: { nome: nomeNormalizado },
        transaction
      });

      if (!hub) {
        console.debug(`[Manifesto] Hub não encontrado, criando automaticamente: ${nomeNormalizado}`);

        // Tentar buscar por código similar
        hub = await db.Hubs.findOne({
          where: db.sequelize.where(
            db.sequelize.fn('LOWER', db.sequelize.col('nome')),
            db.sequelize.fn('LOWER', nomeNormalizado)
          ),
          transaction
        });

        if (!hub) {
          // Criar novo hub automaticamente
          const hubsService = require('./HubsServices');
          const hubServiceInstance = new hubsService();

          // Gerar código único para o hub
          const codigoHub = `HUB-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

          hub = await hubServiceInstance.create({
            nome: nomeNormalizado,
            codigo_hub: codigoHub,
            status: 'ATIVO',
            tipo: 'DISTRIBUICAO'
          }, { transaction });

          console.debug(`[Manifesto] Hub criado automaticamente: ${hub.id} - ${hub.nome}`);
        } else {
          console.debug(`[Manifesto] Hub encontrado por nome similar: ${hub.id} - ${hub.nome}`);
        }
      } else {
        console.debug(`[Manifesto] Hub encontrado: ${hub.id} - ${hub.nome}`);
      }

      return hub;
    } catch (error) {
      console.error(`[Manifesto] Erro ao buscar/criar hub ${nomeNormalizado}:`, error);
      // Em caso de erro, retornar null para não quebrar o fluxo
      return null;
    }
  }

  /**
   * Método principal atualizado - mantém compatibilidade
   * @param {Object} payload - Dados do manifesto
   * @param {Object} options - Opções incluindo transaction
   */
  async createManifestoFromPedidos(payload = {}, options = {}) {
    // Se não tem tipo específico, usar comportamento original
    if (!payload.tipo) {
      return await this._createManifestoFromPedidosOriginal(payload, options);
    }

    // Se tem tipo, usar novo processo completo
    return await this.createManifestoAndProcess(payload, options);
  }

  /**
   * Comportamento original do método (para compatibilidade)
   * @param {Object} payload - Dados do manifesto
   * @param {Object} options - Opções incluindo transaction
   */
  async _createManifestoFromPedidosOriginal(payload = {}, options = {}) {
    const externalTx = options.transaction;
    const transaction = externalTx || await db.sequelize.transaction();
    const createdHere = !externalTx;

    try {
      const {
        pedidosIds = [],
        pedidosCodigos = [],
        createMissingPedidos = false,
        usuario_id,
        allowEmpty = false,
        forceCreate = false,
        ...manifestoData
      } = payload;

      console.debug(`[Manifesto] Iniciando criação com transaction: ${transaction.id}`);

      // Validar que há pedidos para processar
      if ((!Array.isArray(pedidosIds) || pedidosIds.length === 0) &&
        (!Array.isArray(pedidosCodigos) || pedidosCodigos.length === 0)) {
        if (!allowEmpty) {
          throw new Error('É necessário informar pelo menos um pedido (IDs ou códigos) para criar o manifesto');
        }
      }

      // Verificar se manifesto já existe
      if (manifestoData.numero_manifesto && !forceCreate) {
        const existingManifesto = await db.Manifestos.findOne({
          where: { numero_manifesto: manifestoData.numero_manifesto },
          transaction
        });

        if (existingManifesto) {
          console.debug(`[Manifesto] Manifesto já existe: ${existingManifesto.id}`);
          if (createdHere) await safeCommit(transaction, createdHere);

          const resultado = { success: true };
          resultado.dataValues = { manifestosCriados: [existingManifesto] };
          return resultado;
        }
      }

      const pedidosToProcess = [];
      const pedidosEncontrados = [];
      const pedidosCriados = [];
      const uidToUse = usuario_id || process.env.SYSTEM_USER_ID || 1;
      const clienteIdToUse = payload.cliente_id || process.env.SYSTEM_CLIENTE_ID || 1;

      console.debug(`[Manifesto] UID para criação: ${uidToUse}, Pedidos a processar: ${pedidosIds.length} IDs, ${pedidosCodigos.length} códigos`);

      // Processar pedidos por IDs
      if (Array.isArray(pedidosIds) && pedidosIds.length > 0) {
        const pedidosByIds = await db.Pedidos.findAll({
          where: { id: pedidosIds.map(id => Number(id)) },
          include: this.getPedidoIncludes(),
          transaction
        });

        if (pedidosByIds.length !== pedidosIds.length) {
          const encontradosIds = pedidosByIds.map(p => p.id);
          const naoEncontrados = pedidosIds.filter(id => !encontradosIds.includes(Number(id)));
          throw new Error(`Pedidos por ID não encontrados: ${naoEncontrados.join(', ')}`);
        }

        pedidosToProcess.push(...pedidosByIds);
        pedidosEncontrados.push(...pedidosByIds.map(p => p.id));
      }

      // Processar pedidos por códigos
      if (Array.isArray(pedidosCodigos) && pedidosCodigos.length > 0) {
        for (const codigo of pedidosCodigos) {
          let pedido = await db.Pedidos.findOne({
            where: { codigo_pedido: codigo },
            include: this.getPedidoIncludes(),
            transaction
          });

          // Se pedido não existe e createMissingPedidos é true, criar automaticamente
          if (!pedido && createMissingPedidos) {
            try {
              console.debug(`[Manifesto] Criando pedido ausente: ${codigo}`);

              const pedidoData = {
                codigo_pedido: codigo,
                status: 'PENDENTE',
                cliente_id: clienteIdToUse,
                usuario_id: uidToUse
              };

              // Se houver itens específicos para este código no payload, incluí-los
              if (payload.pedidosItens && payload.pedidosItens[codigo]) {
                pedidoData.itens = payload.pedidosItens[codigo];
              }

              // Se houver dados de cliente/endereco específicos para este código
              if (payload.pedidosMeta && payload.pedidosMeta[codigo]) {
                pedidoData.cliente = payload.pedidosMeta[codigo].cliente;
                pedidoData.endereco = payload.pedidosMeta[codigo].endereco;
              }

              pedido = await this.criarPedidoComItens(pedidoData, {
                transaction,
                usuario_id: uidToUse,
                cliente_id: clienteIdToUse
              });

              pedidosCriados.push(pedido.id);
              console.debug(`[Manifesto] Pedido criado: ${pedido.id} (${codigo})`);
            } catch (error) {
              throw new Error(`Erro ao criar pedido ${codigo}: ${error.message}`);
            }
          } else if (!pedido) {
            throw new Error(`Pedido com código ${codigo} não encontrado e createMissingPedidos é false`);
          }

          if (pedido) {
            pedidosToProcess.push(pedido);
            pedidosEncontrados.push(pedido.id);
          }
        }
      }

      if (pedidosToProcess.length === 0 && !allowEmpty) {
        throw new Error('Nenhum pedido válido encontrado ou criado para o manifesto');
      }

      console.debug(`[Manifesto] Pedidos processados: ${pedidosToProcess.length} (${pedidosCriados.length} criados)`);

      const notaIds = [];
      let valorTotal = 0;

      // Para cada pedido, garantir que existe uma nota fiscal
      for (const pedido of pedidosToProcess) {
        let nota = pedido.nota && pedido.nota.length > 0 ? pedido.nota[0] : null;

        if (!nota) {
          console.debug(`[Manifesto] Criando nota para pedido ${pedido.id}`);
          nota = await notasFiscaisService.createNotaParaPedido(pedido, { transaction });
        }

        if (nota) {
          notaIds.push(nota.id);
          const valorNota = parseFloat(nota.valor_total) || 0;
          valorTotal += valorNota;
          console.debug(`[Manifesto] Nota ${nota.id} valor: R$ ${valorNota.toFixed(2)}`);
        }
      }

      if (notaIds.length === 0 && !allowEmpty) {
        throw new Error('Não foi possível criar notas fiscais para os pedidos');
      }

      console.debug(`[Manifesto] Total de notas: ${notaIds.length}, Valor total: R$ ${valorTotal.toFixed(2)}`);

      // Criar o manifesto
      const manifesto = await this.createManifesto({
        ...manifestoData,
        valor_total: valorTotal,
        quantidade_notas: notaIds.length
      }, { transaction });

      // Associar notas ao manifesto
      if (notaIds.length > 0) {
        await db.NotasFiscais.update(
          { manifesto_id: manifesto.id },
          { where: { id: notaIds }, transaction }
        );
      }

      // Associar pedidos ao manifesto
      if (pedidosEncontrados.length > 0) {
        await db.Pedidos.update(
          { manifesto_id: manifesto.id },
          { where: { id: pedidosEncontrados }, transaction }
        );
      }

      if (createdHere) await safeCommit(transaction, createdHere);

      const manifestoFull = await this.getById(manifesto.id, { transaction: externalTx || undefined });

      // Adicionar informações extras ao resultado
      manifestoFull.dataValues.pedidosProcessados = {
        total: pedidosToProcess.length,
        encontrados: pedidosEncontrados.length - pedidosCriados.length,
        criados: pedidosCriados.length,
        idsCriados: pedidosCriados
      };

      const resultado = { success: true };
      resultado.dataValues = { manifestosCriados: [manifestoFull] };

      console.debug(`[Manifesto] Manifesto criado com sucesso: ${manifesto.id}`);
      return resultado;
    } catch (error) {
      console.error(`[Manifesto] Erro na criação: ${error.message}`);
      if (createdHere) {
        await safeRollback(transaction, createdHere);
      }
      throw error;
    }
  }

  /**
   * Atualiza manifesto (aceita transaction em options)
   * @param {number} id - ID do manifesto
   * @param {Object} updates - Dados para atualização
   * @param {Object} options - Opções incluindo transaction
   */
  async updateManifesto(id, updates = {}, options = {}) {
    const transaction = options.transaction;
    await db.Manifestos.update(updates, {
      where: { id },
      transaction,
      returning: true
    });
    return this.getById(id, { transaction });
  }

  /**
   * Deleta manifesto. Opção de transaction em options.
   * Antes de deletar, desassocia notas e pedidos.
   * @param {number} id - ID do manifesto
   * @param {Object} options - Opções incluindo transaction
   */
  async deleteManifesto(id, options = {}) {
    const transaction = options.transaction;

    // desassociar notas
    await db.NotasFiscais.update(
      { manifesto_id: null },
      { where: { manifesto_id: id }, transaction }
    );

    // desassociar pedidos
    await db.Pedidos.update(
      { manifesto_id: null },
      { where: { manifesto_id: id }, transaction }
    );

    return db.Manifestos.destroy({ where: { id }, transaction });
  }

  /**
   * Busca manifesto por número
   * @param {string} numero_manifesto - Número do manifesto
   * @param {Object} options - Opções incluindo transaction
   */
  async findByNumero(numero_manifesto, options = {}) {
    const transaction = options.transaction;
    return db.Manifestos.findOne({
      where: { numero_manifesto },
      include: this.getDefaultIncludes(),
      transaction
    });
  }

  /**
   * Retorna includes padrão para compatibilidade com frontend
   */
  getDefaultIncludes() {
    return [
      {
        model: db.Hubs,
        as: 'origemHub',
        attributes: ['id', 'nome'],
        include: [{
          model: db.Enderecos,
          as: 'enderecos',
          attributes: ['id', 'rua', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'cep']
        }]
      },
      {
        model: db.Hubs,
        as: 'destinoHub',
        attributes: ['id', 'nome'],
        include: [{
          model: db.Enderecos,
          as: 'enderecos',
          attributes: ['id', 'rua', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'cep']
        }]
      },
      {
        model: db.Transportes,
        as: 'transportes',
        attributes: ['id', 'numero_transporte', 'status_transporte']
      },
      {
        model: db.Recebimentos,
        as: 'recebimentos',
        attributes: ['id', 'numero_recebimento', 'status', 'quantidade_pedidos', 'data_criacao']
      },
      {
        model: db.Transferencias,
        as: 'transferencias',
        attributes: ['id', 'numero_to', 'status', 'quantidade', 'peso_kg', 'data_criacao']
      },
      {
        model: db.NotasFiscais,
        as: 'nota',
        include: [{
          model: db.NotasItens,
          as: 'notaItens',
          include: [{
            model: db.Produtos,
            as: 'produtos',
            attributes: ['id', 'nome', 'descricao']
          }]
        }]
      },
      {
        model: db.Pedidos,
        as: 'pedidos',
        include: [
          {
            model: db.Clientes,
            as: 'clientes',
            attributes: ['id', 'nome', 'telefone', 'email']
          },
          {
            model: db.Enderecos,
            as: 'enderecos',
            attributes: ['id', 'rua', 'numero', 'complemento', 'cidade', 'estado', 'cep']
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
      }
    ];
  }

  /**
   * Retorna includes para pedidos
   */
  getPedidoIncludes() {
    return [
      {
        model: db.PedidoItens,
        as: 'itens',
        include: [{
          model: db.Produtos,
          as: 'produtos',
          attributes: ['id', 'nome', 'peso_kg', 'preco']
        }]
      },
      {
        model: db.NotasFiscais,
        as: 'nota'
      },
      {
        model: db.Clientes,
        as: 'clientes',
        attributes: ['id', 'nome']
      }
    ];
  }
}

module.exports = ManifestosServices;