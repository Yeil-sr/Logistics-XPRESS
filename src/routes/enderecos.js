const express = require('express');
const EnderecoController = require('../controllers/EnderecoController');

const router = express.Router();

router.get('/', EnderecoController.getAllEndereco);
router.get('/:id', EnderecoController.getEnderecoByID);
router.post('/', EnderecoController.createEndereco);
router.put('/:id', EnderecoController.updateEndereco);
router.delete('/:id', EnderecoController.deleteEndereco);

module.exports = router;