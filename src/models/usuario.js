'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Usuarios extends Model {
    static associate(models) {
      //Usuario.hasMany(models.Pedidos, { foreignKey: 'usuario_id', as: 'pedidos' });
      
    }
  }

  Usuarios.init({
    nome: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    senha_hash: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING, allowNull: false, defaultValue: 'USER' },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'ATIVO' }
  }, {
    sequelize,
    modelName: 'Usuarios',
    tableName: 'Usuarios',
    timestamps: true,
    paranoid: true
  });

  return Usuarios;
};
