'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Endereco extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Endereco.hasMany(models.Pedidos, { foreignKey: 'endereco_id' });
    }
  }
  Endereco.init({
    logradouro: DataTypes.STRING,
    bairro: DataTypes.STRING,
    cidade: DataTypes.STRING,
    estado: DataTypes.STRING,
    cep: DataTypes.STRING
  }, {
    sequelize,
    paranoid:true,
    modelName: 'Endereco',
  });
  return Endereco;
};