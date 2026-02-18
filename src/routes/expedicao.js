const express = require('express');
const ExpedicaoController = require('../controllers/ExpedicaoController');

const router = express.Router();

router.get('/', ExpedicaoController.getAllExpedicoes);
router.get('/:id', ExpedicaoController.getExpedicaoByID);
router.post('/:pedidoId', ExpedicaoController.createExpedicao);
router.put('/:id', ExpedicaoController.updateExpedicao);
router.delete('/:id', ExpedicaoController.deleteExpedicao);
router.post('/expedicoes/pedido/:pedidoId', ExpedicaoController.createExpedicao);
router.get('/expedicoes', ExpedicaoController.getAllExpedicoes);

module.exports = router;