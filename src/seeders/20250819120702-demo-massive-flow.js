'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * GERAÇÃO DE 8000 PEDIDOS - VERSÃO SQLITE COMPATÍVEL
     */
    const totalPedidos = 8000;
    const pedidosBatch = [];

    // Buscar IDs existentes das seeds anteriores
    const [clientes] = await queryInterface.sequelize.query('SELECT id FROM Clientes ORDER BY id');
    const [enderecos] = await queryInterface.sequelize.query('SELECT id FROM Enderecos ORDER BY id');
    const [produtos] = await queryInterface.sequelize.query('SELECT id FROM Produtos ORDER BY id');

    if (clientes.length === 0 || enderecos.length === 0 || produtos.length === 0) {
      throw new Error('É necessário ter clientes, endereços e produtos cadastrados antes de rodar a seed.');
    }

    console.log(`📊 Dados encontrados: ${clientes.length} clientes, ${enderecos.length} endereços, ${produtos.length} produtos`);

    // Status possíveis para os pedidos
    const statusList = [
      'PENDENTE',
      'PROCESSANDO', 
      'EM_ROTA',
      'ENTREGUE',
      'CANCELADO',
      'AGUARDANDO_CONFERENCIA',
      'AGUARDANDO_SEPARACAO',
      'VALIDADO',
      'EM_ESTOQUE'
    ];

    // Gerar pedidos em lotes para evitar memory leaks
    const batchSize = 1000;
    const totalBatches = Math.ceil(totalPedidos / batchSize);

    for (let batch = 0; batch < totalBatches; batch++) {
      const currentBatchSize = Math.min(batchSize, totalPedidos - (batch * batchSize));
      const batchPedidos = [];

      for (let i = 0; i < currentBatchSize; i++) {
        const pedidoIndex = batch * batchSize + i;
        const clienteIndex = pedidoIndex % clientes.length;
        const enderecoIndex = pedidoIndex % enderecos.length;
        const produtoIndex = pedidoIndex % produtos.length;
        
        // Distribuição realista de status
        let status;
        if (pedidoIndex < 1000) status = 'ENTREGUE';
        else if (pedidoIndex < 2000) status = 'EM_ROTA';
        else if (pedidoIndex < 3000) status = 'PROCESSANDO';
        else if (pedidoIndex < 3500) status = 'CANCELADO';
        else if (pedidoIndex < 4500) status = 'AGUARDANDO_SEPARACAO';
        else if (pedidoIndex < 5500) status = 'AGUARDANDO_CONFERENCIA';
        else if (pedidoIndex < 6500) status = 'VALIDADO';
        else if (pedidoIndex < 7500) status = 'EM_ESTOQUE';
        else status = 'PENDENTE';

        // Data de criação distribuída ao longo do último ano
        const dataCriacao = new Date();
        dataCriacao.setDate(dataCriacao.getDate() - Math.floor(Math.random() * 365));

        batchPedidos.push({
          codigo_pedido: `PED${String(10000 + pedidoIndex + 1).padStart(6, '0')}`,
          status: status,
          data_criacao: dataCriacao,
          cliente_id: clientes[clienteIndex].id,
          endereco_id: enderecos[enderecoIndex].id,
          produto_id: produtos[produtoIndex].id,
          recebimento_id: null,
          transferencia_id: null,
          conferencia_id: null,
          etiqueta_qr: `QR${String(pedidoIndex + 1).padStart(8, '0')}`,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // Inserir lote atual
      await queryInterface.bulkInsert('Pedidos', batchPedidos);
      console.log(`✅ Lote ${batch + 1}/${totalBatches} inserido: ${batchPedidos.length} pedidos`);
    }

    console.log(`🎉 Criação de ${totalPedidos} pedidos concluída!`);

    /**
     * SIMULAÇÃO DE FLUXO LOGÍSTICO BÁSICO
     * (Sem as dependências complexas do fluxo original)
     */

    // Atualizar alguns pedidos para simular fluxo de conferência
    console.log('🔄 Simulando fluxo de conferência...');
    await queryInterface.sequelize.query(`
      UPDATE Pedidos 
      SET status = 'VALIDADO', 
          conferencia_id = 1,
          updatedAt = datetime('now')
      WHERE status IN ('AGUARDANDO_CONFERENCIA', 'PROCESSANDO')
      LIMIT 1500
    `);

    // Atualizar alguns pedidos para simular separação
    console.log('📦 Simulando fluxo de separação...');
    await queryInterface.sequelize.query(`
      UPDATE Pedidos 
      SET status = 'EM_ROTA',
          updatedAt = datetime('now')
      WHERE status = 'VALIDADO'
      LIMIT 1000
    `);

    // Simular algumas entregas
    console.log('🚚 Simulando entregas...');
    await queryInterface.sequelize.query(`
      UPDATE Pedidos 
      SET status = 'ENTREGUE',
          updatedAt = datetime('now')
      WHERE status = 'EM_ROTA'
      LIMIT 800
    `);

    console.log('🏁 Fluxo simulado concluído!');
  },

  async down(queryInterface, Sequelize) {
    /**
     * LIMPEZA COMPLETA - SQLITE COMPATÍVEL
     */
    console.log('🧹 Iniciando limpeza dos dados...');
    
    // Remover pedidos em lotes para evitar timeout
    const batchSize = 1000;
    let deletedCount = 0;
    
    do {
      const [result] = await queryInterface.sequelize.query(`
        DELETE FROM Pedidos 
        WHERE id IN (
          SELECT id FROM Pedidos 
          LIMIT ${batchSize}
        )
      `);
      
      deletedCount = result;
      console.log(`🗑️  Lote removido: ${deletedCount} pedidos`);
      
      // Pequena pausa para evitar lock do SQLite
      await new Promise(resolve => setTimeout(resolve, 100));
    } while (deletedCount > 0);

    console.log('✅ Limpeza concluída!');
  }
};
