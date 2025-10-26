// 20250812-separacao.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const seps = [];
    for (let i = 1; i <= 10; i++) {
      seps.push({
        id_pedido: i,
        id_conferencia: i,
        corredor_gaiola: `C${i}-G${i}`,
        status: ['PENDENTE', 'SEPARADO'][i % 2],
        data_separacao: new Date().toISOString(),
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      });
    }
    await queryInterface.bulkInsert('Separacaos', seps, {}); // Atenção: nome da tabela real pode diferir
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Separacaos', null, {});
  }
};
