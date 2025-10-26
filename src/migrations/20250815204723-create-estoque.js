'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Estoques', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      id_produto: {
        type: Sequelize.INTEGER
      },
      id_pedido:{
        type: Sequelize.INTEGER
      },
      hub_id:{
        type:Sequelize.INTEGER
      },

      quantidade: {
        type: Sequelize.INTEGER
      },
      localizacao: {
        type: Sequelize.STRING
      },
      data_entrada:{
        type: Sequelize.DATE
      },
      data_saida:{
        type: Sequelize.DATE
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
    await queryInterface.dropTable('Estoques');
  }
};