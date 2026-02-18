'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Coletas extends Model {
    static associate(models) {
      Coletas.belongsTo(models.Pedidos, { foreignKey: 'pedido_id', as: 'pedido' });
      Coletas.belongsTo(models.Motoristas, { foreignKey: 'motorista_id', as: 'motorista' });
      Coletas.belongsTo(models.Conferencias, { foreignKey: 'conferencia_id', as: 'conferencia' });
    }
  }

  Coletas.init({
    pedido_id: { type: DataTypes.INTEGER, allowNull: true },
    motorista_id: { type: DataTypes.INTEGER, allowNull: true },
    conferencia_id: { type: DataTypes.INTEGER, allowNull: true },
    numero_coleta: { type: DataTypes.STRING, allowNull: true },
    data_agendada: { type: DataTypes.DATE, allowNull: true },
    data_coleta: { type: DataTypes.DATE, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'PENDENTE' }
  }, {
    sequelize,
    modelName: 'Coletas',
    tableName: 'Coletas',
    timestamps: true,
    paranoid: true
  });

  return Coletas;
};
