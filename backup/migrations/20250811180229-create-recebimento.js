'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Recebimento', {
      id_recebimento: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      tipo_tarefa: {
        type: Sequelize.ENUM('inbound', 'retorno'),
        allowNull: false
      },
      metodo_recebimento: {
        type: Sequelize.ENUM('manual', 'manifesto'),
        allowNull: false
      },
      numero_manifesto: {
        type: Sequelize.STRING,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'EXCECAO'),
        defaultValue: 'PENDENTE'
      },
      quantidade_pedidos: Sequelize.INTEGER,
      operador_id: {
        type: Sequelize.INTEGER,
        references: { model: 'Usuarios', key: 'id' }
      },
      data_criacao: Sequelize.DATE,
      data_conclusao: Sequelize.DATE,
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
      deletedAt: Sequelize.DATE
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Recebimento');
  }
};
