'use strict';

const Services = require('./Services');
const db = require('../models');
const EstoquesServices = require('./EstoquesServices');

class ProdutosServices extends Services {
  constructor() {
    super('Produtos');
    this.estoqueService = new EstoquesServices();
  }

  async createProduto(data = {}, options = {}) {
    console.log('[ProdutosServices] Iniciando criação de produto');
    console.log('[ProdutosServices] Dados recebidos:', JSON.stringify(data, null, 2));
    
    const externalTx = options.transaction;
    const transaction = externalTx || await db.sequelize.transaction();
    const createdHere = !externalTx;

    try {
      const {
        nome,
        s_n = null,
        p_n = null,
        mac = null,
        descricao = null,
        preco = null,
        altura = null,
        largura = null,
        volume = null,
        peso_kg = null,
        status = null,
        tipo_entrega = null,
        estoque_minimo = 0,
        initialStocks = []
      } = data;

      // Validação básica
      if (!nome || nome.trim() === '') {
        console.error('[ProdutosServices] Nome do produto não fornecido ou inválido');
        throw new Error('Campo nome é obrigatório');
      }

      console.log('[ProdutosServices] Validando estoques iniciais...');
      // Validação detalhada dos hubs
      if (initialStocks && initialStocks.length > 0) {
        console.log(`[ProdutosServices] ${initialStocks.length} estoque(s) inicial(is) fornecido(s)`);
        
        const hubIds = initialStocks.map(s => s.hub_id);
        console.log('[ProdutosServices] IDs de hubs fornecidos:', hubIds);
        
        const hubs = await db.Hubs.findAll({ 
          where: { id: hubIds }, 
          transaction,
          include: [{
            model: db.Enderecos,
            as: 'enderecos',
            attributes: ['id', 'cidade', 'estado']
          }]
        });
        
        console.log('[ProdutosServices] Hubs encontrados no banco:', hubs.map(h => ({
          id: h.id,
          nome: h.nome,
          endereco: h.enderecos ? `${h.enderecos.cidade}/${h.enderecos.estado}` : 'Sem endereço'
        })));
        
        const foundIds = hubs.map(h => h.id);
        const missing = hubIds.filter(id => !foundIds.includes(id));
        
        if (missing.length > 0) {
          console.error('[ProdutosServices] Hubs não encontrados:', missing);
          throw new Error(`Hubs não encontrados: ${missing.join(', ')}`);
        }
      } else {
        console.log('[ProdutosServices] Nenhum estoque inicial fornecido');
      }

      console.log('[ProdutosServices] Criando produto no banco de dados...');
      // Criação do produto
      const produto = await db.Produtos.create({
        nome: nome.trim(),
        s_n,
        p_n,
        mac,
        descricao,
        preco,
        altura,
        largura,
        volume,
        peso_kg,
        status,
        tipo_entrega,
        estoque_minimo
      }, { transaction });
      
      console.log(`[ProdutosServices] Produto criado com ID: ${produto.id}, Nome: ${produto.nome}`);

      // Processamento do estoque inicial
      if (initialStocks && initialStocks.length > 0) {
        console.log('[ProdutosServices] Processando estoques iniciais...');
        
        for (let i = 0; i < initialStocks.length; i++) {
          const s = initialStocks[i];
          console.log(`[ProdutosServices] Processando estoque ${i + 1}/${initialStocks.length}:`, {
            hub_id: s.hub_id,
            quantidade: s.quantidade || 0
          });
          
          try {
            await this.estoqueService.entradaEstoque({
              produto_id: produto.id,
              hub_id: s.hub_id,
              quantidade: s.quantidade || 0,
              localizacao: s.localizacao || null,
              referencia: `INITIAL_STOCK_FOR_PRODUCT_${produto.id}`,
              usuario_id: options.usuario_id || null
            }, { 
              transaction, // Reutiliza a mesma transação
              usuario_id: options.usuario_id || null
            });
            
            console.log(`[ProdutosServices] Estoque criado com sucesso para hub ${s.hub_id}`);
          } catch (estoqueError) {
            console.error(`[ProdutosServices] Erro ao criar estoque para hub ${s.hub_id}:`, estoqueError);
            throw new Error(`Falha ao criar estoque inicial: ${estoqueError.message}`);
          }
        }
        
        console.log('[ProdutosServices] Todos os estoques iniciais processados com sucesso');
      }

      // Commit da transação
      if (createdHere) {
        console.log('[ProdutosServices] Fazendo commit da transação...');
        await transaction.commit();
        console.log('[ProdutosServices] Commit realizado com sucesso');
      }

      // Busca o produto criado com relacionamentos para retorno
      console.log('[ProdutosServices] Buscando produto criado com relacionamentos...');
      const produtoCompleto = await db.Produtos.findByPk(produto.id, {
        include: [{
          model: db.Estoques,
          as: 'estoques',
          include: [{
            model: db.Hubs,
            attributes: ['id', 'nome', 'codigo_hub']
          }]
        }]
      });
      
      console.log('[ProdutosServices] Produto criado com sucesso:', {
        id: produtoCompleto.id,
        nome: produtoCompleto.nome,
        estoques: produtoCompleto.estoques ? produtoCompleto.estoques.length : 0
      });
      
      return produtoCompleto;
      
    } catch (error) {
      console.error('[ProdutosServices] ERRO na criação do produto:', error);
      console.error('[ProdutosServices] Stack trace:', error.stack);
      
      if (createdHere && transaction && !transaction.finished) {
        console.log('[ProdutosServices] Fazendo rollback da transação...');
        try {
          await transaction.rollback();
          console.log('[ProdutosServices] Rollback realizado');
        } catch (rollbackError) {
          console.error('[ProdutosServices] Erro no rollback:', rollbackError.message);
        }
      }
      
      // Melhora a mensagem de erro para o usuário
      if (error.message.includes('foreign key constraint')) {
        throw new Error('Erro de referência: Verifique se os hubs informados existem');
      } else if (error.message.includes('duplicate key')) {
        throw new Error('Produto duplicado: Já existe um produto com este nome');
      } else if (error.message.includes('validation')) {
        throw new Error(`Erro de validação: ${error.message}`);
      }
      
      throw new Error(`Erro ao criar produto: ${error.message}`);
    }
  }

  async updateProduto(id, data = {}, options = {}) {
    console.log(`[ProdutosServices] Iniciando atualização do produto ID: ${id}`);
    console.log('[ProdutosServices] Dados para atualização:', JSON.stringify(data, null, 2));
    
    const externalTx = options.transaction;
    const transaction = externalTx || await db.sequelize.transaction();
    const createdHere = !externalTx;
    
    try {
      const produto = await db.Produtos.findByPk(id, { transaction });
      if (!produto) {
        console.error(`[ProdutosServices] Produto não encontrado: ${id}`);
        throw new Error('Produto não encontrado');
      }

      console.log('[ProdutosServices] Produto encontrado:', {
        id: produto.id,
        nome: produto.nome
      });

      const updatable = {};
      const camposPermitidos = [
        'nome', 's_n', 'p_n', 'mac', 'descricao', 'preco',
        'altura', 'largura', 'volume', 'peso_kg', 'status',
        'tipo_entrega', 'estoque_minimo'
      ];
      
      camposPermitidos.forEach(k => {
        if (data[k] !== undefined) {
          updatable[k] = data[k];
          console.log(`[ProdutosServices] Campo a atualizar: ${k} = ${data[k]}`);
        }
      });

      await produto.update(updatable, { transaction });
      console.log('[ProdutosServices] Produto atualizado no banco');

      // Processa estoques iniciais se fornecidos
      if (Array.isArray(data.initialStocks)) {
        console.log(`[ProdutosServices] Processando ${data.initialStocks.length} estoque(s) para atualização`);
        
        for (let i = 0; i < data.initialStocks.length; i++) {
          const s = data.initialStocks[i];
          console.log(`[ProdutosServices] Processando estoque ${i + 1}/${data.initialStocks.length}:`, s);
          
          const hub = await db.Hubs.findByPk(s.hub_id, { transaction });
          if (!hub) {
            console.error(`[ProdutosServices] Hub não encontrado: ${s.hub_id}`);
            throw new Error(`Hub ${s.hub_id} não encontrado`);
          }

          if (s.quantidade && Number(s.quantidade) > 0) {
            console.log(`[ProdutosServices] Registrando entrada de estoque para hub ${s.hub_id}, quantidade ${s.quantidade}`);
            
            await this.estoqueService.entradaEstoque({
              produto_id: produto.id,
              hub_id: s.hub_id,
              quantidade: s.quantidade,
              localizacao: s.localizacao || null,
              referencia: `UPDATE_STOCK_PRODUCT_${produto.id}`,
              usuario_id: options.usuario_id || null
            }, { transaction });
          } else {
            console.log(`[ProdutosServices] Verificando estoque existente para hub ${s.hub_id}`);
            
            let estoque = await db.Estoques.findOne({ 
              where: { 
                produto_id: produto.id, 
                hub_id: s.hub_id 
              }, 
              transaction 
            });
            
            if (!estoque) {
              console.log(`[ProdutosServices] Criando registro de estoque vazio para hub ${s.hub_id}`);
              
              await db.Estoques.create({
                produto_id: produto.id,
                hub_id: s.hub_id,
                quantidade_total: 0,
                quantidade_reservada: 0,
                quantidade: 0,
                localizacao: s.localizacao || null
              }, { transaction });
            }
          }
        }
      }

      if (createdHere) {
        console.log('[ProdutosServices] Commit da transação...');
        await transaction.commit();
        console.log('[ProdutosServices] Commit realizado');
      }

      const produtoAtualizado = await db.Produtos.findByPk(id, {
        include: [{
          model: db.Estoques,
          as: 'estoques',
          include: [{
            model: db.Hubs,
            attributes: ['id', 'nome']
          }]
        }]
      });
      
      console.log('[ProdutosServices] Produto atualizado com sucesso');
      return produtoAtualizado;
      
    } catch (error) {
      console.error('[ProdutosServices] ERRO na atualização do produto:', error);
      console.error('[ProdutosServices] Stack trace:', error.stack);
      
      if (createdHere && transaction && !transaction.finished) {
        console.log('[ProdutosServices] Fazendo rollback...');
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.error('[ProdutosServices] Erro no rollback:', rollbackError);
        }
      }
      throw error;
    }
  }

  async deleteProduto(id, options = {}) {
    console.log(`[ProdutosServices] Iniciando exclusão do produto ID: ${id}`);
    
    const externalTx = options.transaction;
    const transaction = externalTx || await db.sequelize.transaction();
    const createdHere = !externalTx;
    
    try {
      const produto = await db.Produtos.findByPk(id, { transaction });
      if (!produto) {
        console.error(`[ProdutosServices] Produto não encontrado: ${id}`);
        throw new Error('Produto não encontrado');
      }

      console.log('[ProdutosServices] Verificando estoques do produto...');
      const resumo = await this.estoqueService.getSummary(id, null);
      
      console.log('[ProdutosServices] Resumo de estoque:', {
        produto_id: id,
        totalFisico: resumo.totalFisico,
        totalReservado: resumo.totalReservado,
        disponivel: resumo.disponivel
      });
      
      if (resumo.totalFisico > 0) {
        console.error(`[ProdutosServices] Produto possui ${resumo.totalFisico} unidades em estoque físico`);
        throw new Error('Não é possível excluir produto com estoque físico. Ajuste o estoque antes.');
      }

      console.log('[ProdutosServices] Excluindo produto...');
      await produto.destroy({ transaction });

      if (createdHere) {
        console.log('[ProdutosServices] Commit da transação...');
        await transaction.commit();
        console.log('[ProdutosServices] Produto excluído com sucesso');
      }

      return { 
        success: true, 
        message: 'Produto excluído com sucesso',
        produto: {
          id: produto.id,
          nome: produto.nome
        }
      };
      
    } catch (error) {
      console.error('[ProdutosServices] ERRO ao excluir produto:', error);
      
      if (createdHere && transaction && !transaction.finished) {
        console.log('[ProdutosServices] Fazendo rollback...');
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.error('[ProdutosServices] Erro no rollback:', rollbackError);
        }
      }
      throw error;
    }
  }

  async getSummary(produto_id, hub_id = null) {
    console.log(`[ProdutosServices] Buscando resumo para produto ${produto_id}, hub ${hub_id || 'todos'}`);
    
    const resumo = await this.estoqueService.getSummary(produto_id, hub_id);
    
    console.log('[ProdutosServices] Resumo encontrado:', resumo);
    return resumo;
  }

  async getAllProdutos(filters = {}) {
    console.log('[ProdutosServices] Buscando todos os produtos com filtros:', filters);
    
    const where = {};
    
    if (filters.nome) {
      where.nome = { [db.Sequelize.Op.like]: `%${filters.nome}%` };
    }
    
    if (filters.status) {
      where.status = filters.status;
    }
    
    if (filters.tipo_entrega) {
      where.tipo_entrega = filters.tipo_entrega;
    }

    try {
      const produtos = await db.Produtos.findAll({
        where,
        include: [{
          model: db.Estoques,
          as: 'estoques',
          include: [{
            model: db.Hubs,
            attributes: ['id', 'nome']
          }]
        }],
        order: [['nome', 'ASC']]
      });
      
      console.log(`[ProdutosServices] Encontrados ${produtos.length} produtos`);
      return produtos;
    } catch (error) {
      console.error('[ProdutosServices] Erro ao buscar produtos:', error);
      throw new Error(`Erro ao buscar produtos: ${error.message}`);
    }
  }

  async getProdutoById(id) {
    console.log(`[ProdutosServices] Buscando produto por ID: ${id}`);
    
    try {
      const produto = await db.Produtos.findByPk(id, {
        include: [{
          model: db.Estoques,
          as: 'estoques',
          include: [{
            model: db.Hubs,
            attributes: ['id', 'nome', 'codigo_hub']
          }]
        }]
      });
      
      if (!produto) {
        console.error(`[ProdutosServices] Produto não encontrado: ${id}`);
        throw new Error('Produto não encontrado');
      }
      
      console.log(`[ProdutosServices] Produto encontrado: ${produto.nome}`);
      return produto;
    } catch (error) {
      console.error(`[ProdutosServices] Erro ao buscar produto por ID: ${error.message}`);
      throw new Error(`Erro ao buscar produto: ${error.message}`);
    }
  }

  async getProdutosComEstoqueBaixo(threshold = null) {
    console.log(`[ProdutosServices] Buscando produtos com estoque baixo, threshold: ${threshold || 'padrão'}`);
    
    try {
      const produtos = await db.Produtos.findAll({
        include: [{
          model: db.Estoques,
          as: 'estoques',
          include: [{
            model: db.Hubs,
            attributes: ['id', 'nome']
          }]
        }]
      });
      
      const produtosComEstoqueBaixo = produtos.filter(produto => {
        const estoqueTotal = produto.estoques.reduce((total, estoque) => {
          return total + (estoque.quantidade_total || 0);
        }, 0);
        
        const estoqueMinimo = produto.estoque_minimo || 0;
        const limite = threshold !== null ? threshold : estoqueMinimo;
        
        return estoqueTotal <= limite;
      });
      
      console.log(`[ProdutosServices] Encontrados ${produtosComEstoqueBaixo.length} produtos com estoque baixo`);
      return produtosComEstoqueBaixo;
    } catch (error) {
      console.error('[ProdutosServices] Erro ao buscar produtos com estoque baixo:', error);
      throw new Error(`Erro ao buscar produtos com estoque baixo: ${error.message}`);
    }
  }
}

module.exports = ProdutosServices;
