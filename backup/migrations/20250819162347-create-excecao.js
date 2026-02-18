'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Excecoes', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },

      // Identificação
      numero_ocorrencia: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },

      // Tipo e classificação
      tipo: {
        type: Sequelize.ENUM(
          'AVARIA',
          'BACKLOG',
          'PARCEL',
          'NOSHOW',
          'EXTRAVIADO',
          'DIVERGENCIA',
          'ATRASO',
          'OUTROS'
        ),
        allowNull: false
      },

      gravidade: {
        type: Sequelize.ENUM('BAIXA', 'MEDIA', 'ALTA', 'CRITICA'),
        defaultValue: 'MEDIA'
      },

      // Descrição
      titulo: {
        type: Sequelize.STRING,
        allowNull: false
      },

      descricao: {
        type: Sequelize.TEXT,
        allowNull: false
      },

      // Relacionamentos
      pedido_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Pedidos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },

      transporte_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Transporte', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },

      recebimento_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Recebimento', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },

      // Responsáveis
      criador_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Usuarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },

      responsavel_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Usuarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },

      // Status e fluxo
      status: {
        type: Sequelize.ENUM(
          'ABERTA',
          'EM_ANALISE',
          'AGUARDANDO_APROVACAO',
          'RESOLVIDA',
          'ESCALONADA',
          'CANCELADA'
        ),
        defaultValue: 'ABERTA'
      },

      // Informações financeiras
      impacto_financeiro: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00
      },

      custo_resolucao: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0.00
      },

      // Datas importantes
      data_ocorrencia: {
        type: Sequelize.DATE,
        allowNull: false
      },

      data_limite_resolucao: {
        type: Sequelize.DATE,
        allowNull: true
      },

      data_resolucao: {
        type: Sequelize.DATE,
        allowNull: true
      },

      // Solução
      solucao_aplicada: {
        type: Sequelize.TEXT,
        allowNull: true
      },

      acoes_tomadas: {
        type: Sequelize.TEXT,
        allowNull: true
      },

      // Controle de qualidade
      reincidente: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },

      numero_reincidencias: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },

      // Anexos e histórico
      anexos: {
        type: Sequelize.JSON,
        defaultValue: []
      },

      historico: {
        type: Sequelize.JSON,
        defaultValue: []
      },

      // Metadados
      prioridade: {
        type: Sequelize.INTEGER,
        defaultValue: 3
      },

      tags: {
        type: Sequelize.JSON,
        defaultValue: []
      },

      // Auditoria
      setor_origem: {
        type: Sequelize.STRING,
        allowNull: true
      },

      processo_afetado: {
        type: Sequelize.STRING,
        allowNull: true
      },

      // Controle de timestamps
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
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // Índices adicionais
    await queryInterface.addIndex('Excecoes', ['tipo']);
    await queryInterface.addIndex('Excecoes', ['status']);
    await queryInterface.addIndex('Excecoes', ['gravidade']);
    await queryInterface.addIndex('Excecoes', ['pedido_id']);
    await queryInterface.addIndex('Excecoes', ['transporte_id']);
    await queryInterface.addIndex('Excecoes', ['data_ocorrencia']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Excecoes');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Excecoes_tipo";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Excecoes_gravidade";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Excecoes_status";');
  }
};
