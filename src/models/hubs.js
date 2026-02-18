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
      Hubs.belongsTo(models.Enderecos, { foreignKey: 'endereco_id', as:'enderecos' });
      Hubs.hasMany(models.Transferencias, { foreignKey: 'origem_hub_id', as: 'Saidas' });
      Hubs.hasMany(models.Transferencias, { foreignKey: 'destino_hub_id', as: 'Entradas' });
      Hubs.hasMany(models.Estoques,{foreignKey:'hub_id'});
      Hubs.hasMany(models.Transportes, { foreignKey: 'hub_origem_id', as: 'transportesOrigem' });
      Hubs.hasMany(models.Transportes, { foreignKey: 'hub_destino_id', as: 'transportesDestino' });      
    }
  }
  Hubs.init({
    nome: DataTypes.STRING,
    cnpj: DataTypes.STRING,
    codigo_hub: DataTypes.STRING,
    status: DataTypes.STRING,
    endereco_id: DataTypes.INTEGER
  }, {
    sequelize,
    paranoid:true,
    modelName: 'Hubs',
    tableName: 'Hubs',
  });
  return Hubs;
};