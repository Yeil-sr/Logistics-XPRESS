'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Produtos extends Model {
    static associate(models) {
      Produtos.hasMany(models.Estoques, { foreignKey: 'produto_id', as: 'estoques' });

      // alias para itens de pedido
      Produtos.hasMany(models.PedidoItens, { foreignKey: 'produto_id', as: 'itens' });

      // alias para itens de nota fiscal
      Produtos.hasMany(models.NotasItens, { foreignKey: 'produto_id', as: 'notasItens' });
    }
  }

  Produtos.init({
    nome: { type: DataTypes.STRING, allowNull: false },
    s_n: { type: DataTypes.STRING, allowNull: true },
    p_n: { type: DataTypes.STRING, allowNull: true },
    mac: { type: DataTypes.STRING, allowNull: true },
    descricao: { type: DataTypes.TEXT, allowNull: true },
    preco: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    altura: { type: DataTypes.FLOAT, allowNull: true },
    largura: { type: DataTypes.FLOAT, allowNull: true },
    volume: { type: DataTypes.FLOAT, allowNull: true },
    peso_kg: { type: DataTypes.FLOAT, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: true },
    tipo_entrega: { type: DataTypes.STRING, allowNull: true },
    estoque_minimo: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
  }, {
    sequelize,
    modelName: 'Produtos',
    tableName: 'Produtos',
    paranoid: true,
    timestamps: true
  });

  return Produtos;
};
