'use strict';

const fs = require('fs');
const path = require('path');
const basename = path.basename(__filename);
const { sequelize, Sequelize } = require('../config/sequelize'); 
const db = {};

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    const modelDef = require(path.join(__dirname, file));
    const model = (typeof modelDef === 'function')
      ? modelDef(sequelize, Sequelize.DataTypes)
      : modelDef;
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
