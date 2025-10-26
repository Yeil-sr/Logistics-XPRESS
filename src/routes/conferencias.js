const express = require('express');
const router = express.Router();
const ConferenciaController = require('../controllers/ConferenciaController');

router.get('/', ConferenciaController.getAll);
router.get('/search', ConferenciaController.search);
router.get('/:id', ConferenciaController.getById);
router.post('/:id/concluir', ConferenciaController.concluirConferencia);
router.post('/:id/pedido/:pedidoId/validar', ConferenciaController.validarPedido);
router.post('/:id/pedido/:pedidoId/invalidar', ConferenciaController.invalidarPedido);
router.get('/:id/pedidos', ConferenciaController.getPedidos);
router.get('/:id/pedidos-validados', ConferenciaController.getPedidosValidados);
router.post('/', ConferenciaController.create);
router.put('/:id', ConferenciaController.update);
router.delete('/:id', ConferenciaController.delete);

module.exports = router;