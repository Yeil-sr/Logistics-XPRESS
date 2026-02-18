'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Pedidos extends Model {
    static associate(models) {
      Pedidos.belongsTo(models.Clientes, { foreignKey: 'cliente_id', as: 'clientes' });
      Pedidos.belongsTo(models.Enderecos, { foreignKey: 'endereco_id', as: 'enderecos' });
      Pedidos.hasMany(models.PedidoItens, { foreignKey: 'pedido_id', as: 'itens' });

      Pedidos.hasMany(models.NotasFiscais, { foreignKey: 'pedido_id', as: 'nota' });

      Pedidos.belongsTo(models.Recebimentos, { foreignKey: 'recebimento_id', as: 'recebimentos' });
      Pedidos.belongsTo(models.Transferencias, { foreignKey: 'transferencia_id', as: 'transferencias' });
      Pedidos.belongsTo(models.Transportes, { foreignKey: 'transporte_id', as: 'transportes' });
      Pedidos.belongsTo(models.Conferencias, { foreignKey: 'conferencia_id', as: 'conferencias' });

      Pedidos.hasMany(models.Rastreamentos, { foreignKey: 'pedido_id', as: 'rastreamentos' });
      Pedidos.hasOne(models.Paradas, { foreignKey: 'pedido_id', as: 'paradas' });
      Pedidos.belongsTo(models.Manifestos, { foreignKey: 'manifesto_id', as: 'manifesto' });

      Pedidos.belongsToMany(models.Produtos, {
        through: models.PedidoItens,
        foreignKey: 'pedido_id',
        otherKey: 'produto_id',
        as: 'produtos'
      });
    }
  }

  Pedidos.init({
    codigo_pedido: { type: DataTypes.STRING, allowNull: true, unique: true },
    quantidade: { type: DataTypes.INTEGER, allowNull: true },
    status: {
      type: DataTypes.ENUM(
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
      allowNull: false,
      defaultValue: 'PENDENTE'
    },
    data_criacao: { type: DataTypes.DATE, allowNull: true },
    cliente_id: { type: DataTypes.INTEGER, allowNull: true },
    endereco_id: { type: DataTypes.INTEGER, allowNull: true },
    recebimento_id: { type: DataTypes.INTEGER, allowNull: true },
    transferencia_id: { type: DataTypes.INTEGER, allowNull: true },
    conferencia_id: { type: DataTypes.INTEGER, allowNull: true },
    etiqueta_qr: { type: DataTypes.STRING, allowNull: true },
    manifesto_id: { type: DataTypes.INTEGER, allowNull: true },
    transporte_id: { type: DataTypes.INTEGER, allowNull: true }
  }, {
    sequelize,
    modelName: 'Pedidos',
    tableName: 'Pedidos',
    paranoid: true,      
    timestamps: true     
  });

  return Pedidos;
};