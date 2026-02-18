const {EnderecosServices} = require('../services');
const enderecosServices = new EnderecosServices();

class EnderecoController {
  static async getAllEndereco(req, res) {
    try {
      const enderecos = await enderecosServices.getAllRegisters();
      return res.status(200).json(enderecos);
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }

  static async getEnderecoByID(req, res) {
    try {
      const { id } = req.params;
      const endereco = await enderecosServices.getEnderecoById(id);
      if (!endereco) return res.status(404).json({ message: "Rastreamento não encontrado." });
      return res.status(200).json(endereco);
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }

  static async createEndereco(req, res) {
    const enderecoInfo = req.body;
    try {
      const endereco = await enderecosServices.createEndereco(enderecoInfo);
      return res.status(200).json(endereco);
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }

  static async updateEndereco(req, res) {
    const { id } = req.params;
    const enderecoInfo = req.body;
    try {
      const enderecoAtualizado = await enderecosServices.updateEndereco(id, enderecoInfo);
      return res.status(200).json(enderecoAtualizado);
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }

  static async deleteEndereco(req, res) {
    const { id } = req.params;
    try {
      await enderecosServices.deleteEndereco(id);
      return res.status(200).json({ message: `Endereço ${id} deletado com sucesso` });
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }
}

module.exports = EnderecoController;
