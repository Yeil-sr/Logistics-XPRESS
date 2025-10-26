'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Coleta extends Model {
    static associate(models) {
      Coleta.belongsTo(models.Pedidos, { foreignKey: 'id_pedido' });
      Coleta.belongsTo(models.Motorista, { foreignKey: 'id_motorista' });
      Coleta.belongsTo(models.Conferencia, { foreignKey: 'id_conferencia', as: 'conferencia' });

    }
  }

  Coleta.init({
    id_pedido: DataTypes.INTEGER,
    id_conferencia: DataTypes.INTEGER,
    id_motorista: DataTypes.INTEGER,
    agendamento: DataTypes.DATE,
    data_coleta: DataTypes.DATE,
    status: DataTypes.STRING
  }, {
    sequelize,
    paranoid: true,
    modelName: 'Coleta',
    tableName: 'Coleta'
  });

  return Coleta;
};
