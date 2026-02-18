'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Rastreamentos extends Model {
    static associate(models) {
      Rastreamentos.belongsTo(models.Pedidos, { foreignKey: 'pedido_id' });
    }
  }

  Rastreamentos.init({
    pedido_id: DataTypes.INTEGER,
    status_atual: DataTypes.ENUM('NO_HUB', 'COLETADO', 'SEPARADO','EM_ROTA', 'ENTREGUE', 'EXCECAO'),
    data_status: DataTypes.DATE,
    localizacao: DataTypes.STRING
  }, {
    sequelize,
    paranoid: true,
    modelName: 'Rastreamentos',
    tableName: 'Rastreamentos'
  });

  return Rastreamentos;
};
