'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Paradas extends Model {
    static associate(models) {
      Paradas.belongsTo(models.Rotas, { foreignKey: 'rota_id' });
      Paradas.belongsTo(models.Pedidos, { foreignKey: 'pedido_id' });
    }
  }

  Paradas.init({
    rota_id: DataTypes.INTEGER,
    pedido_id: DataTypes.INTEGER,
    ordem_entrega: DataTypes.INTEGER,
    gaiola_codigo: DataTypes.STRING,
    status_parada: DataTypes.ENUM('PENDENTE', 'EM_ENTREGA', 'ENTREGUE', 'FALHA')
  }, {
    sequelize,
    paranoid: true,
    modelName: 'Paradas',
    tableName: 'Paradas'
  });

  return Paradas;
};
