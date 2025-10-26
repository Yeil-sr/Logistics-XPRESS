'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Hubs extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Hubs.belongsTo(models.Endereco, { foreignKey: 'endereco_id' });
      Hubs.hasMany(models.Transferencia, { foreignKey: 'origem_hub_id', as: 'Saidas' });
      Hubs.hasMany(models.Transferencia, { foreignKey: 'destino_hub_id', as: 'Entradas' });
    }
  }
  Hubs.init({
    nome: DataTypes.STRING,
    codigo_hub: DataTypes.STRING,
    endereco_id: DataTypes.INTEGER
  }, {
    sequelize,
    paranoid:true,
    modelName: 'Hubs',
  });
  return Hubs;
};