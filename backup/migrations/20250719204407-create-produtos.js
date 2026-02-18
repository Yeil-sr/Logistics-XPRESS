'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Produtos', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      nome: {
        type: Sequelize.STRING,
        allowNull: false

      },
      descricao:{
        type: Sequelize.STRING,
        allowNull: false
      },
      altura:{
        type: Sequelize.INTEGER,
        allowNull:false
      },
      largura:{
        type: Sequelize.INTEGER,
        allowNull:false
      },
     volume: {
        type: Sequelize.FLOAT,
        allowNull: false
      },
      peso_kg: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      preco: {
        type: Sequelize.FLOAT,
        allowNull: false

      },
      status:{
        type: Sequelize.STRING,
        allowNull:false
      },
      tipo_entrega:{
        type: Sequelize.STRING,
        allowNull:false
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
    await queryInterface.dropTable('Produtos');
  }
};