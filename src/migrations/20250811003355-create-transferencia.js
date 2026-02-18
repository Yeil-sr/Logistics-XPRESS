'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Transferencia', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      numero_TO: { type: Sequelize.STRING, allowNull: false, unique: true },
      motorista_id: {
        type: Sequelize.INTEGER,
        references: { model: 'Motorista', key: 'id' }
      },
      origem_hub_id: {
        type: Sequelize.INTEGER,
        references: { model: 'Hubs', key: 'id' }
      },
      destino_hub_id: {
        type: Sequelize.INTEGER,
        references: { model: 'Hubs', key: 'id' }
      },
      tipo_recebedor: Sequelize.ENUM('HUB', 'STATION'),
      quantidade: Sequelize.INTEGER,
      peso_kg: Sequelize.DECIMAL(10, 2),
      direcao: Sequelize.ENUM('OUTBOUND', 'INBOUND'),
      operador_id: {
        type: Sequelize.INTEGER,
        references: { model: 'Usuarios', key: 'id' }
      },
      status: Sequelize.ENUM('CRIADO', 'EM_TRANSPORTE', 'RECEBIDO'),
      data_criacao: Sequelize.DATE,
      data_conclusao: Sequelize.DATE,
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
      deletedAt: Sequelize.DATE
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Transferencia');
  }
};
