'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { Pedidos, Clientes, Produtos, Endereco, Recebimento, Conferencia, Separacao, Rota, Expediacao, Coleta } = require('../models');

    const totalPedidos = 8000;
    const pedidosBatch = [];

    // Buscar IDs existentes
    const clientes = await Clientes.findAll();
    const enderecos = await Endereco.findAll();
    const produtos = await Produtos.findAll();

    if (clientes.length === 0 || enderecos.length === 0 || produtos.length === 0) {
      throw new Error('É necessário ter clientes, endereços e produtos cadastrados antes de rodar a seed.');
    }

    /**
     * 1️⃣ Criar Pedidos
     */
    for (let i = 0; i < totalPedidos; i++) {
      pedidosBatch.push({
        codigo_pedido: `PED${10000 + i + 1}`,
        cliente_id: clientes[i % clientes.length].id,   
        produto_id: produtos[i % produtos.length].id,  
        endereco_id: enderecos[i % enderecos.length].id,
        status: 'PENDENTE',
        data_criacao: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    const pedidos = await Pedidos.bulkCreate(pedidosBatch, { returning: true });

    /**
     * 2️⃣ Coleta (hook → IN_TRANSIT)
     */
    await Coleta.create({
      id_pedido: pedidos[0].id,
      id_motorista: 1,
      status: 'REALIZADA',
      data_coleta: new Date()
    });

    /**
     * 3️⃣ Recebimento (hook → RECEIVED → PROCESSANDO)
     */
    await Recebimento.create({
      quantidade_pedidos: totalPedidos,
      operador_id: 1,
      status: 'CONCLUIDO',
      data_criacao: new Date()
    });

    /**
     * 4️⃣ Conferência Inbound (hook → STOCKED → EM_ESTOQUE)
     */
    await Conferencia.create({
      transferencia_id: null,
      nome_estacao: 'Inbound HUB',
      status: 'CONCLUIDO',
      operador_id: 1,
      data_criacao: new Date()
    });

    /**
     * 5️⃣ Separação (20 corredores → hook → READY_FOR_SHIPPING)
     */
    const corredores = 20;
    const separacoes = pedidos.map((pedido, index) => ({
      id_pedido: pedido.id,
      status: 'SEPARADO',
      corredor_gaiola: `C-${(index % corredores) + 1}`,
      data_separacao: new Date()
    }));
    await Separacao.bulkCreate(separacoes);

    /**
     * 6️⃣ Conferência Outbound (10 rotas simuladas)
     */
    const rotas = [];
    const pedidosPorRota = Math.ceil(totalPedidos / 10);

    for (let r = 0; r < 10; r++) {
      await Conferencia.create({
        transferencia_id: null,
        nome_estacao: `Outbound HUB Rota ${r + 1}`,
        status: 'CONCLUIDO',
        operador_id: 2,
        data_criacao: new Date()
      });

      const rota = await Rota.create({
        id_motorista: (r % 5) + 1,
        cluster: `Cluster ${r + 1}`,
        status_rota: 'CRIADA',
        numero_paradas: pedidosPorRota,
        data_criacao: new Date()
      });
      rotas.push(rota);

      const pedidosRota = pedidos.slice(r * pedidosPorRota, (r + 1) * pedidosPorRota);
      for (const pedido of pedidosRota) {
        await pedido.update({ transferencia_id: rota.id });
      }
    }

    /**
     * 7️⃣ Finalizar todas as rotas (hook → ENTREGUE + expedição)
     */
    for (const rota of rotas) {
      await rota.update({ status_rota: 'FINALIZADA' });
    }
  },

  async down(queryInterface, Sequelize) {
    const { Pedidos, Recebimento, Conferencia, Separacao, Rota, Expediacao, Coleta } = require('../models');
    await Expediacao.destroy({ where: {} });
    await Rota.destroy({ where: {} });
    await Separacao.destroy({ where: {} });
    await Conferencia.destroy({ where: {} });
    await Recebimento.destroy({ where: {} });
    await Coleta.destroy({ where: {} });
    await Pedidos.destroy({ where: {} });
  }
};
