'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Rastreamento', {
      id_rastreamento: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      id_pedido: {
        type: Sequelize.INTEGER,
        references: { model: 'Pedidos', key: 'id' }
      },
      status_atual: Sequelize.STRING,
      data_status: Sequelize.DATE,
      localizacao: Sequelize.STRING,
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
      deletedAt: Sequelize.DATE
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Rastreamento');
  }
};
