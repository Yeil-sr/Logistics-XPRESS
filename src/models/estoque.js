'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Estoques extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Estoques.belongsTo(models.Produtos, { foreignKey: 'produto_id' });  
      Estoques.belongsTo(models.Hubs, { foreignKey: 'hub_id'});  
    }
  }
  Estoques.init({
    produto_id: DataTypes.INTEGER,
    hub_id: DataTypes.INTEGER, 
    quantidade_total: DataTypes.INTEGER,
    quantidade_reservada: DataTypes.INTEGER,    
    quantidade: DataTypes.INTEGER,
    localizacao: DataTypes.STRING,
    data_entrada: DataTypes.DATE,  
    data_saida: DataTypes.DATE     
  }, {
    sequelize,
    paranoid:true,
    modelName: 'Estoques',
    tableName: 'Estoques',
  });
  return Estoques;
};