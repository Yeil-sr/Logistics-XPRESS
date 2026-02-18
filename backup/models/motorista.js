'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {[]
  class Motoristas extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      
     Motoristas.hasMany(models.Coletas, { foreignKey: 'motorista_id', as: 'coletas' });
     Motoristas.hasOne(models.Coletas,{foreignKey:'motorista_id'})
     Motoristas.hasOne(models.Transferencias, { foreignKey: 'motorista_id', as: 'transferencias' });
     Motoristas.hasMany(models.Transportes, { foreignKey: 'motorista_id' });
    }
  }
  Motoristas.init({
    nome: DataTypes.STRING,
    rg: DataTypes.STRING,
    cnh: DataTypes.STRING,
    veiculo: DataTypes.STRING,
    placa: DataTypes.STRING,
    telefone: DataTypes.STRING
  }, {
    sequelize,
    paranoid:true,
    modelName: 'Motoristas',
    tableName: 'Motoristas'
  });
  return Motoristas;
};