const path = require('path');
const { Sequelize } = require('sequelize');
const fs = require('fs');

let pgModule = null;
try {
  pgModule = require('pg');
  console.log('[Sequelize] pg package carregado com sucesso');
} catch (err) {
  console.warn('[Sequelize] pg package não encontrado, tentando carregamento alternativo...');
  try {
    pgModule = require('pg');
  } catch (e) {
    console.error('[Sequelize] Falha ao carregar pg:', e.message);
    pgModule = null;
  }
}

const env = process.env.NODE_ENV || 'development';
const configAll = require(path.resolve(__dirname, './config.json'));

let profile = env;
if (process.env.DB_DIALECT) {
  profile = process.env.DB_DIALECT;
  console.log(`[Sequelize] Usando dialeto forçado: ${profile}`);
} else if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres')) {
  profile = 'postgres-production';
  console.log('[Sequelize] DATABASE_URL detectada, priorizando PostgreSQL via DATABASE_URL');
}

const config = configAll[profile] || null;

let sequelize;

if (process.env.DATABASE_URL) {
  console.log('[Sequelize] Configurando com DATABASE_URL (Postgres)');

  const dialectOptions = {};

  if (
    process.env.DATABASE_URL.includes('sslmode=require') ||
    process.env.DATABASE_URL.includes('ssl=true') ||
    process.env.DB_SSL !== 'false'
  ) {
    dialectOptions.ssl = {
      require: true,
      rejectUnauthorized: false
    };
    console.log('[Sequelize] SSL habilitado para Postgres');
  }

  if (process.env.DATABASE_URL.includes('pooler') || process.env.USE_POOLED === 'true') {
    dialectOptions.statement_timeout = 60000;
    console.log('[Sequelize] Ajustes para pooler detectados');
  }

  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectModule: pgModule || undefined,
    logging: process.env.SQL_LOG === 'true' ? (msg) => console.log(`[SQL] ${msg}`) : false,
    dialectOptions,
    pool: {
      max: process.env.DB_POOL_MAX ? Number(process.env.DB_POOL_MAX) : 5,
      min: process.env.DB_POOL_MIN ? Number(process.env.DB_POOL_MIN) : 0,
      acquire: 30000,
      idle: 10000
    },
    retry: {
      max: 3
    },
    define: {
      underscored: true,    
      freezeTableName: false,
      timestamps: true
    }
  });

  console.log('[Sequelize] Sequelize configurado para PostgreSQL via DATABASE_URL');

}
else if (config && config.dialect === 'sqlite') {
  console.log('[Sequelize] Configurando SQLite');

  if (config.storage && config.storage !== ':memory:') {
    const storagePath = path.resolve(process.cwd(), config.storage);
    const dir = path.dirname(storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`[Sequelize] Diretório criado: ${dir}`);
    }
    console.log(`[Sequelize] SQLite storage: ${storagePath}`);
  }

  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: config.storage,
    logging: config.logging === true ? (msg) => console.log(`[SQLite] ${msg}`) : false,
    define: {
      underscored: true,
      freezeTableName: false,
      timestamps: true
    },
    pool: {
      max: 5,
      min: 0,
      idle: 10000
    },
    retry: {
      match: [/SQLITE_BUSY/],
      max: 5
    }
  });

  console.log(`[Sequelize] Sequelize configurado para SQLite: ${config.storage}`);

}
else if (config) {
  console.log(`[Sequelize] Configurando ${config.dialect || 'mysql'} do config.json`);

  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    {
      host: config.host,
      port: config.port,
      dialect: config.dialect,
      dialectModule: config.dialect === 'postgres' ? pgModule : undefined,
      logging: config.logging === true ? (msg) => console.log(`[${config.dialect}] ${msg}`) : false,
      pool: config.pool || {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      define: {
        underscored: true,
        freezeTableName: false,
        timestamps: true
      },
      dialectOptions: config.dialectOptions || {},
      retry: {
        max: 3
      }
    }
  );

  console.log(`[Sequelize] Sequelize configurado para ${config.dialect}: ${config.host || 'localhost'}:${config.port || ''}/${config.database || ''}`);

} else {
  throw new Error('Nenhuma configuração de banco válida encontrada. Configure DATABASE_URL ou profiles em config.json.');
}

async function enableSqlitePragmas() {
  if (sequelize.getDialect && sequelize.getDialect() === 'sqlite') {
    try {
      await sequelize.query('PRAGMA foreign_keys = ON;');
      await sequelize.query('PRAGMA journal_mode = WAL;');
      await sequelize.query('PRAGMA synchronous = NORMAL;');
      await sequelize.query('PRAGMA cache_size = -2000;'); 
      console.log('[Sequelize] SQLite PRAGMAs habilitados com sucesso');
    } catch (err) {
      console.warn('[Sequelize] Erro ao setar PRAGMA no sqlite:', err.message);
    }
  }
}

async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log(`[Sequelize] Conexão com ${sequelize.getDialect()} estabelecida com sucesso`);
    return true;
  } catch (error) {
    console.error(`[Sequelize] Falha na conexão com ${sequelize.getDialect()}:`, error && error.message ? error.message : error);
    return false;
  }
}

async function closeConnection() {
  try {
    await sequelize.close();
    console.log('[Sequelize] Conexão fechada');
  } catch (error) {
    console.error('[Sequelize] Erro ao fechar conexão:', error.message);
  }
}

async function checkConnectionStatus() {
  try {
    await sequelize.authenticate();
    return {
      status: 'connected',
      dialect: sequelize.getDialect(),
      database: (sequelize.config && sequelize.config.database) || 'N/A'
    };
  } catch (error) {
    return {
      status: 'disconnected',
      error: error.message,
      dialect: sequelize.getDialect ? sequelize.getDialect() : 'unknown'
    };
  }
}

module.exports = {
  sequelize,
  Sequelize,
  enableSqlitePragmas,
  testConnection,
  closeConnection,
  checkConnectionStatus
};
