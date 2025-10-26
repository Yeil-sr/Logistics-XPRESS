// 20250812-recebimento.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const recs = [];
    for (let i = 1; i <= 10; i++) {
      recs.push({
        tipo_tarefa: ['INBOUND', 'RETORNO'][i % 2],
        metodo_recebimento: ['MANUAL', 'MANIFESTO'][i % 2],
        numero_manifesto: `MAN-${4000 + i}`,
        status: ['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO'][i % 3],
        quantidade_pedidos: 10 + i,
        operador_id: 1,
        data_criacao: new Date(),
        data_conclusao: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      });
    }
    await queryInterface.bulkInsert('Recebimento', recs, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Recebimento', null, {});
  }
};
