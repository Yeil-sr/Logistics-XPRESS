// 20250812-transporte.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const hubs = [1, 2, 7, 8, 9, 10, 11, 12, 13, 14];
    const transp = [];
    for (let i = 1; i <= 10; i++) {
      transp.push({
        tipo_transporte: ['TO', 'LH'][i % 2],
        numero_transporte: `TR-${3000 + i}`,
        recebedor_tipo: ['HUB', 'STATION'][i % 2],
        hub_origem_id: hubs[i % hubs.length],
        recebimento_id: i,
        hub_destino_id: hubs[(i + 1) % hubs.length],
        motorista_id: 1,
        rota_id: i,
        quantidade_total: 50 + i,
        peso_total_kg: 100 + i,
        volumetria_total: 200 + i,
        direcao: ['INBOUND', 'OUTBOUND'][i % 2],
        status_transporte: ['CRIADO', 'EM_TRANSPORTE', 'RECEBIDO'][i % 3],
        operador_id: 1,
        data_criacao: new Date(),
        data_conclusao: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      });
    }
    await queryInterface.bulkInsert('Transporte', transp, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Transporte', null, {});
  }
};
