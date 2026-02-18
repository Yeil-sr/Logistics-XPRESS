'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Enderecos extends Model {
    static associate(models) {
      Enderecos.belongsTo(models.Clientes, { foreignKey: 'cliente_id' });
    }
  }

  Enderecos.init({
    cliente_id: { type: DataTypes.INTEGER, allowNull: true },
    rua: { type: DataTypes.STRING, allowNull: true },
    numero: { type: DataTypes.STRING, allowNull: true },
    complemento: { type: DataTypes.STRING, allowNull: true },
    bairro: { type: DataTypes.STRING, allowNull: true },
    cidade: { type: DataTypes.STRING, allowNull: true },
    estado: { type: DataTypes.STRING, allowNull: true },
    cep: { type: DataTypes.STRING, allowNull: true }
  }, {
    sequelize,
    modelName: 'Enderecos',
    tableName: 'Enderecos',
    timestamps: true,
    paranoid: true
  });

  return Enderecos;
};
