'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * GERAÇÃO DE RASTREAMENTOS PARA OS 8000 PEDIDOS
     */
    console.log('📍 Iniciando criação de rastreamentos...');

    // Buscar todos os pedidos com seus status
    const [pedidos] = await queryInterface.sequelize.query(`
      SELECT id, status, data_criacao 
      FROM Pedidos 
      ORDER BY id
    `);

    if (pedidos.length === 0) {
      throw new Error('Nenhum pedido encontrado. Execute a seed de pedidos primeiro.');
    }

    console.log(`📦 Encontrados ${pedidos.length} pedidos para rastreamento`);

    const rastreamentosBatch = [];
    const batchSize = 1000;
    const totalBatches = Math.ceil(pedidos.length / batchSize);

    // Mapeamento de status do pedido para status de rastreamento
    const mapStatusRastreamento = (statusPedido) => {
      switch (statusPedido) {
        case 'PENDENTE':
        case 'PROCESSANDO':
        case 'AGUARDANDO_CONFERENCIA':
        case 'AGUARDANDO_SEPARACAO':
        case 'VALIDADO':
        case 'EM_ESTOQUE':
          return 'NO_HUB';
        case 'EM_ROTA':
          return 'EM_ROTA';
        case 'ENTREGUE':
          return 'ENTREGUE';
        case 'CANCELADO':
          return 'EXCECAO';
        default:
          return 'NO_HUB';
      }
    };

    // Gerar localizações baseadas no status
    const gerarLocalizacao = (statusRastreamento, pedidoId) => {
      const hubs = [
        'Centro de Distribuição Serra - ES',
        'Centro de Transferência Vitória - ES', 
        'CD Ambev - Guarulhos - SP',
        'CD Coca-Cola - Rio de Janeiro - RJ',
        'CD Nestlé - Jundiaí - SP',
        'Centro Logístico Unilever - BH - MG',
        'CD BRF - Volta Redonda - RJ',
        'CD Carrefour - Contagem - MG',
        'Centro Distribuição GPA - São José dos Campos - SP',
        'Base Magazine Luiza - Rio de Janeiro - RJ'
      ];

      const cidadesRota = [
        'São Paulo - SP',
        'Rio de Janeiro - RJ',
        'Belo Horizonte - MG',
        'Vitória - ES',
        'Campinas - SP',
        'Guarulhos - SP',
        'São José dos Campos - SP',
        'Volta Redonda - RJ',
        'Contagem - MG',
        'Jundiaí - SP'
      ];

      switch (statusRastreamento) {
        case 'NO_HUB':
          return hubs[pedidoId % hubs.length];
        case 'EM_ROTA':
          return `Em trânsito para ${cidadesRota[pedidoId % cidadesRota.length]}`;
        case 'ENTREGUE':
          return `Entregue em ${cidadesRota[pedidoId % cidadesRota.length]}`;
        case 'EXCECAO':
          return 'Centro de Distribuição Principal - Exceção';
        default:
          return hubs[0];
      }
    };

    // Gerar data de status baseada no status do pedido
    const gerarDataStatus = (dataCriacao, statusRastreamento, pedidoId) => {
      const data = new Date(dataCriacao);
      
      switch (statusRastreamento) {
        case 'NO_HUB':
          // Mantém próxima à data de criação
          data.setHours(data.getHours() + (pedidoId % 24));
          break;
        case 'EM_ROTA':
          // 1-3 dias após a criação
          data.setDate(data.getDate() + 1 + (pedidoId % 3));
          data.setHours(8 + (pedidoId % 10));
          break;
        case 'ENTREGUE':
          // 2-5 dias após a criação
          data.setDate(data.getDate() + 2 + (pedidoId % 4));
          data.setHours(14 + (pedidoId % 8));
          break;
        case 'EXCECAO':
          // 1-2 dias após a criação
          data.setDate(data.getDate() + 1 + (pedidoId % 2));
          data.setHours(10 + (pedidoId % 6));
          break;
      }
      
      return data;
    };

    for (let batch = 0; batch < totalBatches; batch++) {
      const currentBatchSize = Math.min(batchSize, pedidos.length - (batch * batchSize));
      const batchRastreamentos = [];

      for (let i = 0; i < currentBatchSize; i++) {
        const pedidoIndex = batch * batchSize + i;
        const pedido = pedidos[pedidoIndex];
        
        const statusRastreamento = mapStatusRastreamento(pedido.status);
        const localizacao = gerarLocalizacao(statusRastreamento, pedido.id);
        const dataStatus = gerarDataStatus(pedido.data_criacao, statusRastreamento, pedido.id);

        batchRastreamentos.push({
          pedido_id: pedido.id,
          status_atual: statusRastreamento,
          data_status: dataStatus,
          localizacao: localizacao,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // Inserir lote atual
      await queryInterface.bulkInsert('Rastreamentos', batchRastreamentos);
      console.log(`📍 Lote ${batch + 1}/${totalBatches} inserido: ${batchRastreamentos.length} rastreamentos`);
    }

    /**
     * CRIAR HISTÓRICO DE RASTREAMENTO PARA PEDIDOS EM ROTA E ENTREGUES
     */
    console.log('🕒 Criando histórico de rastreamento...');

    // Para pedidos EM_ROTA e ENTREGUE, criar histórico de NO_HUB -> EM_ROTA -> (ENTREGUE)
    const [pedidosComHistoria] = await queryInterface.sequelize.query(`
      SELECT id, status, data_criacao 
      FROM Pedidos 
      WHERE status IN ('EM_ROTA', 'ENTREGUE')
      ORDER BY id
    `);

    console.log(`📋 ${pedidosComHistoria.length} pedidos para histórico de rastreamento`);

    const historicoBatch = [];
    const historicoBatchSize = 500;

    for (let i = 0; i < pedidosComHistoria.length; i++) {
      const pedido = pedidosComHistoria[i];
      
      // Data para status NO_HUB (antes de sair para entrega)
      const dataNoHub = new Date(pedido.data_criacao);
      dataNoHub.setDate(dataNoHub.getDate() + 1);
      dataNoHub.setHours(9 + (pedido.id % 8));

      historicoBatch.push({
        pedido_id: pedido.id,
        status_atual: 'NO_HUB',
        data_status: dataNoHub,
        localizacao: 'Centro de Distribuição Principal - Pronto para expedição',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Se o pedido foi ENTREGUE, adicionar também status EM_ROTA
      if (pedido.status === 'ENTREGUE') {
        const dataEmRota = new Date(dataNoHub);
        dataEmRota.setDate(dataEmRota.getDate() + 1);
        dataEmRota.setHours(8 + (pedido.id % 6));

        historicoBatch.push({
          pedido_id: pedido.id,
          status_atual: 'EM_ROTA',
          data_status: dataEmRota,
          localizacao: 'Saiu para entrega - Centro de Distribuição',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // Inserir em lotes para evitar memory issues
      if (historicoBatch.length >= historicoBatchSize) {
        await queryInterface.bulkInsert('Rastreamentos', historicoBatch);
        console.log(`📊 Histórico: ${historicoBatch.length} registros inseridos`);
        historicoBatch.length = 0; // Limpa o array
      }
    }

    // Inserir restante do histórico
    if (historicoBatch.length > 0) {
      await queryInterface.bulkInsert('Rastreamentos', historicoBatch);
      console.log(`📊 Histórico final: ${historicoBatch.length} registros inseridos`);
    }

    console.log('🎉 Rastreamentos criados com sucesso!');
    console.log(`📍 Total de registros de rastreamento: ${await queryInterface.sequelize.query('SELECT COUNT(*) as total FROM Rastreamentos', { type: queryInterface.sequelize.QueryTypes.SELECT })}`);
  },

  async down(queryInterface, Sequelize) {
    /**
     * LIMPEZA DOS RASTREAMENTOS
     */
    console.log('🧹 Iniciando limpeza dos rastreamentos...');
    
    // Remover em lotes para evitar timeout no SQLite
    const batchSize = 1000;
    let deletedCount = 0;
    
    do {
      const [result] = await queryInterface.sequelize.query(`
        DELETE FROM Rastreamentos 
        WHERE id IN (
          SELECT id FROM Rastreamentos 
          LIMIT ${batchSize}
        )
      `);
      
      deletedCount = result;
      console.log(`🗑️  Lote removido: ${deletedCount} rastreamentos`);
      
      // Pequena pausa para evitar lock do SQLite
      await new Promise(resolve => setTimeout(resolve, 100));
    } while (deletedCount > 0);

    console.log('✅ Limpeza de rastreamentos concluída!');
  }
};
