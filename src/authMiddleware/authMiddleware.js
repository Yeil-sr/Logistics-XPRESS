const jwt = require("jsonwebtoken");

const authenticateToken = (req, res, next) => {
  // Liberar autenticação para login
  if (( req.path === '/usuarios/login') && req.method === 'POST') {
    return next();
  }

  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).json({ message: "Cabeçalho de autorização não fornecido." });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Token não fornecido." });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Token inválido ou expirado." });
    }

    // user contém os dados que você assinou no token (id, email, role)
    req.user = user;
    next();
  });
};

module.exports = authenticateToken;
