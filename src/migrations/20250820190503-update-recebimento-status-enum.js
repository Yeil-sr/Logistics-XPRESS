'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Apenas adiciona a coluna status se não existir
    await queryInterface.addColumn('Recebimento', 'status', {
      type: Sequelize.ENUM('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'EXCECAO'),
      allowNull: false,
      defaultValue: 'PENDENTE'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove a coluna ao reverter
    await queryInterface.removeColumn('Recebimento', 'status');
  }
};