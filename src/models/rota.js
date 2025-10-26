'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Rota extends Model {
    static associate(models) {
      Rota.belongsTo(models.Motorista, { foreignKey: 'id_motorista' });
      Rota.hasMany(models.Parada, { foreignKey: 'id_rota', as: 'paradas' });
    }
  }

  Rota.init({
   id_motorista: DataTypes.INTEGER,
    cluster: DataTypes.STRING,
    numero_paradas: DataTypes.INTEGER,
    distancia_total_km: DataTypes.DECIMAL(10, 2),
    status_rota: DataTypes.ENUM('CRIADA', 'EM_ANDAMENTO', 'FINALIZADA')
  }, {
    sequelize,
    paranoid: true,
    modelName: 'Rota',
    tableName: 'Rota'
  });

  return Rota;
};
