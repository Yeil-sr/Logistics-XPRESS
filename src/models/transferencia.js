'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Transferencias extends Model {
    static associate(models) {
      Transferencias.belongsTo(models.Hubs, { as: 'origemHub', foreignKey: 'origem_hub_id' });
      Transferencias.belongsTo(models.Hubs, { as: 'destinoHub', foreignKey: 'destino_hub_id' });
      Transferencias.belongsTo(models.Motoristas, { foreignKey: 'motorista_id' });
      Transferencias.belongsTo(models.Usuarios, { foreignKey: 'operador_id', as: 'operador' });

      Transferencias.hasMany(models.Pedidos, { foreignKey: 'transferencia_id', as: 'pedidos' });
      Transferencias.hasMany(models.Transportes, { foreignKey: 'transferencia_id', as: 'transportes' });
      Transferencias.hasMany(models.Manifestos, { foreignKey: 'transferencia_id', as: 'manifestos' });
      Transferencias.belongsTo(models.Conferencias, { foreignKey: 'conferencia_id', as: 'conferencias' });
    }
  }

  Transferencias.init({
    numero_TO: { 
      type: DataTypes.STRING, 
      allowNull: true,
      field: 'numero_to' // Mapeamento explícito para o banco
    },
    conferencia_id: { type: DataTypes.INTEGER, allowNull: true },
    motorista_id: { type: DataTypes.INTEGER, allowNull: true },
    origem_hub_id: { type: DataTypes.INTEGER, allowNull: true },
    destino_hub_id: { type: DataTypes.INTEGER, allowNull: true },
    tipo_recebedor: { 
      type: DataTypes.ENUM('HUB', 'STATION'), 
      allowNull: true,
      field: 'tipo_recebedor'
    },
    quantidade: { type: DataTypes.INTEGER, allowNull: true },
    peso_kg: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    direcao: { 
      type: DataTypes.ENUM('OUTBOUND', 'INBOUND'), 
      allowNull: true,
      field: 'direcao'
    },
    operador_id: { type: DataTypes.INTEGER, allowNull: true },
    status: { 
      type: DataTypes.ENUM('CRIADO', 'EM_TRANSPORTE', 'RECEBIDO', 'CANCELADO'), 
      allowNull: false, 
      defaultValue: 'CRIADO',
      field: 'status'
    },
    data_criacao: { type: DataTypes.DATE, allowNull: true },
    data_inicio: { type: DataTypes.DATE, allowNull: true },
    data_conclusao: { type: DataTypes.DATE, allowNull: true },
    // observacoes: { type: DataTypes.TEXT, allowNull: true } // Campo adicionado
  }, {
    sequelize,
    modelName: 'Transferencias',
    tableName: 'Transferencias',
    paranoid: true,
    timestamps: true,
    underscored: true // Para compatibilidade com snake_case do banco
  });

  return Transferencias;
};