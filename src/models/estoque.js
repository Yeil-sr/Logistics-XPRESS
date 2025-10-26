'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Estoque extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Estoque.belongsTo(models.Produtos, { foreignKey: 'id_produto' });    
    }
  }
  Estoque.init({
    id_produto: DataTypes.INTEGER,
    id_pedido: DataTypes.INTEGER,  
    hub_id: DataTypes.INTEGER,     
    quantidade: DataTypes.INTEGER,
    localizacao: DataTypes.STRING,
    data_entrada: DataTypes.DATE,  
    data_saida: DataTypes.DATE     
  }, {
    sequelize,
    paranoid:true,
    modelName: 'Estoque',
  });
  return Estoque;
};