'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class NotasItens extends Model {
    static associate(models) {
      // pertence à nota fiscal (nota)
      NotasItens.belongsTo(models.NotasFiscais, { foreignKey: 'nota_id', as: 'nota' });

      // pertence a produto; alias 'produtos' para bater com includes nos services
      NotasItens.belongsTo(models.Produtos, { foreignKey: 'produto_id', as: 'produtos' });
    }
  }

  NotasItens.init({
    nota_id: { type: DataTypes.INTEGER, allowNull: false },
    produto_id: { type: DataTypes.INTEGER, allowNull: false },
    descricao: { type: DataTypes.STRING, allowNull: true },
    quantidade: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    valor_unitario: { type: DataTypes.DECIMAL(12,2), allowNull: true },
    cfop: { type: DataTypes.STRING, allowNull: true },
    cest: { type: DataTypes.STRING, allowNull: true }
  }, {
    sequelize,
    modelName: 'NotasItens',
    tableName: 'NotasItens',
    paranoid: true,
    timestamps: true
  });

  return NotasItens;
};
