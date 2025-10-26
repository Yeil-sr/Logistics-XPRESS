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
      // Associação com Pedido
      Excecao.belongsTo(models.Pedidos, { 
        foreignKey: 'pedido_id', 
        as: 'pedido' 
      });
      
      // Associação com Transporte
      Excecao.belongsTo(models.Transporte, { 
        foreignKey: 'transporte_id', 
        as: 'transporte' 
      });
      
      // Associação com Recebimento
      Excecao.belongsTo(models.Recebimento, { 
        foreignKey: 'recebimento_id', 
        as: 'recebimento' 
      });
      
      // Associação com Usuario (criador)
      Excecao.belongsTo(models.Usuario, { 
        foreignKey: 'criador_id', 
        as: 'criador' 
      });
      
      // Associação com Usuario (responsável)
      Excecao.belongsTo(models.Usuario, { 
        foreignKey: 'responsavel_id', 
        as: 'responsavel' 
      });
    }
  }

  Excecao.init({
    // Identificação
    numero_ocorrencia: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false
    },
    
    // Tipo e classificação
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
    
    // Descrição detalhada
    titulo: {
      type: DataTypes.STRING,
      allowNull: false
    },
    
    descricao: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    
    // Relacionamentos
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
    
    // Responsáveis
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
    
    // Status e fluxo
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
    
    // Informações financeiras
    impacto_financeiro: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00
    },
    
    custo_resolucao: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00
    },
    
    // Datas importantes
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
    
    // Solução
    solucao_aplicada: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    acoes_tomadas: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // Controle de qualidade
    reincidente: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    
    numero_reincidencias: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    
    // Anexos (armazenados como JSON para simplicidade)
    anexos: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    
    // Histórico (armazenado como JSON para simplicidade)
    historico: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    
    // Metadados
    prioridade: {
      type: DataTypes.INTEGER,
      defaultValue: 3, // 1: Alta, 2: Média, 3: Baixa
      validate: {
        min: 1,
        max: 3
      }
    },
    
    tags: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    
    // Auditoria
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
    paranoid: true, // Soft delete
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

  // Hook para gerar número de ocorrência automático
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

  // Hook para atualizar histórico
  Excecao.afterUpdate(async (excecao) => {
    if (excecao.changed()) {
      const changes = excecao.changed().map(field => ({
        campo: field,
        anterior: excecao.previous(field),
        novo: excecao[field],
        data: new Date()
      }));
      
      // Adiciona ao histórico (em produção, isso seria mais robusto)
      const historicoAtual = excecao.historico || [];
      historicoAtual.push({
        timestamp: new Date(),
        acao: 'ATUALIZACAO',
        changes: changes,
        usuario_id: excecao.criador_id // Em app real, pegaria do usuário logado
      });
      
      // Atualiza sem trigger de hooks para evitar loop
      await Excecao.update(
        { historico: historicoAtual },
        { 
          where: { id: excecao.id },
          silent: true // Não dispara hooks
        }
      );
    }
  });

  return Excecao;
};