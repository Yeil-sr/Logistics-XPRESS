'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Conferencia extends Model {
    static associate(models) {
      Conferencia.belongsTo(models.Transporte, { foreignKey: 'transporte_id', as: 'transporte' });

      Conferencia.belongsTo(models.Usuario, { foreignKey: 'operador_id', as: 'operador' });

      Conferencia.hasMany(models.Pedidos, { foreignKey: 'conferencia_id', as: 'pedidos' });
    }
  }

  Conferencia.init({
    transporte_id: DataTypes.INTEGER, 
    nome_estacao: DataTypes.STRING,
    total_AT_TO: DataTypes.INTEGER,
    total_pedidos_iniciais: DataTypes.INTEGER,
    total_pedidos_finais: DataTypes.INTEGER,
    percentual_validacao: DataTypes.DECIMAL(5, 2),
    pedidos_escaneados: DataTypes.INTEGER,
    operador_id: DataTypes.INTEGER,
    status: {
      type: DataTypes.ENUM('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'EXCECAO'),
      defaultValue: 'PENDENTE',
      allowNull: false
    },
    data_criacao: DataTypes.DATE,
    data_termino: DataTypes.DATE
  }, {
    sequelize,
    paranoid: true,
    modelName: 'Conferencia',
    tableName: 'Conferencia'
  });

  return Conferencia;
};
