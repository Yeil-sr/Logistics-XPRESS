const { ClientesServices } = require('../services');
const clientesServices = new ClientesServices();

class ClienteController {

    static async getAllClients(req, res) {
        try {
            const clients = await clientesServices.getAllRegisters();
            return res.status(200).json(clients);
        } catch (error) {
            return res.status(500).json(error.message);
        }
    }

  static async getClientByID(req, res) {
    const { id } = req.params;
    const numericId = Number(id);

    if (isNaN(numericId)) {
        return res.status(400).json({ message: 'ID inválido. O ID deve ser um número.' });
        
    }

    try {
        const client = await clientesServices.getOneRegister({ id: numericId });
        
      if (!client) {
        return res.status(404).json({ message: "Cliente não encontrado." });
      }

        return res.status(200).json(client);
    } catch (error) {
        return res.status(500).json(error.message);
    }
}


    static async createClient(req, res) {
        const clientInfo = req.body;
        try {
            const newClient = await clientesServices.createRegister(clientInfo);
            return res.status(201).json({ message: `Cliente criado com sucesso`, data: newClient });
        } catch (error) {
            return res.status(500).json(error.message);
        }
    }

  static async updateClient(req, res) {
    const { id } = req.params;
    const numericId = Number(id);
    const clientInfo = req.body;

    if (isNaN(numericId)) {
        return res.status(400).json({ message: 'ID inválido. O ID deve ser um número.' });
    }

    try {
        const updated = await clientesServices.updateRegister(clientInfo, numericId);
        return res.status(200).json({ message: `Cliente atualizado`, data: updated });
    } catch (error) {
        return res.status(500).json(error.message);
    }
}

  static async restoreClient(req, res) {
    const { id } = req.params;
    const numericId = Number(id);

    if (isNaN(numericId)) {
        return res.status(400).json({ message: 'ID inválido. O ID deve ser um número.' });
    }

    try {
        const restored = await clientesServices.restoreRegister(numericId);
        return res.status(200).json({ message: `Cliente restaurado`, data: restored });
    } catch (error) {
        return res.status(500).json(error.message);
    }
}

    static async deleteClient(req, res) {
        const { id } = req.params;
        const numericId = Number(id);

        if (isNaN(numericId)) {
            return res.status(400).json({ message: 'ID inválido. O ID deve ser um número.' });
        }

        try {
            await clientesServices.deleteRegister(numericId);
            return res.status(200).json({ message: `Cliente ${id} excluído com sucesso` });
        } catch (error) {
            return res.status(500).json(error.message);
        }
    }
}

module.exports = ClienteController;
