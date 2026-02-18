'use strict';

const { where } = require('sequelize');
const db = require('../models');
const Services = require('./Services');

class EstoquesServices extends Services {
  constructor() {
    super('Estoques');
  }

  _hasField(estoqueInstance, fieldName) {
    console.log(`[EstoquesServices] Verificando campo ${fieldName} no estoque`);
    const hasField = Object.prototype.hasOwnProperty.call(estoqueInstance.dataValues || {}, fieldName);
    console.log(`[EstoquesServices] Campo ${fieldName} existe? ${hasField}`);
    return hasField;
  }

  _getQuantidades(estoque) {
    console.log(`[EstoquesServices] Obtendo quantidades do estoque ID: ${estoque.id}`);
    
    const total = estoque.get ? estoque.get('quantidade_total') : undefined;
    const reservado = estoque.get ? estoque.get('quantidade_reservada') : undefined;

    if (typeof total !== 'undefined' && typeof reservado !== 'undefined') {
      console.log(`[EstoquesServices] Usando quantidade_total e quantidade_reservada: total=${total}, reservado=${reservado}`);
      return { total: Number(total || 0), reservado: Number(reservado || 0) };
    }
    
    const q = estoque.get ? estoque.get('quantidade') : estoque.quantidade;
    console.log(`[EstoquesServices] Usando quantidade única: ${q}`);
    return { total: Number(q || 0), reservado: 0 };
  }

  async _setQuantidadesAndSave(estoque, { newTotal = null, newReservado = null }, transaction = null) {
    console.log(`[EstoquesServices] Atualizando quantidades do estoque ID: ${estoque.id}`);
    console.log(`[EstoquesServices] newTotal: ${newTotal}, newReservado: ${newReservado}`);
    
    if (this._hasField(estoque, 'quantidade_total')) {
      if (newTotal !== null) {
        estoque.set('quantidade_total', Number(newTotal));
        console.log(`[EstoquesServices] quantidade_total atualizada para: ${newTotal}`);
      }
      if (newReservado !== null) {
        estoque.set('quantidade_reservada', Number(newReservado));
        console.log(`[EstoquesServices] quantidade_reservada atualizada para: ${newReservado}`);
      }
    } else {
      if (newTotal !== null) {
        estoque.set('quantidade', Number(newTotal));
        console.log(`[EstoquesServices] quantidade atualizada para: ${newTotal}`);
      }
    }
    
    await estoque.save({ transaction });
    console.log(`[EstoquesServices] Estoque ID: ${estoque.id} salvo com sucesso`);
    return estoque;
  }

  async logMovimentacao({
    estoque_id = null,
    produto_id,
    hub_id,
    tipo,
    quantidade,
    usuario_id = null,
    referencia = null,
    localizacao = null,
    transaction = null,
  }) {
    console.log('[EstoquesServices] Registrando movimentação:', {
      estoque_id,
      produto_id,
      hub_id,
      tipo,
      quantidade,
      usuario_id,
      referencia,
      localizacao
    });

    try {
      const movimentacao = await db.EstoquesMovimentacoes.create({
        estoque_id,
        produto_id,
        hub_id,
        tipo,
        quantidade,
        usuario_id,
        referencia,
        localizacao,
        data_movimentacao: new Date()
      }, { transaction });

      console.log(`[EstoquesServices] Movimentação registrada com ID: ${movimentacao.id}`);
      return movimentacao;
    } catch (error) {
      console.error('[EstoquesServices] Erro ao registrar movimentação:', error);
      throw error;
    }
  }

  async getAll(filters = {}) {
    console.log('[EstoquesServices] Buscando todos os estoques com filtros:', filters);
    
    const where = {};
    if (filters.produto_id) {
      where.produto_id = filters.produto_id;
      console.log(`[EstoquesServices] Filtrando por produto_id: ${filters.produto_id}`);
    }
    if (filters.hub_id) {
      where.hub_id = filters.hub_id;
      console.log(`[EstoquesServices] Filtrando por hub_id: ${filters.hub_id}`);
    }

    try {
      const estoques = await db.Estoques.findAll({
        where,
        include: [
          { model: db.Produtos, attributes: ['id', 'nome', 'estoque_minimo'] },
          { model: db.Hubs, attributes: ['id', 'nome'] }
        ],
        order: [['id', 'ASC']]
      });

      console.log(`[EstoquesServices] Encontrados ${estoques.length} estoques`);
      return estoques;
    } catch (error) {
      console.error('[EstoquesServices] Erro ao buscar estoques:', error);
      throw new Error(`Erro ao buscar estoques: ${error.message}`);
    }
  }

  async getById(id) {
    console.log(`[EstoquesServices] Buscando estoque por ID: ${id}`);
    
    try {
      const estoque = await db.Estoques.findByPk(id, {
        include: [
          { model: db.Produtos },
          { model: db.Hubs }
        ]
      });

      if (!estoque) {
        console.error(`[EstoquesServices] Estoque não encontrado: ${id}`);
        throw new Error('Estoque não encontrado');
      }

      console.log(`[EstoquesServices] Estoque encontrado: ${estoque.id}`);
      return estoque;
    } catch (error) {
      console.error(`[EstoquesServices] Erro ao buscar estoque por ID: ${error.message}`);
      throw new Error(`Erro ao buscar estoque: ${error.message}`);
    }
  }

  async getInvetoryByProduct(produtoId) {
    console.log(`[EstoquesServices] Buscando estoques por produto ID: ${produtoId}`);
    
    try {
      const estoques = await db.Estoques.findAll({
        where: { produto_id: produtoId },
        include: [{ model: db.Hubs }]
      });

      console.log(`[EstoquesServices] Encontrados ${estoques.length} estoques para o produto ${produtoId}`);
      return estoques;
    } catch (error) {
      console.error(`[EstoquesServices] Erro ao buscar estoques por produto: ${error.message}`);
      throw new Error(`Erro ao buscar estoques por produto: ${error.message}`);
    }
  }

  async getInvetoryByHub(hubId) {
    console.log(`[EstoquesServices] Buscando estoques por hub ID: ${hubId}`);
    
    try {
      const estoques = await db.Estoques.findAll({
        where: { hub_id: hubId },
        include: [{ model: db.Produtos }]
      });

      console.log(`[EstoquesServices] Encontrados ${estoques.length} estoques para o hub ${hubId}`);
      return estoques;
    } catch (error) {
      console.error(`[EstoquesServices] Erro ao buscar estoques por hub: ${error.message}`);
      throw new Error(`Erro ao buscar estoques por hub: ${error.message}`);
    }
  }

  async entradaEstoque({ produto_id, hub_id, quantidade, usuario_id = null, localizacao = null, referencia = null }, options = {}) {
    console.log('[EstoquesServices] Iniciando entradaEstoque:', {
      produto_id,
      hub_id,
      quantidade,
      usuario_id,
      localizacao,
      referencia,
      options
    });

    const externalTx = options.transaction;
    const transaction = externalTx || await db.sequelize.transaction();
    const createdHere = !externalTx;

    try {
      console.log('[EstoquesServices] Validando campos obrigatórios...');
      if (!produto_id || !hub_id || typeof quantidade === 'undefined') {
        console.error('[EstoquesServices] Campos obrigatórios faltando:', {
          produto_id,
          hub_id,
          quantidade
        });
        throw new Error('Campos obrigatórios: produto_id, hub_id e quantidade');
      }

      if (Number(quantidade) <= 0) {
        console.error('[EstoquesServices] Quantidade inválida:', quantidade);
        throw new Error('Quantidade deve ser maior que zero');
      }

      console.log(`[EstoquesServices] Buscando estoque existente para produto ${produto_id}, hub ${hub_id}`);
      let estoque = await db.Estoques.findOne({
        where: { produto_id, hub_id },
        transaction,
        lock: transaction && transaction.LOCK ? transaction.LOCK.UPDATE : undefined
      });

      if (!estoque) {
        console.log('[EstoquesServices] Estoque não encontrado, criando novo registro...');
        const newData = {
          produto_id: produto_id,
          hub_id: hub_id,
          quantidade_total: Number(quantidade),
          quantidade_reservada: 0,
          quantidade: Number(quantidade),
          localizacao: localizacao || null,
          data_entrada: new Date()
        };

        console.log('[EstoquesServices] Dados para criação de novo estoque:', newData);
        estoque = await db.Estoques.create(newData, { transaction });
        console.log(`[EstoquesServices] Novo estoque criado com ID: ${estoque.id}`);
      } else {
        console.log(`[EstoquesServices] Estoque encontrado ID: ${estoque.id}`);
        const q = this._getQuantidades(estoque);
        const novoTotal = Number(q.total || 0) + Number(quantidade);
        console.log(`[EstoquesServices] Atualizando estoque: ${q.total} + ${quantidade} = ${novoTotal}`);
        
        await this._setQuantidadesAndSave(estoque, { newTotal: novoTotal }, transaction);
        
        if (localizacao) {
          console.log(`[EstoquesServices] Atualizando localização para: ${localizacao}`);
          estoque.localizacao = localizacao;
          await estoque.save({ transaction });
        }
      }

      console.log('[EstoquesServices] Registrando movimentação de entrada...');
      await this.logMovimentacao({
        estoque_id: estoque.id,
        produto_id,
        hub_id,
        tipo: 'ENTRADA',
        quantidade,
        usuario_id,
        referencia,
        localizacao,
        transaction
      });

      if (createdHere) {
        console.log('[EstoquesServices] Fazendo commit da transação...');
        await transaction.commit();
        console.log('[EstoquesServices] Commit realizado com sucesso');
      }

      console.log(`[EstoquesServices] Entrada de estoque concluída para estoque ID: ${estoque.id}`);
      return estoque;

    } catch (error) {
      console.error('[EstoquesServices] ERRO em entradaEstoque:', error);
      console.error('[EstoquesServices] Stack trace:', error.stack);

      if (createdHere && transaction && !transaction.finished) {
        console.log('[EstoquesServices] Fazendo rollback da transação...');
        try {
          await transaction.rollback();
          console.log('[EstoquesServices] Rollback realizado');
        } catch (rollbackError) {
          console.error('[EstoquesServices] Erro no rollback:', rollbackError.message);
        }
      }

      // Melhorar mensagens de erro
      if (error.message.includes('foreign key constraint')) {
        throw new Error('Erro de integridade referencial: Produto ou Hub não existe');
      } else if (error.message.includes('SequelizeUniqueConstraintError')) {
        throw new Error('Estoque já existe para este produto e hub');
      }

      throw new Error(`Erro ao processar entrada de estoque: ${error.message}`);
    }
  }

  async reservarProduto({ produto_id, hub_id, quantidade, usuario_id = null, referencia }, options = {}) {
    console.log('[EstoquesServices] Iniciando reservarProduto:', {
      produto_id,
      hub_id,
      quantidade,
      usuario_id,
      referencia
    });

    const externalTx = options.transaction;
    const transaction = externalTx || await db.sequelize.transaction();
    const createdHere = !externalTx;

    try {
      console.log('[EstoquesServices] Validando campos obrigatórios...');
      if (!produto_id || !hub_id || typeof quantidade === 'undefined') {
        console.error('[EstoquesServices] Campos obrigatórios faltando');
        throw new Error('Campos obrigatórios: produto_id, hub_id e quantidade');
      }

      console.log(`[EstoquesServices] Buscando estoque para produto ${produto_id}, hub ${hub_id}`);
      const estoque = await db.Estoques.findOne({
        where: { produto_id, hub_id },
        transaction,
        lock: transaction && transaction.LOCK ? transaction.LOCK.UPDATE : undefined
      });

      if (!estoque) {
        console.error('[EstoquesServices] Estoque não encontrado');
        throw new Error('Estoque não encontrado');
      }

      console.log(`[EstoquesServices] Estoque encontrado ID: ${estoque.id}`);
      const q = this._getQuantidades(estoque);
      const disponivel = Number(q.total || 0) - Number(q.reservado || 0);
      console.log(`[EstoquesServices] Estoque disponível: ${disponivel}, Quantidade solicitada: ${quantidade}`);

      if (disponivel < Number(quantidade)) {
        console.error(`[EstoquesServices] Estoque insuficiente. Disponível: ${disponivel}, Solicitado: ${quantidade}`);
        throw new Error(`Estoque insuficiente. Disponível: ${disponivel}`);
      }

      const novoReservado = Number(q.reservado || 0) + Number(quantidade);
      const novoTotal = Number(q.total || 0);
      console.log(`[EstoquesServices] Nova quantidade reservada: ${novoReservado}`);

      await this._setQuantidadesAndSave(estoque, { newTotal: novoTotal, newReservado: novoReservado }, transaction);

      console.log('[EstoquesServices] Registrando movimentação de reserva...');
      await this.logMovimentacao({
        estoque_id: estoque.id,
        produto_id,
        hub_id,
        tipo: 'RESERVA',
        quantidade,
        usuario_id,
        referencia,
        transaction
      });

      if (createdHere) {
        console.log('[EstoquesServices] Fazendo commit da transação...');
        await transaction.commit();
        console.log('[EstoquesServices] Commit realizado com sucesso');
      }

      console.log(`[EstoquesServices] Reserva concluída para estoque ID: ${estoque.id}`);
      return estoque;
    } catch (error) {
      console.error('[EstoquesServices] ERRO em reservarProduto:', error);

      if (createdHere && transaction && !transaction.finished) {
        console.log('[EstoquesServices] Fazendo rollback da transação...');
        try {
          await transaction.rollback();
          console.log('[EstoquesServices] Rollback realizado');
        } catch (rollbackError) {
          console.error('[EstoquesServices] Erro no rollback:', rollbackError.message);
        }
      }

      throw new Error(`Erro ao reservar produto: ${error.message}`);
    }
  }

  async liberarReserva({ produto_id, hub_id, quantidade, usuario_id = null, referencia = null }, options = {}) {
    console.log('[EstoquesServices] Iniciando liberarReserva:', {
      produto_id,
      hub_id,
      quantidade,
      usuario_id,
      referencia
    });

    const externalTx = options.transaction;
    const transaction = externalTx || await db.sequelize.transaction();
    const createdHere = !externalTx;

    try {
      console.log('[EstoquesServices] Validando campos obrigatórios...');
      if (!produto_id || !hub_id || typeof quantidade === 'undefined') {
        console.error('[EstoquesServices] Campos obrigatórios faltando');
        throw new Error('Campos obrigatórios: produto_id, hub_id e quantidade');
      }

      console.log(`[EstoquesServices] Buscando estoque para produto ${produto_id}, hub ${hub_id}`);
      const estoque = await db.Estoques.findOne({
        where: { produto_id, hub_id },
        transaction,
        lock: transaction && transaction.LOCK ? transaction.LOCK.UPDATE : undefined
      });

      if (!estoque) {
        console.error('[EstoquesServices] Estoque não encontrado');
        throw new Error('Estoque não encontrado');
      }

      console.log(`[EstoquesServices] Estoque encontrado ID: ${estoque.id}`);
      const q = this._getQuantidades(estoque);
      const novoReservado = Math.max(0, Number(q.reservado || 0) - Number(quantidade));
      console.log(`[EstoquesServices] Liberando reserva: ${q.reservado} - ${quantidade} = ${novoReservado}`);

      await this._setQuantidadesAndSave(estoque, { newReservado: novoReservado }, transaction);

      console.log('[EstoquesServices] Registrando movimentação de liberação...');
      await this.logMovimentacao({
        estoque_id: estoque.id,
        produto_id,
        hub_id,
        tipo: 'LIBERACAO',
        quantidade,
        usuario_id,
        referencia,
        transaction
      });

      if (createdHere) {
        console.log('[EstoquesServices] Fazendo commit da transação...');
        await transaction.commit();
        console.log('[EstoquesServices] Commit realizado com sucesso');
      }

      console.log(`[EstoquesServices] Liberação de reserva concluída para estoque ID: ${estoque.id}`);
      return estoque;
    } catch (error) {
      console.error('[EstoquesServices] ERRO em liberarReserva:', error);

      if (createdHere && transaction && !transaction.finished) {
        console.log('[EstoquesServices] Fazendo rollback da transação...');
        try {
          await transaction.rollback();
          console.log('[EstoquesServices] Rollback realizado');
        } catch (rollbackError) {
          console.error('[EstoquesServices] Erro no rollback:', rollbackError.message);
        }
      }

      throw new Error(`Erro ao liberar reserva: ${error.message}`);
    }
  }

  async saidaEstoque({
    produto_id,
    hub_id,
    quantidade,
    usuario_id = null,
    referencia = null,
    consumirReservas = true
  }, options = {}) {
    console.log('[EstoquesServices] Iniciando saidaEstoque:', {
      produto_id,
      hub_id,
      quantidade,
      usuario_id,
      referencia,
      consumirReservas
    });

    const externalTx = options.transaction;
    const transaction = externalTx || await db.sequelize.transaction();
    const createdHere = !externalTx;

    if (!produto_id || !hub_id || typeof quantidade === 'undefined') {
      console.error('[EstoquesServices] Campos obrigatórios faltando');
      throw new Error('Campos obrigatórios: produto_id, hub_id e quantidade');
    }

    try {
      console.log(`[EstoquesServices] Buscando estoque para produto ${produto_id}, hub ${hub_id}`);
      const estoque = await db.Estoques.findOne({
        where: { produto_id, hub_id },
        transaction,
        lock: transaction ? transaction.LOCK.UPDATE : undefined
      });

      if (!estoque) {
        console.error('[EstoquesServices] Estoque não encontrado');
        throw new Error('Estoque não encontrado');
      }

      console.log(`[EstoquesServices] Estoque encontrado ID: ${estoque.id}`);
      const q = this._getQuantidades(estoque);
      let quantidadeSubtrair = Number(quantidade);
      
      if (isNaN(quantidadeSubtrair) || quantidadeSubtrair <= 0) {
        console.error('[EstoquesServices] Quantidade inválida:', quantidade);
        throw new Error('Quantidade inválida');
      }

      console.log(`[EstoquesServices] Quantidades atuais: total=${q.total}, reservado=${q.reservado}`);

      if (consumirReservas && Number(q.reservado || 0) > 0) {
        const reservado = Number(q.reservado || 0);
        const reduzReserva = Math.min(reservado, quantidadeSubtrair);
        
        if (reduzReserva > 0) {
          console.log(`[EstoquesServices] Consumindo ${reduzReserva} unidades da reserva`);
          const novoReservado = reservado - reduzReserva;
          quantidadeSubtrair = quantidadeSubtrair - reduzReserva;
          await this._setQuantidadesAndSave(estoque, { newReservado: novoReservado }, transaction);
        }
      }

      const novoTotal = Number(q.total || 0) - quantidadeSubtrair;
      console.log(`[EstoquesServices] Novo total após saída: ${novoTotal} (${q.total} - ${quantidadeSubtrair})`);

      if (novoTotal < 0) {
        console.error(`[EstoquesServices] Estoque insuficiente após consumir reservas. Novo total seria: ${novoTotal}`);
        throw new Error('Estoque insuficiente');
      }

      await this._setQuantidadesAndSave(estoque, { newTotal: novoTotal }, transaction);

      estoque.data_saida = new Date();
      await estoque.save({ transaction });

      console.log('[EstoquesServices] Registrando movimentação de saída...');
      await this.logMovimentacao({
        estoque_id: estoque.id,
        produto_id,
        hub_id,
        tipo: 'SAIDA',
        quantidade: Number(quantidade),
        usuario_id,
        referencia,
        transaction
      });

      if (createdHere) {
        console.log('[EstoquesServices] Fazendo commit da transação...');
        await transaction.commit();
        console.log('[EstoquesServices] Commit realizado com sucesso');
      }

      console.log(`[EstoquesServices] Saída de estoque concluída para estoque ID: ${estoque.id}`);
      return estoque;
    } catch (error) {
      console.error('[EstoquesServices] ERRO em saidaEstoque:', error);

      if (createdHere && transaction && !transaction.finished) {
        console.log('[EstoquesServices] Fazendo rollback da transação...');
        try {
          await transaction.rollback();
          console.log('[EstoquesServices] Rollback realizado');
        } catch (rollbackError) {
          console.error('[EstoquesServices] Erro no rollback:', rollbackError.message);
        }
      }

      throw new Error(`Erro ao processar saída de estoque: ${error.message}`);
    }
  }

  async transferirEstoque({ produto_id, origem_hub_id, destino_hub_id, quantidade, usuario_id = null, referencia = null }, options = {}) {
    console.log('[EstoquesServices] Iniciando transferirEstoque:', {
      produto_id,
      origem_hub_id,
      destino_hub_id,
      quantidade,
      usuario_id,
      referencia
    });

    const externalTx = options.transaction;
    const transaction = externalTx || await db.sequelize.transaction();
    const createdHere = !externalTx;

    try {
      console.log('[EstoquesServices] Validando campos obrigatórios...');
      if (!produto_id || !origem_hub_id || !destino_hub_id || typeof quantidade === 'undefined') {
        console.error('[EstoquesServices] Campos obrigatórios faltando');
        throw new Error('Campos obrigatórios: produto_id, origem_hub_id, destino_hub_id e quantidade');
      }

      if (origem_hub_id === destino_hub_id) {
        console.error('[EstoquesServices] Origem e destino são iguais');
        throw new Error('Origem e destino não podem ser iguais');
      }

      console.log(`[EstoquesServices] Buscando estoque de origem: produto ${produto_id}, hub ${origem_hub_id}`);
      const estoqueOrigem = await db.Estoques.findOne({
        where: { produto_id, hub_id: origem_hub_id },
        transaction,
        lock: transaction && transaction.LOCK ? transaction.LOCK.UPDATE : undefined
      });

      if (!estoqueOrigem) {
        console.error('[EstoquesServices] Estoque de origem não encontrado');
        throw new Error('Estoque de origem não encontrado');
      }

      console.log(`[EstoquesServices] Estoque de origem encontrado ID: ${estoqueOrigem.id}`);
      const qOrig = this._getQuantidades(estoqueOrigem);
      console.log(`[EstoquesServices] Quantidade disponível na origem: ${qOrig.total}`);

      if (Number(qOrig.total || 0) < Number(quantidade)) {
        console.error(`[EstoquesServices] Estoque de origem insuficiente. Disponível: ${qOrig.total}, Solicitado: ${quantidade}`);
        throw new Error('Estoque de origem insuficiente');
      }

      const novoTotalOrig = Number(qOrig.total || 0) - Number(quantidade);
      console.log(`[EstoquesServices] Atualizando origem: ${qOrig.total} - ${quantidade} = ${novoTotalOrig}`);
      await this._setQuantidadesAndSave(estoqueOrigem, { newTotal: novoTotalOrig }, transaction);

      console.log(`[EstoquesServices] Buscando estoque de destino: produto ${produto_id}, hub ${destino_hub_id}`);
      let estoqueDestino = await db.Estoques.findOne({
        where: { produto_id, hub_id: destino_hub_id },
        transaction,
        lock: transaction && transaction.LOCK ? transaction.LOCK.UPDATE : undefined
      });

      if (!estoqueDestino) {
        console.log('[EstoquesServices] Estoque de destino não encontrado, criando novo...');
        const createData = {
          produto_id,
          hub_id: destino_hub_id,
          quantidade_total: Number(quantidade),
          quantidade_reservada: 0,
          quantidade: Number(quantidade),
          data_entrada: new Date()
        };
        
        estoqueDestino = await db.Estoques.create(createData, { transaction });
        console.log(`[EstoquesServices] Novo estoque de destino criado ID: ${estoqueDestino.id}`);
      } else {
        console.log(`[EstoquesServices] Estoque de destino encontrado ID: ${estoqueDestino.id}`);
        const qDest = this._getQuantidades(estoqueDestino);
        const novoTotalDest = Number(qDest.total || 0) + Number(quantidade);
        console.log(`[EstoquesServices] Atualizando destino: ${qDest.total} + ${quantidade} = ${novoTotalDest}`);
        await this._setQuantidadesAndSave(estoqueDestino, { newTotal: novoTotalDest }, transaction);
      }

      // Log origem e destino
      console.log('[EstoquesServices] Registrando movimentações de transferência...');
      await this.logMovimentacao({
        estoque_id: estoqueOrigem.id,
        produto_id,
        hub_id: origem_hub_id,
        tipo: 'TRANSFERENCIA_ORIGEM',
        quantidade,
        usuario_id,
        referencia,
        localizacao: estoqueOrigem.localizacao,
        transaction
      });

      await this.logMovimentacao({
        estoque_id: estoqueDestino.id,
        produto_id,
        hub_id: destino_hub_id,
        tipo: 'TRANSFERENCIA_DESTINO',
        quantidade,
        usuario_id,
        referencia,
        localizacao: estoqueDestino.localizacao,
        transaction
      });

      if (createdHere) {
        console.log('[EstoquesServices] Fazendo commit da transação...');
        await transaction.commit();
        console.log('[EstoquesServices] Commit realizado com sucesso');
      }

      console.log(`[EstoquesServices] Transferência concluída: ${quantidade} unidades de ${origem_hub_id} para ${destino_hub_id}`);
      return {
        origem: estoqueOrigem,
        destino: estoqueDestino
      };
    } catch (error) {
      console.error('[EstoquesServices] ERRO em transferirEstoque:', error);

      if (createdHere && transaction && !transaction.finished) {
        console.log('[EstoquesServices] Fazendo rollback da transação...');
        try {
          await transaction.rollback();
          console.log('[EstoquesServices] Rollback realizado');
        } catch (rollbackError) {
          console.error('[EstoquesServices] Erro no rollback:', rollbackError.message);
        }
      }

      throw new Error(`Erro ao transferir estoque: ${error.message}`);
    }
  }

  async ajustarEstoque({ produto_id, hub_id, nova_quantidade_total, usuario_id, referencia = null }, options = {}) {
    console.log('[EstoquesServices] Iniciando ajustarEstoque:', {
      produto_id,
      hub_id,
      nova_quantidade_total,
      usuario_id,
      referencia
    });

    const externalTx = options.transaction;
    const transaction = externalTx || await db.sequelize.transaction();
    const createdHere = !externalTx;

    try {
      console.log('[EstoquesServices] Validando campos obrigatórios...');
      if (!produto_id || !hub_id || typeof nova_quantidade_total === 'undefined') {
        console.error('[EstoquesServices] Campos obrigatórios faltando');
        throw new Error('produto_id, hub_id e nova_quantidade_total são obrigatórios');
      }

      if (!usuario_id) {
        console.error('[EstoquesServices] Usuário não informado');
        throw new Error('usuario_id é obrigatório para registrar a movimentação');
      }

      console.log(`[EstoquesServices] Buscando estoque para produto ${produto_id}, hub ${hub_id}`);
      let estoque = await db.Estoques.findOne({
        where: { produto_id, hub_id },
        transaction,
        lock: transaction && transaction.LOCK ? transaction.LOCK.UPDATE : undefined
      });

      if (!estoque) {
        console.log('[EstoquesServices] Estoque não encontrado, criando novo...');
        estoque = await db.Estoques.create({
          produto_id: Number(produto_id),
          hub_id: Number(hub_id),
          quantidade_total: Number(nova_quantidade_total),
          quantidade_reservada: 0,
          quantidade: Number(nova_quantidade_total),
          data_entrada: new Date()
        }, { transaction });
        console.log(`[EstoquesServices] Novo estoque criado ID: ${estoque.id}`);
      } else {
        console.log(`[EstoquesServices] Estoque encontrado ID: ${estoque.id}`);
        const q = this._getQuantidades(estoque);
        console.log(`[EstoquesServices] Quantidade atual: ${q.total}, Nova quantidade: ${nova_quantidade_total}`);
        
        await this._setQuantidadesAndSave(
          estoque,
          { newTotal: Number(nova_quantidade_total) },
          transaction
        );
      }

      console.log('[EstoquesServices] Registrando movimentação de ajuste...');
      await this.logMovimentacao({
        estoque_id: estoque.id,
        produto_id: Number(produto_id),
        hub_id: Number(hub_id),
        usuario_id: Number(usuario_id),
        tipo: 'AJUSTE',
        quantidade: Number(nova_quantidade_total),
        referencia,
        transaction
      });

      if (createdHere) {
        console.log('[EstoquesServices] Fazendo commit da transação...');
        await transaction.commit();
        console.log('[EstoquesServices] Commit realizado com sucesso');
      }

      console.log(`[EstoquesServices] Ajuste de estoque concluído para estoque ID: ${estoque.id}`);
      return estoque;

    } catch (error) {
      console.error('[EstoquesServices] ERRO em ajustarEstoque:', error);

      if (createdHere && transaction && !transaction.finished) {
        console.log('[EstoquesServices] Fazendo rollback da transação...');
        try {
          await transaction.rollback();
          console.log('[EstoquesServices] Rollback realizado');
        } catch (rollbackError) {
          console.error('[EstoquesServices] Erro no rollback:', rollbackError.message);
        }
      }

      throw new Error(`Erro ao ajustar estoque: ${error.message}`);
    }
  }

  async getMovimentacoesByEstoqueId(estoqueId, options = {}) {
    console.log(`[EstoquesServices] Buscando movimentações por estoque ID: ${estoqueId}`);
    
    try {
      const movimentacoes = await db.EstoquesMovimentacoes.findAll({
        where: { estoque_id: estoqueId },
        include: [
          { model: db.Produtos },
          { model: db.Hubs },
          { model: db.Usuarios }
        ],
        order: [['data_movimentacao', 'DESC']]
      });

      console.log(`[EstoquesServices] Encontradas ${movimentacoes.length} movimentações para estoque ${estoqueId}`);
      return movimentacoes;
    } catch (error) {
      console.error(`[EstoquesServices] Erro ao buscar movimentações por estoque: ${error.message}`);
      throw new Error(`Erro ao buscar movimentações: ${error.message}`);
    }
  }

  async getMovimentacoesByProductHub(produto_id, hub_id, options = {}) {
    console.log(`[EstoquesServices] Buscando movimentações por produto ${produto_id} e hub ${hub_id}`);
    
    try {
      const movimentacoes = await db.EstoquesMovimentacoes.findAll({
        where: { produto_id, hub_id },
        include: [
          { model: db.Estoques },
          { model: db.Usuarios }
        ],
        order: [['data_movimentacao', 'DESC']]
      });

      console.log(`[EstoquesServices] Encontradas ${movimentacoes.length} movimentações`);
      return movimentacoes;
    } catch (error) {
      console.error(`[EstoquesServices] Erro ao buscar movimentações por produto/hub: ${error.message}`);
      throw new Error(`Erro ao buscar movimentações: ${error.message}`);
    }
  }

  async getLowStock({ threshold = null, hub_id = null }) {
    console.log(`[EstoquesServices] Buscando estoques baixos, threshold: ${threshold}, hub_id: ${hub_id}`);
    
    try {
      const whereHub = hub_id ? { hub_id } : {};
      const estoques = await db.Estoques.findAll({
        where: whereHub,
        include: [{ model: db.Produtos, attributes: ['id', 'nome', 'estoque_minimo'] }]
      });

      console.log(`[EstoquesServices] ${estoques.length} estoques encontrados para análise`);
      
      const low = estoques.filter(e => {
        const min = e.produto?.estoque_minimo ?? 0;
        const th = threshold ?? min;
        const disponivel = Number(e.quantidade_total || 0) - Number(e.quantidade_reservada || 0);

        const isLow = disponivel <= th;
        if (isLow) {
          console.log(`[EstoquesServices] Estoque baixo detectado: Estoque ID ${e.id}, Produto ${e.produto?.nome}, Disponível ${disponivel}, Limite ${th}`);
        }
        
        return isLow;
      });

      console.log(`[EstoquesServices] ${low.length} estoques identificados como baixos`);
      return low;
    } catch (error) {
      console.error('[EstoquesServices] Erro ao buscar estoques baixos:', error);
      throw new Error(`Erro ao buscar estoques baixos: ${error.message}`);
    }
  }

  async getSummary(produto_id, hub_id = null) {
    console.log(`[EstoquesServices] Gerando resumo para produto ${produto_id}, hub ${hub_id || 'todos'}`);
    
    try {
      const where = { produto_id };
      if (hub_id) where.hub_id = hub_id;
      
      const estoques = await db.Estoques.findAll({
        where,
        include: [{ model: db.Hubs }]
      });

      const totalFisico = estoques.reduce((s, e) => s + Number(e.quantidade_total || 0), 0);
      const totalReservado = estoques.reduce((s, e) => s + Number(e.quantidade_reservada || 0), 0);
      const disponivel = totalFisico - totalReservado;

      const summary = {
        produto_id,
        totalFisico,
        totalReservado,
        disponivel,
        porHub: estoques.map(e => ({
          hub_id: e.hub_id,
          hub_nome: e.hub?.nome,
          quantidade_total: Number(e.quantidade_total || 0),
          quantidade_reservada: Number(e.quantidade_reservada || 0),
          disponivel: Number(e.quantidade_total || 0) - Number(e.quantidade_reservada || 0)
        }))
      };

      console.log('[EstoquesServices] Resumo gerado:', summary);
      return summary;
    } catch (error) {
      console.error(`[EstoquesServices] Erro ao gerar resumo: ${error.message}`);
      throw new Error(`Erro ao gerar resumo de estoque: ${error.message}`);
    }
  }

  async getEstoqueDisponivel(produto_id, hub_id) {
    console.log(`[EstoquesServices] Buscando estoque disponível para produto ${produto_id}, hub ${hub_id}`);
    
    try {
      const estoque = await db.Estoques.findOne({
        where: { produto_id, hub_id },
        include: [{ model: db.Produtos }]
      });

      if (!estoque) {
        console.log(`[EstoquesServices] Nenhum estoque encontrado`);
        return { disponivel: 0, total: 0, reservado: 0 };
      }

      const q = this._getQuantidades(estoque);
      const disponivel = Number(q.total || 0) - Number(q.reservado || 0);

      console.log(`[EstoquesServices] Estoque disponível: ${disponivel} (Total: ${q.total}, Reservado: ${q.reservado})`);
      return {
        disponivel,
        total: Number(q.total || 0),
        reservado: Number(q.reservado || 0),
        estoque_id: estoque.id
      };
    } catch (error) {
      console.error(`[EstoquesServices] Erro ao buscar estoque disponível: ${error.message}`);
      throw new Error(`Erro ao buscar estoque disponível: ${error.message}`);
    }
  }
}

module.exports = EstoquesServices;
