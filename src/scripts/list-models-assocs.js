// scripts/list-models-assocs.js
const path = require('path');
const db = require(path.resolve(__dirname, '../src/models')); // ajuste se necessário

console.log('--- MODELS ---');
Object.keys(db).filter(k => !['sequelize','Sequelize'].includes(k)).forEach(k => console.log('-', k));

console.log('\n--- ASSOCIATIONS ---');
Object.keys(db).forEach(name => {
  const model = db[name];
  if (!model || !model.associations) return;
  const keys = Object.keys(model.associations);
  if (keys.length) {
    console.log(`\n${name}:`);
    keys.forEach(k => {
      const a = model.associations[k];
      console.log(`  - assocKey: ${k} | type: ${a.associationType} | target: ${a.target && a.target.name} | as: ${a.as}`);
    });
  }
});
