'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Pedidos extends Model {
    static associate(models) {
      Pedidos.belongsTo(models.Clientes, { foreignKey: 'cliente_id', as: 'cliente' });
      Pedidos.belongsTo(models.Endereco, { foreignKey: 'endereco_id', as: 'endereco' });
      Pedidos.belongsTo(models.Produtos, { foreignKey: 'produto_id', as: 'produto' });

      Pedidos.belongsTo(models.Recebimento, { foreignKey: 'recebimento_id', as: 'recebimento' });
      Pedidos.belongsTo(models.Transferencia, { foreignKey: 'transferencia_id', as: 'transferencia' });
      Pedidos.belongsTo(models.Transporte, { foreignKey: 'transporte_id', as: 'transporte' });
      Pedidos.belongsTo(models.Conferencia, { foreignKey: 'conferencia_id', as: 'conferencia' });

      Pedidos.hasMany(models.Rastreamento, { foreignKey: 'id_pedido', as: 'rastreamentos' });
      Pedidos.hasOne(models.Parada, { foreignKey: 'id_pedido', as: 'parada' });
    }
  }

  Pedidos.init({
    codigo_pedido: DataTypes.STRING,
    status: DataTypes.ENUM(
      'PENDENTE',
      'PROCESSANDO',
      'EM_ROTA',
      'ENTREGUE',
      'CANCELADO',
      'AGUARDANDO_CONFERENCIA',
      'AGUARDANDO_SEPARACAO',
      'VALIDADO',
      'EM_ESTOQUE'
    ),
    data_criacao: DataTypes.DATE,
    cliente_id: DataTypes.INTEGER,
    endereco_id: DataTypes.INTEGER,
    produto_id: DataTypes.INTEGER,
    recebimento_id: DataTypes.INTEGER,
    transferencia_id: DataTypes.INTEGER,
    conferencia_id: DataTypes.INTEGER,
    etiqueta_qr: DataTypes.STRING
  }, {
    sequelize,
    paranoid: true,
    modelName: 'Pedidos',
    tableName: 'Pedidos'
  });

  return Pedidos;
};
