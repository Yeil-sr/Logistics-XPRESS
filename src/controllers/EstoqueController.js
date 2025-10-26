const {EstoquesServices} = require('../services');
const estoqueService = new EstoquesServices();

class EstoqueController {
  static async getAll(req, res) {
    try {
      const registros = await estoqueService.getAllRegisters();
      return res.status(200).json(registros);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async getOne(req, res) {
    const { id } = req.params;
    try {
      const registro = await estoqueService.getOneRegister({ id: Number(id) });
      if (!registro) return res.status(404).json({ error: 'Estoque não encontrado' });
      return res.status(200).json(registro);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async create(req, res) {
    try {
      const novoRegistro = await estoqueService.createRegister(req.body);
      return res.status(201).json(novoRegistro);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async update(req, res) {
    const { id } = req.params;
    try {
      const atualizado = await estoqueService.updateRegister(req.body, id);
      if (!atualizado) return res.status(404).json({ error: 'Estoque não encontrado' });
      return res.status(200).json(atualizado);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async delete(req, res) {
    const { id } = req.params;
    try {
      const deletado = await estoqueService.deleteRegister(id);
      if (!deletado) return res.status(404).json({ error: 'Estoque não encontrado' });
      return res.status(200).json({ message: 'Estoque excluído com sucesso' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}

module.exports = EstoqueController;
