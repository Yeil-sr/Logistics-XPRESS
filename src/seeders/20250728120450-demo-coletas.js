'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('Coleta', [
      {
        id_pedido: 1,
        id_motorista: 1,
        data_coleta: new Date(),
        status: 'pendente',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Coleta', null, {});
  }
};
