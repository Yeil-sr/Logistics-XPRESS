'use strict';

const fs = require('fs');
const path = require('path');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const filePath = path.join(__dirname, 'pedidos-25-08.json');
    const rawData = fs.readFileSync(filePath);
    const pedidos = JSON.parse(rawData);

    const pedidosData = pedidos.map(pedido => ({
      id: pedido.id,
      codigo_pedido: pedido.codigo_pedido,
      status: pedido.status,
      data_criacao: pedido.data_criacao ? new Date(pedido.data_criacao) : null,
      cliente_id: pedido.cliente_id || null,
      endereco_id: pedido.endereco_id || null,
      produto_id: pedido.produto_id || null,
      recebimento_id: pedido.recebimento_id || null,
      transferencia_id: pedido.transferencia_id || null,
      conferencia_id: pedido.conferencia_id || null,
      etiqueta_qr: pedido.etiqueta_qr || null,
      createdAt: pedido.createdAt ? new Date(pedido.createdAt) : new Date(),
      updatedAt: pedido.updatedAt ? new Date(pedido.updatedAt) : new Date(),
      deletedAt: pedido.deletedAt ? new Date(pedido.deletedAt) : null
    }));

    await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await queryInterface.bulkInsert('Pedidos', pedidosData, {});
    await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await queryInterface.bulkDelete('Pedidos', null, {});
    await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
  }
};
