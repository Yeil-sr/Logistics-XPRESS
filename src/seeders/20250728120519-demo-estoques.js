'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('Estoques', [
      {
        id_produto: 1,
        quantidade: 100,
        localizacao: 'CD-SP',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Estoques', null, {});
  }
};
