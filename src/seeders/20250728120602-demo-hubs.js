'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('Hubs', [
      {
        nome: 'Centro de Distribuição Serra',
        endereco_id:1,
        createdAt: new Date(),
        updatedAt: new Date()
       
      },
      {
        nome: 'Centro de Transferência Vitória',
        endereco_id:2,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Hubs', null, {});
  }
};
