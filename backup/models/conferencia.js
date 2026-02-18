'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Conferencias extends Model {
    static associate(models) {
      Conferencias.belongsTo(models.Transportes, { foreignKey: 'transporte_id' });
      Conferencias.belongsTo(models.Usuarios, { foreignKey: 'operador_id', as: 'operador' });

      Conferencias.belongsTo(models.Recebimentos, { foreignKey: 'recebimento_id', as: 'recebimento' });

      Conferencias.hasMany(models.Pedidos, { foreignKey: 'conferencia_id', as: 'pedidos' });
      Conferencias.hasMany(models.Transferencias, { 
        foreignKey: 'conferencia_id', 
        as: 'transferencias' 
      });

      Conferencias.belongsTo(models.Manifestos, { foreignKey: 'manifesto_id', as: 'manifesto' });
    }
  }

  Conferencias.init({
    transporte_id: DataTypes.INTEGER,
    recebimento_id: { type: DataTypes.INTEGER, allowNull: true }, // <--- novo campo
    nome_estacao: DataTypes.STRING,
    total_AT_TO: DataTypes.INTEGER,
    total_pedidos_iniciais: DataTypes.INTEGER,
    total_pedidos_finais: DataTypes.INTEGER,
    percentual_validacao: DataTypes.DECIMAL(5, 2),
    pedidos_escaneados: DataTypes.INTEGER,
    operador_id: DataTypes.INTEGER,
    manifesto_id: { type: DataTypes.INTEGER, allowNull: true }, 
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
    modelName: 'Conferencias',
    tableName: 'Conferencias'
  });

  return Conferencias;
};
