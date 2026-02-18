'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Excecao extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Excecao.belongsTo(models.Pedidos, { 
        foreignKey: 'pedido_id', 
        as: 'pedido' 
      });
      
      Excecao.belongsTo(models.Transportes, { 
        foreignKey: 'transporte_id', 
        as: 'transporte' 
      });
      
      Excecao.belongsTo(models.Recebimentos, { 
        foreignKey: 'recebimento_id', 
        as: 'recebimento' 
      });
      
      Excecao.belongsTo(models.Usuarios, { 
        foreignKey: 'criador_id', 
        as: 'criador' 
      });
      
      Excecao.belongsTo(models.Usuarios, { 
        foreignKey: 'responsavel_id', 
        as: 'responsavel' 
      });
    }
  }

  Excecao.init({
    numero_ocorrencia: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false
    },
    
    tipo: {
      type: DataTypes.ENUM(
        'AVARIA',
        'BACKLOG',
        'PARCEL',
        'NOSHOW',
        'EXTRAVIADO',
        'DIVERGENCIA',
        'ATRASO',
        'OUTROS'
      ),
      allowNull: false
    },
    
    gravidade: {
      type: DataTypes.ENUM('BAIXA', 'MEDIA', 'ALTA', 'CRITICA'),
      defaultValue: 'MEDIA'
    },
    
    titulo: {
      type: DataTypes.STRING,
      allowNull: false
    },
    
    descricao: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    
    pedido_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Pedidos',
        key: 'id'
      }
    },
    
    transporte_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Transportes',
        key: 'id'
      }
    },
    
    recebimento_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Recebimentos',
        key: 'id'
      }
    },
    
    criador_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Usuarios',
        key: 'id'
      }
    },
    
    responsavel_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Usuarios',
        key: 'id'
      }
    },
    
    status: {
      type: DataTypes.ENUM(
        'ABERTA',
        'EM_ANALISE',
        'AGUARDANDO_APROVACAO',
        'RESOLVIDA',
        'ESCALONADA',
        'CANCELADA'
      ),
      defaultValue: 'ABERTA'
    },
    
    impacto_financeiro: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00
    },
    
    custo_resolucao: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00
    },
    
    data_ocorrencia: {
      type: DataTypes.DATE,
      allowNull: false
    },
    
    data_limite_resolucao: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    data_resolucao: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    solucao_aplicada: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    acoes_tomadas: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    reincidente: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    
    numero_reincidencias: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    
    anexos: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    
    historico: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    
    prioridade: {
      type: DataTypes.INTEGER,
      defaultValue: 3, 
      validate: {
        min: 1,
        max: 3
      }
    },
    
    tags: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    
    setor_origem: {
      type: DataTypes.STRING,
      allowNull: true
    },
    
    processo_afetado: {
      type: DataTypes.STRING,
      allowNull: true
    }

  }, {
    sequelize,
    modelName: 'Excecao',
    tableName: 'Excecoes',
    paranoid: true, 
    indexes: [
      {
        unique: true,
        fields: ['numero_ocorrencia']
      },
      {
        fields: ['tipo']
      },
      {
        fields: ['status']
      },
      {
        fields: ['gravidade']
      },
      {
        fields: ['pedido_id']
      },
      {
        fields: ['transporte_id']
      },
      {
        fields: ['data_ocorrencia']
      }
    ]
  });

  Excecao.beforeCreate(async (excecao) => {
    if (!excecao.numero_ocorrencia) {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      excecao.numero_ocorrencia = `EXC${timestamp}${random}`;
    }
    
    if (!excecao.data_ocorrencia) {
      excecao.data_ocorrencia = new Date();
    }
  });

  Excecao.afterUpdate(async (excecao) => {
    if (excecao.changed()) {
      const changes = excecao.changed().map(field => ({
        campo: field,
        anterior: excecao.previous(field),
        novo: excecao[field],
        data: new Date()
      }));
      
      const historicoAtual = excecao.historico || [];
      historicoAtual.push({
        timestamp: new Date(),
        acao: 'ATUALIZACAO',
        changes: changes,
        usuario_id: excecao.criador_id 
      });
      
      await Excecao.update(
        { historico: historicoAtual },
        { 
          where: { id: excecao.id },
          silent: true 
        }
      );
    }
  });

  return Excecao;
};