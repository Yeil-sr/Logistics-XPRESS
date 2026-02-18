'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Transportes extends Model {
    static associate(models) {
      Transportes.belongsTo(models.Recebimentos, { foreignKey: 'recebimento_id', as: 'recebimentos' });
      Transportes.belongsTo(models.Transferencias, { foreignKey: 'transferencia_id', as: 'transferencias' });
      Transportes.belongsTo(models.Rotas, { foreignKey: 'rota_id', as: 'rotas' });
      Transportes.belongsTo(models.Hubs, { foreignKey: 'hub_origem_id', as: 'hubOrigem' });
      Transportes.belongsTo(models.Hubs, { foreignKey: 'hub_destino_id', as: 'hubDestino' });
      Transportes.belongsTo(models.Motoristas, { foreignKey: 'motorista_id'});

      Transportes.hasMany(models.Pedidos, { foreignKey: 'transporte_id', as: 'pedidos' });

      Transportes.hasOne(models.Conferencias, { foreignKey: 'transporte_id', as: 'conferencias'});

      Transportes.hasMany(models.Manifestos, { foreignKey: 'transporte_id', as: 'manifestos' });
    }
  }

  Transportes.init({
    nome_transportador: {type: DataTypes.STRING, allowNull:true},
    cnpj_transportador: {type: DataTypes.STRING, allowNull:true},
    endereco_transportador: {type: DataTypes.STRING, allowNull:true},
    placa_veiculo: {type: DataTypes.STRING, allowNull:true},
    uf_veiculo: {type: DataTypes.STRING, allowNull:true},
    frete_por_conta: {type: DataTypes.STRING, allowNull:true},
    quantidade_volume: {type: DataTypes.INTEGER, allowNull:true},
    especie_volumes: {type: DataTypes.STRING, allowNull:true},
    marca_volumes: {type: DataTypes.STRING, allowNull:true},
    numero_volumes: {type: DataTypes.STRING, allowNull:true},
    peso_bruto: {type: DataTypes.DECIMAL(12,2), allowNull:true},
    peso_liquido: {type: DataTypes.DECIMAL(12,2), allowNull:true},
    informacoes_transporte: {type: DataTypes.TEXT, allowNull:true},
    
    tipo_transporte: { type: DataTypes.ENUM('TO', 'LH'), allowNull: true },
    numero_transporte: { type: DataTypes.STRING, allowNull: true },
    recebedor_tipo: { type: DataTypes.ENUM('HUB', 'STATION'), allowNull: true },
    hub_origem_id: { type: DataTypes.INTEGER, allowNull: true },
    recebimento_id: { type: DataTypes.INTEGER, allowNull: true },
    transferencia_id: { type: DataTypes.INTEGER, allowNull: true },
    hub_destino_id: { type: DataTypes.INTEGER, allowNull: true },
    motorista_id: { type: DataTypes.INTEGER, allowNull: true },
    rota_id: { type: DataTypes.INTEGER, allowNull: true },
    quantidade_total: { type: DataTypes.INTEGER, allowNull: true },
    peso_total_kg: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    volumetria_total: { type: DataTypes.INTEGER, allowNull: true },
    direcao: { type: DataTypes.ENUM('INBOUND', 'OUTBOUND'), allowNull: true },
    status_transporte: {
      type: DataTypes.ENUM('CRIADO', 'EM_TRANSPORTE', 'RECEBIDO', 'CANCELADO'),
      allowNull: false,
      defaultValue: 'CRIADO'
    },
    operador_id: { type: DataTypes.INTEGER, allowNull: true },
    data_criacao: { type: DataTypes.DATE, allowNull: true },
    data_conclusao: { type: DataTypes.DATE, allowNull: true }
  }, {
    sequelize,
    modelName: 'Transportes',
    tableName: 'Transportes',
    paranoid: true,
    timestamps: true
  });

  return Transportes;
};
