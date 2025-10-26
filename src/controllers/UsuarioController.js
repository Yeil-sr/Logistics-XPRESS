const db = require('../models');
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

class UsuarioController {

  static async getUsers(_, res) {
    try {
      const users = await db.Usuario.findAll();
      res.status(200).json(users);
    } catch (err) {
      res.status(500).json({ message: "Erro ao obter usuários.", error: err.message });
    }
  }

  static async getUserId(req, res) {
    try {
      const { id } = req.params;
      const user = await db.Usuario.findByPk(id, {
        attributes: ['id', 'nome', 'email', 'role', 'status']
      });

      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado." });
      }

      res.status(200).json(user);
    } catch (err) {
      res.status(500).json({ message: "Erro ao buscar o usuário.", error: err.message });
    }
  }

  static async addUser(req, res) {
    try {
      const hashedPassword = await bcrypt.hash(req.body.senha_hash, 10);

      const newUser = await db.Usuario.create({
        nome: req.body.nome,
        email: req.body.email,
        role: req.body.role,
        status: req.body.status,
        senha_hash: hashedPassword
      });

      res.status(201).json({ message: "Usuário criado com sucesso.", usuario: newUser });
    } catch (err) {
      res.status(500).json({ message: "Erro ao criar o usuário.", error: err.message });
    }
  }

static async login(req, res) {
  try {
    const { email, senha_hash } = req.body;

    const user = await db.Usuario.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    const isPasswordValid = await bcrypt.compare(senha_hash, user.senha_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Senha incorreta." });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },  // inclui role no payload
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json({
      message: "Login bem-sucedido.",
      token,
      id: user.id,
      nome: user.nome,
      email: user.email,
      role: user.role,
      status: user.status
    });
  } catch (err) {
    res.status(500).json({ message: "Erro ao fazer login.", error: err.message });
  }
}

  static async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { nome, email, role, status, senha_hash } = req.body;

      let updatedData = { nome, email, role, status };

      if (senha_hash) {
        updatedData.senha_hash = await bcrypt.hash(senha_hash, 10);
      }

      const [updated] = await db.Usuario.update(updatedData, { where: { id } });

      if (!updated) {
        return res.status(404).json({ message: "Usuário não encontrado." });
      }

      const updatedUser = await db.Usuario.findByPk(id);
      res.status(200).json({ message: "Usuário atualizado com sucesso.", usuario: updatedUser });
    } catch (err) {
      res.status(500).json({ message: "Erro ao atualizar o usuário.", error: err.message });
    }
  }

  static async deleteUser(req, res) {
    try {
      const { id } = req.params;

      const deleted = await db.Usuario.destroy({ where: { id } });

      if (!deleted) {
        return res.status(404).json({ message: "Usuário não encontrado." });
      }

      res.status(200).json({ message: "Usuário deletado com sucesso." });
    } catch (err) {
      res.status(500).json({ message: "Erro ao deletar o usuário.", error: err.message });
    }
  }
}

module.exports = UsuarioController;
