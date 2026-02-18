const {ExcecaoServices} = require('../services');
const excecaoService = new ExcecaoServices();

class ExcecaoController {
  static async getAll(req, res) {
    try {
      const excecoes = await excecaoService.getAllRegisters();
      return res.status(200).json(excecoes);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async getOne(req, res) {
    const { id } = req.params;
    try {
      const excecao = await excecaoService.getOneRegister({ id: Number(id) });
      if (!excecao) return res.status(404).json({ error: 'Exceção não encontrada' });
      return res.status(200).json(excecao);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async create(req, res) {
    try {
      const newExcecao = await excecaoService.createRegister(req.body);
      return res.status(201).json(newExcecao);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async update(req, res) {
    const { id } = req.params;
    try {
      const updated = await excecaoService.updateRegister(req.body, id);
      if (!updated) return res.status(404).json({ error: 'Exceção não encontrada' });
      return res.status(200).json(updated);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async delete(req, res) {
    const { id } = req.params;
    try {
      const deleted = await excecaoService.deleteRegister(id);
      if (!deleted) return res.status(404).json({ error: 'Exceção não encontrada' });
      return res.status(200).json({ message: 'Exceção excluída com sucesso' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}

module.exports = ExcecaoController;
