'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Motorista extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
     Motorista.hasOne(models.Coleta,{foreignKey:'id_motorista'})
     Motorista.hasOne(models.Transferencia, { foreignKey: 'motorista_id', as: 'transferencia' });
    //Motorista.hasOne(models.Transferencia, { foreignKey: 'veiculo_id', as: 'TransferenciaVeiculo' });
    
    }
  }
  Motorista.init({
    nome: DataTypes.STRING,
    veiculo: DataTypes.STRING,
    telefone: DataTypes.STRING
  }, {
    sequelize,
    paranoid:true,
    modelName: 'Motorista',
  });
  return Motorista;
};