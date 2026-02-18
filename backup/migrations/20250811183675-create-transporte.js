'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Transporte', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      tipo_transporte: {
        type: Sequelize.ENUM('TO', 'LH'),
        allowNull: false
      },
      numero_transporte: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      recebedor_tipo: {
        type: Sequelize.ENUM('HUB', 'STATION'),
        allowNull: false
      },
      hub_origem_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Hubs', key: 'id' }
      },
      hub_destino_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Hubs', key: 'id' }
      },
      motorista_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Motorista', key: 'id' }
      },
      rota_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Rota', key: 'id' }
      },
      quantidade_total: {
        type: Sequelize.INTEGER
      },
      peso_total_kg: {
        type: Sequelize.DECIMAL(10, 2)
      },
      volumetria_total: {
        type: Sequelize.INTEGER
      },
      direcao: {
        type: Sequelize.ENUM('INBOUND', 'OUTBOUND'),
        allowNull: false
      },
      status_transporte: {
        type: Sequelize.ENUM('CRIADO', 'EM_TRANSPORTE', 'RECEBIDO', 'CANCELADO'),
        defaultValue: 'CRIADO'
      },
      operador_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Usuarios', key: 'id' }
      },
      data_criacao: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      data_conclusao: {
        type: Sequelize.DATE
      },
      deletedAt: {
        type: Sequelize.DATE
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Transporte');
  }
};
