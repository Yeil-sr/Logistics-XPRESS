const Services = require('./Services');
const db = require('../models');

class NotasFiscaisServices extends Services {
  constructor() {
    super('NotasFiscais');
  }

  _filterModelAttributes(modelName, payload) {
    const model = db[modelName];
    if (!model || !model.rawAttributes) return payload;

    const modelAttributes = Object.keys(model.rawAttributes);
    const filtered = {};

    Object.keys(payload).forEach(key => {
      if (modelAttributes.includes(key)) {
        filtered[key] = payload[key];
      } else {
        console.warn(`Atributo '${key}' filtrado - não definido no modelo ${modelName}`);
      }
    });

    return filtered;
  }

  async _getByIdWithTransaction(id, transaction = null) {
    const options = {
      include: [
        {
          model: db.NotasItens,
          as: 'notaItens',
          include: [{
            model: db.Produtos,
            as: 'produtos'
          }]
        },
        {
          model: db.Manifestos,
          as: 'manifesto'
        }
      ]
    };

    if (transaction) {
      options.transaction = transaction;
    }

    return db.NotasFiscais.findByPk(id, options);
  }

  async getAll(filters = {}) {
    const where = {};
    if (filters.pedido_id) where.pedido_id = filters.pedido_id;
    if (filters.numero) where.numero = filters.numero;

    return db.NotasFiscais.findAll({
      where,
      include: [
        {
          model: db.NotasItens,
          as: 'notaItens',
          include: [{
            model: db.Produtos,
            as: 'produtos'
          }]
        },
        {
          model: db.Manifestos,
          as: 'manifesto'
        }
      ],
      order: [['data_emissao', 'DESC']]
    });
  }

  async getById(id) {
    return this._getByIdWithTransaction(id);
  }

  async getByPedidoId(pedidoId) {
    return db.NotasFiscais.findAll({
      where: { pedido_id: pedidoId },
      include: [{
        model: db.NotasItens,
        as: 'notaItens'
      }]
    });
  }

  /**
   * Valida dados da nota antes da criação
   */
  async _validateNotaData(payload, transaction = null) {
    const errors = [];
    
    // Valida pedido_id se fornecido
    if (payload.pedido_id) {
      const pedido = await db.Pedidos.findByPk(payload.pedido_id, { transaction });
      if (!pedido) {
        errors.push(`Pedido com ID ${payload.pedido_id} não encontrado`);
      }
    }

    // Valida manifesto_id se fornecido
    if (payload.manifesto_id) {
      const manifesto = await db.Manifestos.findByPk(payload.manifesto_id, { transaction });
      if (!manifesto) {
        errors.push(`Manifesto com ID ${payload.manifesto_id} não encontrado`);
      }
    }

    // Valida campos numéricos
    if (payload.valor_total !== undefined && isNaN(payload.valor_total)) {
      errors.push('valor_total deve ser um número válido');
    }

    // Valida data
    if (payload.data_emissao) {
      const data = new Date(payload.data_emissao);
      if (isNaN(data.getTime())) {
        errors.push('data_emissao inválida');
      }
    }

    // Valida tipo
    const tiposValidos = ['NF-e', 'NFC-e'];
    if (payload.tipo && !tiposValidos.includes(payload.tipo)) {
      errors.push(`tipo deve ser um dos valores: ${tiposValidos.join(', ')}`);
    }

    if (errors.length > 0) {
      throw new Error(`Validação falhou: ${errors.join('; ')}`);
    }
  }

  /**
   * Valida itens da nota
   */
  async _validateNotaItens(itens = [], transaction = null) {
    if (!Array.isArray(itens)) {
      throw new Error('Itens deve ser um array');
    }

    const errors = [];
    
    for (let i = 0; i < itens.length; i++) {
      const item = itens[i];
      
      if (!item.produto_id) {
        errors.push(`Item ${i}: produto_id é obrigatório`);
        continue;
      }

      // Valida existência do produto
      const produto = await db.Produtos.findByPk(item.produto_id, { transaction });
      if (!produto) {
        errors.push(`Item ${i}: Produto com ID ${item.produto_id} não encontrado`);
      }

      // Valida quantidade
      if (item.quantidade === undefined || item.quantidade === null) {
        errors.push(`Item ${i}: quantidade é obrigatória`);
      } else if (isNaN(item.quantidade) || Number(item.quantidade) <= 0) {
        errors.push(`Item ${i}: quantidade deve ser um número positivo`);
      }

      // Valida valor_unitario
      if (item.valor_unitario !== undefined && item.valor_unitario !== null) {
        if (isNaN(item.valor_unitario) || Number(item.valor_unitario) < 0) {
          errors.push(`Item ${i}: valor_unitario deve ser um número não negativo`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Validação de itens falhou: ${errors.join('; ')}`);
    }
  }

  async createNotaParaPedido(pedidoOrId, options = {}) {
    const externalTx = options.transaction;
    const transaction = externalTx || await db.sequelize.transaction();
    const createdHere = !externalTx;

    console.log('🔧 Iniciando criação de nota para pedido...');

    try {
      let pedido;
      if (typeof pedidoOrId === 'number' || typeof pedidoOrId === 'string') {
        pedido = await db.Pedidos.findByPk(pedidoOrId, {
          include: [
            { model: db.PedidoItens, as: 'itens', include: [{ model: db.Produtos, as: 'produtos' }] }
          ],
          transaction
        });
        if (!pedido) throw new Error(`Pedido ${pedidoOrId} não encontrado`);
      } else {
        pedido = pedidoOrId;
        if (!pedido.itens && pedido.id) {
          pedido = await db.Pedidos.findByPk(pedido.id, {
            include: [
              { model: db.PedidoItens, as: 'itens', include: [{ model: db.Produtos, as: 'produtos' }] }
            ],
            transaction
          });
        }
      }

      console.log(`📦 Pedido carregado: ID ${pedido.id}, ${pedido.itens?.length || 0} itens`);

      const numeroOption = options.numero || (options.nota && options.nota.numero) || null;
      const serieOption = options.serie || (options.nota && options.nota.serie) || '1';
      const dataEmissaoOption = options.data_emissao ? new Date(options.data_emissao) : (options.nota?.data_emissao ? new Date(options.nota.data_emissao) : new Date());
      const manifestoOption = options.manifesto_id || options.nota?.manifesto_id || null;
      const itensOverride = Array.isArray(options.itens) ? options.itens : (Array.isArray(options.nota?.itens) ? options.nota.itens : null);

      let itensDoPedidoParaNota;
      if (itensOverride) {
        console.log('📝 Usando itens override fornecidos');
        itensDoPedidoParaNota = itensOverride.map(it => {
          return {
            produto_id: it.produto_id,
            descricao: it.descricao || it.nome || null,
            quantidade: Number(it.quantidade || 0),
            valor_unitario: Number(it.valor_unitario || it.preco || 0),
            cfop: it.cfop || '5102',
            cest: it.cest || null
          };
        });
      } else {
        const itensDoPedido = pedido.itens || [];
        console.log(`🔄 Convertendo ${itensDoPedido.length} itens do pedido`);
        itensDoPedidoParaNota = itensDoPedido.map(it => {
          const produtoObj = it.produtos || null;
          return {
            produto_id: it.produto_id,
            descricao: it.descricao || produtoObj?.nome || null,
            quantidade: Number(it.quantidade || 0),
            valor_unitario: Number(it.valor_unitario || produtoObj?.preco || 0),
            cfop: it.cfop || '5102',
            cest: it.cest || null
          };
        });
      }

      // Valida itens antes de prosseguir
      await this._validateNotaItens(itensDoPedidoParaNota, transaction);

      let numeroNota;
      if (numeroOption) {
        numeroNota = String(numeroOption);
      } else if (pedido && pedido.codigo_pedido) {
        const safeCode = String(pedido.codigo_pedido).replace(/[^A-Za-z0-9_-]/g, '');
        numeroNota = `NF-${safeCode}`;
      }

      const valor_total_calculado = itensDoPedidoParaNota.reduce((s, it) => s + (Number(it.quantidade || 0) * Number(it.valor_unitario || 0)), 0);

      const payloadNota = this._filterModelAttributes('NotasFiscais', {
        pedido_id: pedido.id,
        numero: numeroNota,
        serie: serieOption || '1',
        chave_nfe: null,
        data_emissao: dataEmissaoOption,
        valor_total: valor_total_calculado,
        tipo: 'NF-e',
        manifesto_id: manifestoOption
      });

      console.log(`💰 Valor total calculado: R$ ${valor_total_calculado.toFixed(2)}`);

      // Valida dados da nota
      await this._validateNotaData(payloadNota, transaction);

      const nota = await this.createNotaComItens({ ...payloadNota, itens: itensDoPedidoParaNota }, { transaction });

      if (createdHere) {
        await transaction.commit();
        console.log(`✅ Nota fiscal ${nota.id} criada com sucesso!`);
      }

      return nota;
    } catch (error) {
      console.error(`❌ Erro ao criar nota para pedido: ${error.message}`);
      console.error(error.stack);
      
      if (createdHere && transaction && !transaction.finished) {
        console.log('🔄 Realizando rollback da transação...');
        try {
          await transaction.rollback();
          console.log('🔄 Rollback realizado com sucesso');
        } catch (rollbackError) {
          console.error(`❌ Erro ao fazer rollback: ${rollbackError.message}`);
        }
      } else if (!externalTx && transaction && transaction.finished === 'rollback') {
        console.log('ℹ️ Transação já revertida');
      }
      
      // Re-lança o erro para tratamento superior
      throw new Error(`Falha ao criar nota fiscal: ${error.message}`);
    }
  }

  async createNotaComItens(payload = {}, options = {}) {
    const externalTx = options.transaction;
    const transaction = externalTx || await db.sequelize.transaction();
    const createdHere = !externalTx;

    console.log('🔧 Iniciando criação de nota com itens...');

    try {
      const { pedido_id = null, numero = null, serie = null, chave_nfe = null, data_emissao = new Date(), tipo = 'NF-e', manifesto_id = null, itens = [] } = payload;

      console.log(`📄 Criando nota fiscal com ${itens.length} itens`);

      // Valida dados da nota
      await this._validateNotaData({ pedido_id, numero, serie, chave_nfe, data_emissao, tipo, manifesto_id }, transaction);
      
      // Valida itens
      await this._validateNotaItens(itens, transaction);

      const valor_total = itens.reduce((s, it) => s + (Number(it.quantidade || 0) * Number(it.valor_unitario || 0)), 0);

      const filteredNotaPayload = this._filterModelAttributes('NotasFiscais', {
        pedido_id,
        numero,
        serie,
        chave_nfe,
        data_emissao,
        valor_total,
        manifesto_id,
        tipo
      });

      console.log(`💰 Valor total: R$ ${valor_total.toFixed(2)}`);

      const nota = await db.NotasFiscais.create(filteredNotaPayload, { transaction });
      console.log(`📝 Nota fiscal ${nota.id} criada`);

      if (itens && itens.length > 0) {
        const payloadItens = itens.map(it => {
          const filteredItem = this._filterModelAttributes('NotasItens', {
            nota_id: nota.id,
            produto_id: it.produto_id,
            descricao: it.descricao || null,
            quantidade: it.quantidade || 0,
            valor_unitario: it.valor_unitario || 0,
            cfop: it.cfop || null,
            cest: it.cest || null,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          return filteredItem;
        });

        console.log(`📦 Criando ${payloadItens.length} itens...`);
        await db.NotasItens.bulkCreate(payloadItens, { transaction });
        console.log(`✅ ${payloadItens.length} itens criados para nota ${nota.id}`);
      }

      let notaCompleta;

      if (createdHere) {
        await transaction.commit();
        console.log(`🔄 Transação comitada - buscando nota ${nota.id} completa`);
        notaCompleta = await this.getById(nota.id);
      } else {
        console.log(`🔍 Buscando nota ${nota.id} dentro da transação atual`);
        notaCompleta = await this._getByIdWithTransaction(nota.id, transaction);
      }

      return notaCompleta;
    } catch (error) {
      console.error(`❌ Erro ao criar nota com itens: ${error.message}`);
      console.error(error.stack);
      
      if (createdHere && transaction && !transaction.finished) {
        console.log('🔄 Realizando rollback da transação...');
        try {
          await transaction.rollback();
          console.log('🔄 Rollback realizado com sucesso');
        } catch (rollbackError) {
          console.error(`❌ Erro ao fazer rollback: ${rollbackError.message}`);
        }
      } else if (!externalTx && transaction && transaction.finished === 'rollback') {
        console.log('ℹ️ Transação já revertida');
      }
      
      throw new Error(`Falha ao criar nota fiscal com itens: ${error.message}`);
    }
  }

  async updateNota(id, updates = {}, options = {}) {
    const transaction = options.transaction;
    
    console.log(`🔧 Atualizando nota ${id}...`);

    try {
      // Valida atualizações
      await this._validateNotaData(updates, transaction);
      
      const filteredUpdates = this._filterModelAttributes('NotasFiscais', updates);

      const [affectedRows] = await db.NotasFiscais.update(filteredUpdates, {
        where: { id },
        transaction
      });

      if (affectedRows === 0) {
        throw new Error(`Nota fiscal ${id} não encontrada para atualização`);
      }

      console.log(`✅ Nota ${id} atualizada (${affectedRows} registros afetados)`);

      if (transaction) {
        return this._getByIdWithTransaction(id, transaction);
      }

      return this.getById(id);
    } catch (error) {
      console.error(`❌ Erro ao atualizar nota ${id}: ${error.message}`);
      throw error;
    }
  }

  async deleteNota(id, options = {}) {
    const transaction = options.transaction;
    
    console.log(`🗑️  Excluindo nota ${id}...`);

    try {
      // Verifica se a nota existe
      const nota = await db.NotasFiscais.findByPk(id, { transaction });
      if (!nota) {
        throw new Error(`Nota fiscal ${id} não encontrada`);
      }

      // Exclui itens primeiro (devido a constraints de FK)
      await db.NotasItens.destroy({
        where: { nota_id: id },
        transaction
      });

      const result = await db.NotasFiscais.destroy({
        where: { id },
        transaction
      });

      console.log(`✅ Nota ${id} excluída com sucesso`);
      return result;
    } catch (error) {
      console.error(`❌ Erro ao excluir nota ${id}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = NotasFiscaisServices;