module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.changeColumn('EstoquesMovimentacoes', 'usuario_id', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
  },
  down: async (queryInterface, Sequelize) => {
    return queryInterface.changeColumn('EstoquesMovimentacoes', 'usuario_id', {
      type: Sequelize.INTEGER,
      allowNull: false
    });
  }
};
