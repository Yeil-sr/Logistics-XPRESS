'use strict';

const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/sequelize');

async function initDatabase() {
  try {
    console.log('[DB] Inicializando schema via SQL...');

    const schemaPath = path.resolve(__dirname, './schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    // executa tudo de uma vez
    await sequelize.query(schemaSQL);

    console.log('[DB] Schema criado/verificado com sucesso.');
  } catch (err) {
    console.error('[DB] Erro ao inicializar banco:', err);
    throw err;
  }
}

module.exports = initDatabase;
