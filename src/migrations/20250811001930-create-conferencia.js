'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Conferencia', {
      id_conferencia: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      transferencia_id: {
        type: Sequelize.INTEGER,
        references: { model: 'Transferencia', key: 'id' }
      },
      nome_estacao: Sequelize.STRING,
      total_AT_TO: Sequelize.INTEGER,
      total_pedidos_iniciais: Sequelize.INTEGER,
      total_pedidos_finais: Sequelize.INTEGER,
      percentual_validacao: Sequelize.DECIMAL(5, 2),
      pedidos_escaneados: Sequelize.INTEGER,
      operador_id: {
        type: Sequelize.INTEGER,
        references: { model: 'Usuarios', key: 'id' }
      },
      status: Sequelize.ENUM('CONCLUIDO', 'EM_ANDAMENTO'),
      data_criacao: Sequelize.DATE,
      data_termino: Sequelize.DATE,
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
      deletedAt: Sequelize.DATE
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Conferencia');
  }
};
