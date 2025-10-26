'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Produtos extends Model {
    static associate(models) {
      Produtos.hasMany(models.Estoque, { foreignKey: 'id_produto' });
      Produtos.hasMany(models.Pedidos, { foreignKey: 'produto_id' }); 
    }
  }

  Produtos.init({
    nome: DataTypes.STRING,
    descricao: DataTypes.STRING,
    preco: DataTypes.FLOAT,
    altura: DataTypes.INTEGER,
    largura: DataTypes.INTEGER,
    volume: DataTypes.FLOAT,
    peso_kg: DataTypes.FLOAT,
    status: DataTypes.STRING,
    tipo_entrega: DataTypes.STRING
  }, {
    sequelize,
    paranoid: true,
    modelName: 'Produtos',
  });

  return Produtos;
};
