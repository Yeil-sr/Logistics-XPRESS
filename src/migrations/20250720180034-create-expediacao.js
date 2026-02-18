'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Separacao', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      id_pedido: { 
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Pedidos', key: 'id' },
        onUpdate: 'CASCADE', 
        onDelete: 'CASCADE'
      },
      id_conferencia: {
        type: Sequelize.INTEGER,
        references: { model: 'Conferencia', key: 'id' },
        onUpdate: 'CASCADE', 
        onDelete: 'SET NULL'
      },
      id_rota: {
        type: Sequelize.INTEGER,
        references: { model: 'Rota', key: 'id' },
        onUpdate: 'CASCADE', 
        onDelete: 'SET NULL'
      },
      data_separacao: Sequelize.DATE,
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
      deletedAt: Sequelize.DATE
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Separacao');
  }
};
