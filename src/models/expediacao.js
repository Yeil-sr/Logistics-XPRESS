'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Expediacao extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Expediacao.belongsTo(models.Pedidos, { foreignKey: 'pedido_id' });    
    }
  }
  Expediacao.init({
    pedido_id: DataTypes.STRING,
    nota_fiscal: DataTypes.STRING,
    codigo_rastreamento: DataTypes.STRING,
    data_envio: DataTypes.STRING
  }, {
    sequelize,
    paranoid:true,
    modelName: 'Expediacoes',
    tableName: 'Expedicoes'
  });
  return Expediacao;
};