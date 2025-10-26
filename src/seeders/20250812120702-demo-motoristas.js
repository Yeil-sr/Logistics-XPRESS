// 20250812-motorista.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const motoristas = [];
    for (let i = 1; i <= 10; i++) {
      motoristas.push({
        nome: `Motorista ${i}`,
        veiculo: `Caminhão ${100 + i}`,
        telefone: `+55 11 9${Math.floor(80000000 + Math.random() * 9999999)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      });
    }
    await queryInterface.bulkInsert('Motorista', motoristas, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Motorista', null, {});
  }
};

