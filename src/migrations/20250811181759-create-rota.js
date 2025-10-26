'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Rota', {
      id_rota: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      id_motorista: {
        type: Sequelize.INTEGER,
        references: { model: 'Motorista', key: 'id' }
      },
      cluster: Sequelize.STRING,
      numero_paradas: Sequelize.INTEGER,
      distancia_total_km: Sequelize.DECIMAL(10, 2),
      status_rota: Sequelize.ENUM('CRIADA', 'EM_ANDAMENTO', 'FINALIZADA'),
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
      deletedAt: Sequelize.DATE
    });

    await queryInterface.createTable('Parada', {
      id_parada: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      id_rota: {
        type: Sequelize.INTEGER,
        references: { model: 'Rota', key: 'id_rota' }
      },
      id_pedido: {
        type: Sequelize.INTEGER,
        references: { model: 'Pedidos', key: 'id' }
      },
      ordem_entrega: Sequelize.INTEGER,
      gaiola_codigo: Sequelize.STRING,
      status_parada: Sequelize.ENUM('PENDENTE', 'EM_ENTREGA', 'ENTREGUE', 'FALHA'),
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
      deletedAt: Sequelize.DATE
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Parada');
    await queryInterface.dropTable('Rota');
  }
};
