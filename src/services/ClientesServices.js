const Services = require('./Services');

class ClientesServices extends Services {
    constructor() {
        super('Clientes');
    }

    async restoreRegister(id) {
        return this.db[this.nomeModelo].restore({ where: { id } });
    }
}

module.exports = ClientesServices;
