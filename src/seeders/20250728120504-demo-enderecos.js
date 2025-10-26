'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('Enderecos', [
      {
        logradouro: 'Rua das Flores',
        cidade: 'Serra',
        estado: 'ES',
        cep: '29175100',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        logradouro: 'Av. Vitória',
        cidade: 'Vitória',
        estado: 'ES',
        cep: '29000000',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Enderecos', null, {});
  }
};
