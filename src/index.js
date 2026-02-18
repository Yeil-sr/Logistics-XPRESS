require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes/routes.js'); // module that exports (app) => { ... }
const { sequelize } = require('./config/sequelize');
const initDatabase = require('./db/initDatabase');

const app = express();

app.use(cors());
app.use(express.json());

routes(app);

app.use((err, req, res, next) => {
  console.error('[APP ERROR]', err && (err.stack || err.message || err));
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error', detail: err && err.message });
  }
});

let initialized = false;

async function bootstrap() {
  if (initialized) return;
  initialized = true;

  try {
    await sequelize.authenticate();
    console.log('[DB] Conectado ao banco');
  } catch (err) {
    console.error('[BOOTSTRAP] Falha ao autenticar com o banco:', err && err.message);
  }

  if (process.env.INIT_DB === 'true') {
    try {
      console.log('[DB] INIT_DB=true -> executando initDatabase()');
      await initDatabase();
      console.log('[DB] initDatabase() finalizado com sucesso');
    } catch (err) {
      // Não lançar: registrar e continuar. Lançar aqui causa 500 e crash da função.
      console.error('[DB] initDatabase falhou:', err && err.message);
    }
  } else {
    console.log('[DB] INIT_DB !== true -> pulando execução do initDatabase()');
  }
}

module.exports = async (req, res) => {
  try {
    await bootstrap();
    return app(req, res);
  } catch (err) {
    console.error('[HANDLER] Erro no handler:', err && err.message);
    res.status(500).json({ error: 'Server initialization failed', detail: err && err.message });
  }
};

if (require.main === module) {
  const port = process.env.PORT || 8080;
  (async () => {
    await bootstrap();
    app.listen(port, () => {
      console.log(`🚀 Server local rodando na porta ${port}`);
    });
  })();
}
