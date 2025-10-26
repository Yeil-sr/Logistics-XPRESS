'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Transporte extends Model {
    static associate(models) {
      Transporte.belongsTo(models.Recebimento, { foreignKey: 'recebimento_id', as: 'recebimento' });
      Transporte.belongsTo(models.Transferencia, { foreignKey: 'transferencia_id', as: 'transferencia' });
      Transporte.belongsTo(models.Rota, { foreignKey: 'rota_id', as: 'rota' });
      Transporte.belongsTo(models.Hubs, { foreignKey: 'hub_origem_id', as: 'hubOrigem' });
      Transporte.belongsTo(models.Hubs, { foreignKey: 'hub_destino_id', as: 'hubDestino' });
      Transporte.belongsTo(models.Motorista, { foreignKey: 'motorista_id', as: 'motorista' });
      Transporte.hasMany(models.Pedidos, { foreignKey: 'transporte_id', as: 'pedidos' });
      Transporte.hasOne(models.Conferencia, { foreignKey: 'transporte_id', as: 'conferencia' });
    }
  }

  Transporte.init({
    tipo_transporte: DataTypes.ENUM('TO', 'LH'), 
    numero_transporte: DataTypes.STRING,
    recebedor_tipo: DataTypes.ENUM('HUB', 'STATION'),
    hub_origem_id: DataTypes.INTEGER,
    recebimento_id: DataTypes.INTEGER,
    transferencia_id: DataTypes.INTEGER, 
    hub_destino_id: DataTypes.INTEGER,
    motorista_id: DataTypes.INTEGER,
    rota_id: DataTypes.INTEGER,
    quantidade_total: DataTypes.INTEGER,
    peso_total_kg: DataTypes.DECIMAL(10, 2),
    volumetria_total: DataTypes.INTEGER,
    direcao: DataTypes.ENUM('INBOUND', 'OUTBOUND'),
    status_transporte: DataTypes.ENUM('CRIADO', 'EM_TRANSPORTE', 'RECEBIDO', 'CANCELADO'),
    operador_id: DataTypes.INTEGER,
    data_criacao: DataTypes.DATE,
    data_conclusao: DataTypes.DATE
  }, {
    sequelize,
    paranoid: true,
    modelName: 'Transporte',
    tableName: 'Transporte'
  });

  return Transporte;
};
