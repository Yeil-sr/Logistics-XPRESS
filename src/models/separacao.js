'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Separacao extends Model {
    static associate(models) {
      Separacao.belongsTo(models.Pedidos, { foreignKey: 'id_pedido' });
      Separacao.belongsTo(models.Conferencia, { foreignKey: 'id_conferencia' });
    }
  }

  Separacao.init({
    id_pedido: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    id_conferencia: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    id_rota: {
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
    tableName: 'separacao',
    timestamps: true,  
    paranoid: true     
  });

  return Separacao;
};
