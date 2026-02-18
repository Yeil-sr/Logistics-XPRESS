const { MotoristasServices } = require('../services');
const motoristaServices = new MotoristasServices();
const { Coleta } = require('../models');

class MotoristaController {

  static async getAllMotoristas(req, res) {
    try {
      const motoristas = await motoristaServices.getAllRegisters();
      if (!motoristas) {
        return res.status(404).json({ message: 'Motoristas não encontrados!' });
      }
      return res.status(200).json(motoristas);
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }

  static async getAllMotoristasAtivos(req, res) {
    try {
      const motoristas = await motoristaServices.getAllMotoristasAtivos();
      if (!motoristas) {
        return res.status(404).json({ message: 'Motoristas não encontrados!' });
      }
      return res.status(200).json(motoristas);
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }

  static async getMotoristaByID(req, res) {
    const { id } = req.params;
    try {
      const motorista = await motoristaServices.getMotoristaById(id);
      if (!motorista) {
        return res.status(404).json({ message: 'Motorista não encontrado!' });
      }
      return res.status(200).json(motorista);
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }

  static async getColetasPorMotorista(req, res) {
    try {
      const { id } = req.params;
      const coletas = await Coleta.findAll({ where: { id_motorista: id } });

      if (!coletas.length) {
        return res.status(404).json({ mensagem: 'Nenhuma coleta encontrada para o motorista.' });
      }

      return res.status(200).json(coletas);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async createMotorista(req, res) {
    const motoristaInfo = req.body;
    try {
      const newMotorista = await motoristaServices.createMotorista(motoristaInfo);
      return res.status(201).json({ message: `Motorista cadastrado com sucesso`, motorista: newMotorista });
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }

  static async updateMotorista(req, res) {
    const { id } = req.params;
    const motoristaInfo = req.body;
    try {
      const updatedMotorista = await motoristaServices.updateMotorista(id, motoristaInfo);
      return res.status(200).json({ message: 'Motorista atualizado!', motorista: updatedMotorista });
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }

  static async restoreMotorista(req, res) {
    const { id } = req.params;
    try {
      await motoristaServices.restoreMotorista(id);
      return res.status(200).json({ message: `Motorista restaurado!` });
    } catch (error) {
      return res.status(500).json(error.message);
    }
  }

  static async deleteMotorista(req, res) {
    const { id } = req.params;
    try {
      await motoristaServices.deleteMotorista(id);
      return res.status(200).json({ message: `Motorista excluído!` });
    } catch (error) {
      return res.status(500).json({ message: `Erro inesperado!` });
    }
  }

}

module.exports = MotoristaController;
