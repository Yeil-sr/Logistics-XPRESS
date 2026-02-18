process.env.DB_DIALECT = process.env.DB_DIALECT || 'sqlite';
process.env.NODE_ENV = process.env.NODE_ENV || 'sqlite';

const path = require('path');

(async () => {
  try {
    // carrega os modelos (models/index.js deve usar src/config/sequelize.js)
    const db = require(path.resolve(__dirname, '..', 'models'));
    const sequelize = db.sequelize;

    console.log('Autenticando...');
    await sequelize.authenticate();

    // Opcional: log de dialect/storage
    console.log('Dialect:', sequelize.getDialect());
    console.log('Storage:', sequelize.options.storage);

    // Force true dropa e recria todas as tabelas - útil para dev/demo
    console.log('Dropping & recreating all tables (force: true)...');
    await sequelize.sync({ force: true }); // WARNING: destrói dados

    console.log('DB recriado com sucesso.');
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('Erro ao resetar DB:', err);
    process.exit(1);
  }
})();
