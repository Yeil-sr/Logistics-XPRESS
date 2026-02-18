const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = process.env.NODE_ENV || 'sqlite';
process.env.DB_DIALECT = process.env.DB_DIALECT || 'sqlite';

const modelsPath = path.resolve(__dirname, '..', 'models');
const servicesPath = path.resolve(__dirname, '..', 'services');

function gatherModelAttrs(db) {
  const map = {};
  Object.keys(db).forEach(k => {
    if (['sequelize','Sequelize'].includes(k)) return;
    const model = db[k];
    const attrs = model.rawAttributes ? Object.keys(model.rawAttributes) : [];
    map[k] = { tableName: model.getTableName ? model.getTableName() : (model.tableName || k), attrs };
  });
  return map;
}

function scanServiceFile(filePath) {
  const txt = fs.readFileSync(filePath, 'utf8');
  const matches = new Set();
  // find patterns like pedido_id, id_pedido, usuario_id, deletedAt, Conferencia, Recebimento
  const idMatches = txt.match(/\b([a-zA-Z0-9_]*_id|id_[a-zA-Z0-9_]+|deletedAt|deleted_at|Conferencia|Recebimento|id_conferencia|pedido_id|id_pedido|usuario_id|criador_id)\b/g);
  if (idMatches) idMatches.forEach(m => matches.add(m));
  return { file: filePath, matches: Array.from(matches) };
}

async function main() {
  console.log('Carregando modelos (precisa apontar models/index.js corretamente)...');
  const db = require(modelsPath);
  const modelMap = gatherModelAttrs(db);
  // flatten attributes to quick lookup
  const attrLookup = {};
  Object.entries(modelMap).forEach(([m, { tableName, attrs }]) => {
    attrs.forEach(a => {
      attrLookup[a] = attrLookup[a] || [];
      attrLookup[a].push({ model: m, table: tableName });
    });
  });

  console.log('Procurando services em:', servicesPath);
  if (!fs.existsSync(servicesPath)) {
    console.warn('Pasta services não encontrada em', servicesPath, '- ajuste o caminho se necessário.');
  }

  const serviceFiles = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(f => {
      const fp = path.join(dir, f);
      if (fs.statSync(fp).isDirectory()) return walk(fp);
      if (fp.endsWith('.js')) serviceFiles.push(fp);
    });
  }
  walk(servicesPath);

  console.log('Arquivos de service encontrados:', serviceFiles.length);
  const serviceFindings = [];
  serviceFiles.forEach(sf => {
    const res = scanServiceFile(sf);
    if (res.matches.length) serviceFindings.push(res);
  });

  // build report: for each service match, check whether the token exists as a model attribute
  const report = [];
  serviceFindings.forEach(s => {
    const missing = [];
    s.matches.forEach(token => {
      // normalize certain tokens (remove trailing punctuation)
      const t = token.trim();
      // ignore table names for now if they are not column-like
      if (t.match(/^[A-Z][a-zA-Z0-9]+$/)) {
        // table-like (Conferencia) check the model names too:
        // check model names and table names
        const foundModel = Object.entries(modelMap).find(([m,info]) => {
          return m.toLowerCase() === t.toLowerCase() || (String(info.tableName).toLowerCase() === t.toLowerCase() || String(info.tableName).toLowerCase() === (t+'s').toLowerCase());
        });
        if (!foundModel) missing.push(t);
      } else {
        // column-like check attrLookup
        if (!attrLookup[t]) missing.push(t);
      }
    });
    if (missing.length) report.push({ file: s.file, missing });
  });

  if (!report.length) {
    console.log('✅ Nenhuma incompatibilidade óbvia encontrada entre services e models (para tokens pesquisados).');
  } else {
    console.log('❗ Incompatibilidades encontradas:');
    report.forEach(r => {
      console.log('\nArquivo:', r.file);
      console.log('Campos/Tokens referenciados nos services NÃO encontrados nos atributos dos models:', r.missing.join(', '));
    });
  }

  // print quick model attribute summary
  console.log('\nResumo dos models (atributos principais):');
  Object.entries(modelMap).forEach(([m, info]) => {
    console.log(`- ${m} (table=${info.tableName}) => attrs: ${info.attrs.slice(0,20).join(', ')}${info.attrs.length>20 ? ', ...':''}`);
  });

  process.exit(0);
}

main();
