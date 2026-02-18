// 20250812-conferencia.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const confs = [];
    for (let i = 1; i <= 10; i++) {
      confs.push({
        transferencia_id: i,
        nome_estacao: `Estação ${i}`,
        total_AT_TO: 50 + i,
        total_pedidos_iniciais: 100 + i,
        total_pedidos_finais: 95 + i,
        percentual_validacao: 95.5,
        pedidos_escaneados: 95,
        operador_id: 1,
        status: ['CONCLUIDO', 'EM_ANDAMENTO'][i % 2],
        data_criacao: new Date(),
        data_termino: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      });
    }
    await queryInterface.bulkInsert('Conferencia', confs, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Conferencia', null, {});
  }
};
