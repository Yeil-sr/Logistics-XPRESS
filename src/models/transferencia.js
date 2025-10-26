'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Transferencia extends Model {
    static associate(models) {
      Transferencia.belongsTo(models.Hubs, { as: 'origemHub', foreignKey: 'origem_hub_id' });
      Transferencia.belongsTo(models.Hubs, { as: 'destinoHub', foreignKey: 'destino_hub_id' });
      Transferencia.belongsTo(models.Motorista, { foreignKey: 'motorista_id' });
      Transferencia.belongsTo(models.Usuario, { foreignKey: 'operador_id', as: 'operador' });
      Transferencia.hasMany(models.Pedidos, { foreignKey: 'transferencia_id', as: 'pedidos' });
      Transferencia.hasOne(models.Transporte, { foreignKey: 'transferencia_id', as: 'transporte' });
      Transferencia.belongsTo(models.Conferencia, { foreignKey: 'id_conferencia' });

    }
  }

  Transferencia.init({
    numero_TO: DataTypes.STRING,
    id_conferencia: DataTypes.INTEGER,
    motorista_id: DataTypes.INTEGER,
    origem_hub_id: DataTypes.INTEGER,
    destino_hub_id: DataTypes.INTEGER,
    tipo_recebedor: DataTypes.ENUM('HUB', 'STATION'),
    quantidade: DataTypes.INTEGER,
    peso_kg: DataTypes.DECIMAL(10, 2),
    direcao: DataTypes.ENUM('OUTBOUND', 'INBOUND'),
    operador_id: DataTypes.INTEGER,
    status: DataTypes.ENUM('CRIADO', 'EM_TRANSPORTE', 'RECEBIDO'),
    data_criacao: DataTypes.DATE,
    data_inicio: DataTypes.DATE,
    data_conclusao: DataTypes.DATE
  }, {
    sequelize,
    paranoid: true,
    modelName: 'Transferencia',
    tableName: 'Transferencia'
  });

  return Transferencia;
};
