const express = require('express');
const router = express.Router();
const RecebimentoController = require('../controllers/RecebimentoController');

router.get('/', RecebimentoController.getAllRecebimentos);
router.get('/:id/', RecebimentoController.getById);
router.post('/', RecebimentoController.create);
router.post('/:id/concluir', RecebimentoController.concluirRecebimento);
router.get('/:id/pedidos', RecebimentoController.getPedidos);
router.get('/:id/pedidos/count', RecebimentoController.countPedidos);
router.put('/:id/', RecebimentoController.update);
router.delete('/:id/', RecebimentoController.delete);

module.exports = router;