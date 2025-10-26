'use strict';

const produtoData = require('../../../../../produto-25-08.json'); 

module.exports = {
  async up(queryInterface, Sequelize) {
    const estoqueEntries = produtoData
      .filter(produto => produto.status === 'ativo')
      .map(produto => ({
        id_produto: produto.id,
        quantidade: Math.floor(Math.random() * 100) + 1,
        hub_id: Math.floor(Math.random() * 5) + 1,
        localizacao: `CORREDOR-${String(Math.floor(Math.random() * 10) + 1).padStart(2, '0')}, PRATELEIRA-${String(Math.floor(Math.random() * 20) + 1).padStart(2, '0')}`,
        data_entrada: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }));

    await queryInterface.bulkInsert('estoques', estoqueEntries, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('estoques', null, {});
  }
};