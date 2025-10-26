'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Rastreamento extends Model {
    static associate(models) {
      Rastreamento.belongsTo(models.Pedidos, { foreignKey: 'id_pedido' });
    }
  }

  Rastreamento.init({
    id_pedido: DataTypes.INTEGER,
    status_atual: DataTypes.ENUM('NO_HUB', 'EM_ROTA', 'ENTREGUE', 'EXCECAO'),
    data_status: DataTypes.DATE,
    localizacao: DataTypes.STRING
  }, {
    sequelize,
    paranoid: true,
    modelName: 'Rastreamento',
    tableName: 'Rastreamento'
  });

  return Rastreamento;
};
