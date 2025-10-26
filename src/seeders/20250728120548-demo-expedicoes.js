'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('Expediacaos', [
      {
        id_pedido: '1',
        nota_fiscal: 'NF123456',
        codigo_rastreamento: 'R123456789BR',
        data_envio: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Expediacaos', null, {});
  }
};
