'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Parada extends Model {
    static associate(models) {
      Parada.belongsTo(models.Rota, { foreignKey: 'id_rota' });
      Parada.belongsTo(models.Pedidos, { foreignKey: 'id_pedido' });
    }
  }

  Parada.init({
    id_rota: DataTypes.INTEGER,
    id_pedido: DataTypes.INTEGER,
    ordem_entrega: DataTypes.INTEGER,
    gaiola_codigo: DataTypes.STRING,
    status_parada: DataTypes.ENUM('PENDENTE', 'EM_ENTREGA', 'ENTREGUE', 'FALHA')
  }, {
    sequelize,
    paranoid: true,
    modelName: 'Parada',
    tableName: 'Parada'
  });

  return Parada;
};
