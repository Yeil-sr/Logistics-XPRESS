'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const hubs = [1, 2, 7, 8, 9, 10, 11, 12, 13, 14]; // IDs do hubs.json
    const rotas = [];

    for (let i = 1; i <= 10; i++) {
      rotas.push({
        codigo_rota: `RTA-${100 + i}`,
        descricao: `Rota de entrega ${i}`,
        origem_hub_id: hubs[i % hubs.length],
        destino_hub_id: hubs[(i + 1) % hubs.length],
        distancia_km: (50 + i) * 1.5,
        tempo_estimado_min: (30 + i) * 2,
        status: ['ATIVA', 'INATIVA'][i % 2],
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      });
    }

    await queryInterface.bulkInsert('Rota', rotas, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Rota', null, {});
  }
};
