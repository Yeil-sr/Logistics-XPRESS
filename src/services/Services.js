const db = require('../models');

class Services {
  constructor(nomeModelo) {
    this.nomeModelo = nomeModelo;
  }

  async getAllRegisters() {
    return db[this.nomeModelo].findAll();
  }

  async getOneRegister(where = {}) {
    return db[this.nomeModelo].findOne({ where: { ...where } });
  }

  async createRegister(data) {
    return db[this.nomeModelo].create(data);
  }

  async updateRegister(updateData, id) {
    await db[this.nomeModelo].update(updateData, { where: { id: Number(id) } });
    return db[this.nomeModelo].findByPk(Number(id));
  }

  async deleteRegister(id) {
    return db[this.nomeModelo].destroy({ where: { id: Number(id) } });
  }
}

module.exports = Services;
