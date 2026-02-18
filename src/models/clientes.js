'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Clientes extends Model {
    static associate(models) {
      Clientes.hasMany(models.Pedidos, { foreignKey: 'cliente_id', as: 'pedidos' });
      Clientes.hasMany(models.Enderecos, { foreignKey: 'cliente_id', as: 'enderecos' });
    }
  }

  Clientes.init({
    nome: { type: DataTypes.STRING, allowNull: false },
    cpf: { type: DataTypes.STRING, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: true },
    telefone: { type: DataTypes.STRING, allowNull: true }
  }, {
    sequelize,
    modelName: 'Clientes',
    tableName: 'Clientes',
    timestamps: true,
    paranoid: true
  });

  return Clientes;
};
