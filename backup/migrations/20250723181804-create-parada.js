'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Paradas', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      id_rota: {
        type: Sequelize.INTEGER
      },
      id_pedido: {
        type: Sequelize.INTEGER
      },
      ordem_entrega: {
        type: Sequelize.INTEGER
      },
      gaiola_codigo: {
        type: Sequelize.STRING
      },
      status_parada: {
        type: Sequelize.STRING
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Paradas');
  }
};