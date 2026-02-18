'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Recebimentos extends Model {
    static associate(models) {
      Recebimentos.belongsTo(models.Usuarios, { foreignKey: 'operador_id'});

      Recebimentos.hasMany(models.Pedidos, { foreignKey: 'recebimento_id', as: 'pedidos' });

      Recebimentos.hasMany(models.Transportes, { foreignKey: 'recebimento_id', as: 'transportes' });
      Recebimentos.hasMany(models.Manifestos, { foreignKey: 'recebimento_id', as: 'manifestos' });

      Recebimentos.belongsTo(models.Hubs, { foreignKey: 'origem_hub_id', as: 'origemHub' });
      Recebimentos.belongsTo(models.Hubs, { foreignKey: 'destino_hub_id', as: 'destinoHub' });
      Recebimentos.hasMany(models.Conferencias, { foreignKey: 'recebimento_id', as: 'conferencias' });
    }
  }

  Recebimentos.init({
    tipo_tarefa: {
      type: DataTypes.ENUM('INBOUND', 'RETORNO'),
      allowNull: false
    },
    metodo_recebimento: {
      type: DataTypes.ENUM('MANUAL', 'MANIFESTO'),
      allowNull: false,
      defaultValue: 'MANUAL'
    },
    numero_manifesto: { type: DataTypes.STRING, allowNull: true },
    origem_hub_id: { type: DataTypes.INTEGER, allowNull: true },
    destino_hub_id: { type: DataTypes.INTEGER, allowNull: true },
    numero_recebimento: { type: DataTypes.STRING, allowNull: true },
    numero_romaneio: { type: DataTypes.STRING, allowNull: true },
    localizacao: { type: DataTypes.STRING, allowNull: true },
    observacoes: { type: DataTypes.TEXT, allowNull: true },
    serie: { type: DataTypes.STRING, allowNull: true },
    data_emissao: { type: DataTypes.DATE, allowNull: true },
status: {
  type: DataTypes.STRING,
  allowNull: false,
  defaultValue: 'PENDENTE'
},
    quantidade_pedidos: { type: DataTypes.INTEGER, allowNull: true },
    operador_id: { type: DataTypes.INTEGER, allowNull: true },
    data_criacao: { type: DataTypes.DATE, allowNull: true },
    data_conclusao: { type: DataTypes.DATE, allowNull: true }
  }, {
    sequelize,
    modelName: 'Recebimentos',
    tableName: 'Recebimentos',
    paranoid: true,
    timestamps: true
  });

  return Recebimentos;
};
