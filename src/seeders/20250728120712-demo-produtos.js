'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('Produtos', [
      {
        nome: 'Smartphone',
        descricao: 'Celular com 128GB',
        preco: 1499.90,
        volume:'200.00',
        peso_kg: 2500.00,
        status:'',
        tipo_entrega:'',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nome: 'Notebook',
        descricao: 'Intel Core i5, 8GB RAM',
        preco: 3499.00,
        volume: 2500.00,
        peso_kg: 2500.00,
        status:'',
        tipo_entrega:'',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Produtos', null, {});
  }
};
