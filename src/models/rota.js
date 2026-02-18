'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Rotas extends Model {
    static associate(models) {
      Rotas.belongsTo(models.Motoristas, { foreignKey: 'motorista_id' });
      Rotas.hasMany(models.Paradas, { foreignKey: 'rota_id', as:'paradas'});
      Rotas.hasMany(models.Transportes, { foreignKey: 'rota_id', as: 'transportes' });    
    }
  }

  Rotas.init({
    motorista_id: DataTypes.INTEGER,
    cluster: DataTypes.STRING,
    numero_paradas: DataTypes.INTEGER,
    distancia_total_km: DataTypes.DECIMAL(10, 2),
    status_rota: DataTypes.ENUM('CRIADA', 'EM_ANDAMENTO', 'FINALIZADA')
  }, {
    sequelize,
    paranoid: true,
    modelName: 'Rotas',
    tableName: 'Rotas'
  });

  return Rotas;
};
