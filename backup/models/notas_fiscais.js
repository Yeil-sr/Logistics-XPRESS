'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class NotasFiscais extends Model {
    static associate(models) {
      NotasFiscais.belongsTo(models.Pedidos, { foreignKey: 'pedido_id', as: 'pedido' });
      NotasFiscais.belongsTo(models.Manifestos, { foreignKey: 'manifesto_id', as: 'manifesto' });

      NotasFiscais.hasMany(models.NotasItens, { foreignKey: 'nota_id', as: 'notaItens' });
    }
  }

  NotasFiscais.init({
    pedido_id: { type: DataTypes.INTEGER, allowNull: true },
    numero: { type: DataTypes.STRING, allowNull: true },
    serie: { type: DataTypes.STRING, allowNull: true },
    chave_nfe: { type: DataTypes.STRING, allowNull: true },
    data_emissao: { type: DataTypes.DATE, allowNull: true },
    valor_total: { type: DataTypes.DECIMAL(14,2), allowNull: true },
    manifesto_id: { type: DataTypes.INTEGER, allowNull: true },
    tipo: { type: DataTypes.ENUM('NF-e', 'NFC-e'), allowNull: false, defaultValue: 'NF-e' }
  }, {
    sequelize,
    modelName: 'NotasFiscais',
    tableName: 'NotasFiscais',
    paranoid: true,
    timestamps: true
  });

  return NotasFiscais;
};
