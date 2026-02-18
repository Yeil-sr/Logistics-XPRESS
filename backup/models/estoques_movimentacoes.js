'use strict'
const {Model} = require('sequelize')

module.exports = (sequelize, DataTypes)=>{
    class EstoquesMovimentacoes extends Model{
        static associate(models){
            EstoquesMovimentacoes.belongsTo(models.Estoques, {foreignKey:'estoque_id'});
            EstoquesMovimentacoes.belongsTo(models.Produtos, {foreignKey:'produto_id'});
            EstoquesMovimentacoes.belongsTo(models.Hubs, {foreignKey:'hub_id'});
            EstoquesMovimentacoes.belongsTo(models.Usuarios, {foreignKey:'usuario_id'});
        }

    } 

    EstoquesMovimentacoes.init({
        estoque_id: {type: DataTypes.INTEGER},
        produto_id: {type: DataTypes.INTEGER},
        hub_id: {type: DataTypes.INTEGER},
        tipo:{
            type: DataTypes.ENUM('ENTRADA', 'SAIDA', 'RESERVA', 'LIBERACAO',  'AJUSTE','TRANSFERENCIA', 'TRANSFERENCIA_ORIGEM', 'TRANSFERENCIA_DESTINO'), allowNull:false
        },
        quantidade:{ type: DataTypes.DECIMAL(14,4)},
        usuario_id:{ type: DataTypes.INTEGER, allowNull:false},
        referencia:{ type: DataTypes.STRING},
        localizacao: {type: DataTypes.STRING},
        data_movimentacao:{type: DataTypes.DATE, allowNull:false, defaultValue: DataTypes.NOW}
    }, {
        sequelize,
        modelName: 'EstoquesMovimentacoes',
        tableName: 'EstoquesMovimentacoes',
        paranoid: true,
        timestamps: true
    })

    return EstoquesMovimentacoes
}