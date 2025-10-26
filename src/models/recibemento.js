'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Recebimento extends Model {
    static associate(models) {
      Recebimento.belongsTo(models.Usuario, { foreignKey: 'operador_id', as: 'usuarios' });
      Recebimento.hasMany(models.Pedidos, { foreignKey: 'recebimento_id', as: 'pedidos' });
      Recebimento.hasMany(models.Transporte, { foreignKey: 'recebimento_id', as: 'transporte' });

    }
  }

  Recebimento.init({
    tipo_tarefa: DataTypes.ENUM('INBOUND', 'RETORNO'),
    metodo_recebimento: DataTypes.ENUM('MANUAL', 'MANIFESTO'),
    numero_manifesto: DataTypes.STRING,
    status: DataTypes.ENUM('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'EXCECAO'),
    quantidade_pedidos: DataTypes.INTEGER,
    operador_id: DataTypes.INTEGER,
    data_criacao: DataTypes.DATE,
    data_conclusao: DataTypes.DATE
  }, {
    sequelize,
    paranoid: true,
    modelName: 'Recebimento',
    tableName: 'Recebimento'
  });

  return Recebimento;
};
