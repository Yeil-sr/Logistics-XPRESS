const express = require('express');
const router = express.Router();
const userController = require('../controllers/UsuarioController');

router.post("/login", userController.login); 

router.get("/", userController.getUsers);
router.get("/:id", userController.getUserId);
router.post("/", userController.addUser); 
router.put("/:id", userController.updateUser);
router.delete("/:id", userController.deleteUser);

module.exports = router;