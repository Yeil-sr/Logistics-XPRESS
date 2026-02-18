// src/scripts/create-admin.js
// Cria usuário admin usando o profile sqlite (arquivo ./data/logistica.sqlite)

process.env.DB_DIALECT = process.env.DB_DIALECT || 'sqlite';
process.env.NODE_ENV = process.env.NODE_ENV || 'sqlite';

const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.resolve(__dirname, '..', '..', 'data', 'logistica.sqlite');
// opcional: log do storage que será usado
console.log('Usando storage sqlite em:', dbPath);

const db = require(path.resolve(__dirname, '..', 'models')); // src/models

(async () => {
  try {
    if (db && db.sequelize) {
      // autentica e habilita pragmas caso seu sequelize tenha enableSqlitePragmas
      await db.sequelize.authenticate();
      if (typeof db.sequelize.query === 'function') {
        try {
          await db.sequelize.query('PRAGMA foreign_keys = ON;');
          await db.sequelize.query('PRAGMA journal_mode = WAL;');
        } catch (e) {
          // ignora se não for sqlite ou se não suportar
        }
      }
      console.log('✅ DB conectado (sqlite).');
    }

    const Usuario = db.Usuario || db.Usuarios;
    if (!Usuario) throw new Error('Modelo Usuario não encontrado em db (db.Usuario ou db.Usuarios).');

    // Verifica se já existe
    const existing = await Usuario.findOne({ where: { email: 'admin@logi.com' } });
    if (existing) {
      console.log('⚠️ Usuário admin@logi.com já existe (id:', existing.id, ')');
      if (db && db.sequelize) await db.sequelize.close();
      process.exit(0);
    }

    const senha = 'admin123';
    const saltRounds = 12;
    const hash = await bcrypt.hash(senha, saltRounds);

    const novo = await Usuario.create({
      nome: 'Administrador',
      email: 'admin@logi.com',
      senha_hash: hash,
      role: 'ADMIN',
      status: 'ATIVO'
    });

    console.log('✅ Usuário criado com sucesso:', { id: novo.id, email: novo.email });

    if (db && db.sequelize) await db.sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro ao criar admin:', err.message || err);
    if (db && db.sequelize) {
      try { await db.sequelize.close(); } catch(e){}
    }
    process.exit(1);
  }
})();
