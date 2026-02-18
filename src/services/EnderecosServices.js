const Services = require('./Services');

class EnderecosServices extends Services {
  constructor() {
    super('Enderecos');
  }

  async getEnderecoById(id) {
    return this.getOneRegister({ id: Number(id) });
  }

  async createEndereco(data) {
    return this.createRegister(data);
  }

  async updateEndereco(id, data) {
    return this.updateRegister(data, Number(id));
  }

  async deleteEndereco(id) {
    return this.deleteRegister(Number(id));
  }
}

module.exports = EnderecosServices;
