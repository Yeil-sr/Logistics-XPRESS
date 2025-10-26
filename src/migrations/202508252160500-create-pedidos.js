'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Pedidos', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      codigo_pedido: {
        type: Sequelize.STRING,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM(
          'PENDENTE',
          'PROCESSANDO',
          'EM_ROTA',
          'ENTREGUE',
          'CANCELADO',
          'AGUARDANDO_CONFERENCIA',
          'AGUARDANDO_SEPARACAO',
          'VALIDADO',
          'EM_ESTOQUE'
        ),
        allowNull: false
      },
      data_criacao: {
        type: Sequelize.DATE,
        allowNull: false
      },
      cliente_id: {
        type: Sequelize.INTEGER,
        allowNull: true,  // Permitido NULL para SET NULL
        references: {
          model: 'Clientes',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      endereco_id: {
        type: Sequelize.INTEGER,
        allowNull: true,  // Permitido NULL para SET NULL
        references: {
          model: 'Enderecos',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      produto_id: {
        type: Sequelize.INTEGER,
        allowNull: true,  // Permitido NULL para SET NULL
        references: {
          model: 'Produtos',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      recebimento_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Recebimento',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      transferencia_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Transferencia',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      conferencia_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Conferencia',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      etiqueta_qr: {
        type: Sequelize.STRING,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      deletedAt: {
        allowNull: true,
        type: Sequelize.DATE
      }
    });

    // Índices adicionais
    await queryInterface.addIndex('Pedidos', ['codigo_pedido'], { unique: true });
    await queryInterface.addIndex('Pedidos', ['cliente_id']);
    await queryInterface.addIndex('Pedidos', ['endereco_id']);
    await queryInterface.addIndex('Pedidos', ['produto_id']);
    await queryInterface.addIndex('Pedidos', ['recebimento_id']);
    await queryInterface.addIndex('Pedidos', ['transferencia_id']);
    await queryInterface.addIndex('Pedidos', ['conferencia_id']);
  },

  async down(queryInterface, Sequelize) {
    // Remover índices
    await queryInterface.removeIndex('Pedidos', ['codigo_pedido']);
    await queryInterface.removeIndex('Pedidos', ['cliente_id']);
    await queryInterface.removeIndex('Pedidos', ['endereco_id']);
    await queryInterface.removeIndex('Pedidos', ['produto_id']);
    await queryInterface.removeIndex('Pedidos', ['recebimento_id']);
    await queryInterface.removeIndex('Pedidos', ['transferencia_id']);
    await queryInterface.removeIndex('Pedidos', ['conferencia_id']);

    // Drop table
    await queryInterface.dropTable('Pedidos');
  }
};
