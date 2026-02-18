'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Separacao extends Model {
    static associate(models) {
      Separacao.belongsTo(models.Pedidos, { foreignKey: 'pedido_id' });
      Separacao.belongsTo(models.Conferencias, { foreignKey: 'conferencia_id' });
    }p
  }

  Separacao.init({
    pedido_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    conferencia_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    rota_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    data_separacao: {
      type: DataTypes.DATE,
      allowNull: true
    },
    corredor_gaiola: {
      type: DataTypes.STRING,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('PENDENTE', 'SEPARADO'),
      allowNull: false,
      defaultValue: 'PENDENTE'
    }
  }, {
    sequelize,
    modelName: 'Separacao',
    tableName: 'separacoes',
    timestamps: true,  
    paranoid: true     
  });

  return Separacao;
};
