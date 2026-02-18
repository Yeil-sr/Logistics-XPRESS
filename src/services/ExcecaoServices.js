const Services = require('./Services');

class ExcecaoService extends Services {
  constructor() {
    super('Excecao'); 
  }

  async getByStatus(status) {
    return this.getAllRegisters({ where: { status } });
  }
}

module.exports = ExcecaoService;
