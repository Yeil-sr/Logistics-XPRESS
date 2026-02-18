'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PedidoItens extends Model {
    static associate(models) {
      // Relação com Pedidos (lado N -> 1)
      PedidoItens.belongsTo(models.Pedidos, { foreignKey: 'pedido_id', as: 'pedido' });

      // Relação com Produtos (cada item aponta para um produto) — alias 'produtos'
      // OBS: usamos 'produtos' porque o serviço espera itens->produtos (itens.produtos.nome)
      PedidoItens.belongsTo(models.Produtos, { foreignKey: 'produto_id', as: 'produtos' });
    }
  }

  PedidoItens.init({
    pedido_id: { type: DataTypes.INTEGER, allowNull: false },
    produto_id: { type: DataTypes.INTEGER, allowNull: false },
    descricao: { type: DataTypes.STRING, allowNull: true },
    quantidade: { type: DataTypes.DECIMAL(12,4), allowNull: true },
    valor_unitario: { type: DataTypes.DECIMAL(12,4), allowNull: true },
    valor_total: { type: DataTypes.DECIMAL(12,4), allowNull: true }
  }, {
    sequelize,
    modelName: 'PedidoItens',
    tableName: 'PedidoItens',
    paranoid: true,
    timestamps: true
  });

  return PedidoItens;
};
