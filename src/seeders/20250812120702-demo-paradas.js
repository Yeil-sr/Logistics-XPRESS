// 20250812-parada.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const paradas = [];
    for (let i = 1; i <= 10; i++) {
      paradas.push({
        id_rota: i,
        id_pedido: i,
        ordem_entrega: i,
        gaiola_codigo: `G-${i}`,
        status_parada: ['PENDENTE', 'EM_ENTREGA', 'ENTREGUE'][i % 3],
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      });
    }
    await queryInterface.bulkInsert('Parada', paradas, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Parada', null, {});
  }
};
