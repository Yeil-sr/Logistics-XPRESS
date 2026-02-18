'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Manifestos extends Model {
    static associate(models) {
      Manifestos.belongsTo(models.Hubs, { foreignKey: 'origem_hub_id', as: 'origemHub' });
      Manifestos.belongsTo(models.Hubs, { foreignKey: 'destino_hub_id', as: 'destinoHub' });
      Manifestos.belongsTo(models.Transportes, { foreignKey: 'transporte_id', as: 'transportes' });
      Manifestos.belongsTo(models.Recebimentos, { foreignKey: 'recebimento_id', as: 'recebimentos' });
      Manifestos.belongsTo(models.Transferencias, { foreignKey: 'transferencia_id', as: 'transferencias' });

      Manifestos.hasMany(models.NotasFiscais, { foreignKey: 'manifesto_id', as: 'nota' });

      Manifestos.hasMany(models.Pedidos, { foreignKey: 'manifesto_id', as: 'pedidos' });
    }
  }

  Manifestos.init({
    numero_manifesto: { type: DataTypes.STRING, allowNull: true },
    serie: { type: DataTypes.STRING, allowNull: true },
    data_emissao: { type: DataTypes.DATE, allowNull: true },
    origem_hub_id: { type: DataTypes.INTEGER, allowNull: true },
    destino_hub_id: { type: DataTypes.INTEGER, allowNull: true },
    transporte_id: { type: DataTypes.INTEGER, allowNull: true },
    recebimento_id: { type: DataTypes.INTEGER, allowNull: true },
    transferencia_id: { type: DataTypes.INTEGER, allowNull: true },
    valor_total: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    quantidade_notas: { type: DataTypes.INTEGER, allowNull: true },
    observacoes: { type: DataTypes.TEXT, allowNull: true }
  }, {
    sequelize,
    modelName: 'Manifestos',
    tableName: 'Manifestos',
    paranoid: true,
    timestamps: true
  });

  return Manifestos;
};
