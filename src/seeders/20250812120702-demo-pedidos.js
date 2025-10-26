// 20250812-pedidos.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const pedidos = [];
    for (let i = 1; i <=10; i++) {
      pedidos.push({
        codigo_pedido: `PED-${1000 + i}`,
        status: ['PENDENTE', 'PROCESSANDO', 'EM_ROTA', 'ENTREGUE'][i % 4],
        data_criacao: new Date(),
        cliente_id: i,
        endereco_id: i,
        produto_id: i,
        recebimento_id: i,
        transferencia_id: i,
        conferencia_id: i,
        etiqueta_qr: `QR-${1000 + i}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      });
    }
    await queryInterface.bulkInsert('Pedidos', pedidos, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Pedidos', null, {});
  }
};
