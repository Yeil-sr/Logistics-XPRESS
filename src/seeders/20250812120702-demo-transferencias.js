// 20250812-transferencia.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const hubs = [1, 2, 7, 8, 9, 10, 11, 12, 13, 14]; 
    const transfs = [];
    for (let i = 1; i <= 10; i++) {
      transfs.push({
        numero_TO: `TO-${2000 + i}`,
        motorista_id: 1,
        origem_hub_id: hubs[i % hubs.length],
        destino_hub_id: hubs[(i + 1) % hubs.length],
        tipo_recebedor: ['HUB', 'STATION'][i % 2],
        quantidade: 100 + i,
        peso_kg: 200 + i,
        direcao: ['OUTBOUND', 'INBOUND'][i % 2],
        operador_id: 1,
        status: ['CRIADO', 'EM_TRANSPORTE', 'RECEBIDO'][i % 3],
        data_criacao: new Date(),
        data_conclusao: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      });
    }
    await queryInterface.bulkInsert('Transferencia', transfs, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Transferencia', null, {});
  }
};
