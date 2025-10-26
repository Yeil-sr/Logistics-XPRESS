'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('Rastreamentos', [
      {
        id_pedido: '1',
        status_atual: 'Em trânsito',
        data_status: new Date(),
        localizacao: 'São Paulo - SP',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Rastreamentos', null, {});
  }
};
