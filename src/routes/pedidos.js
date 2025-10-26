const express = require('express');
const router = express.Router();
const pedidosController = require('../controllers/PedidoController');

router.get('/', pedidosController.getAllPedidos)
      .get('/contadores', pedidosController.getPedidosCountByStatus)
      .get('/:id', pedidosController.getPedidoByID)
      .get('/:id/rastreamento', pedidosController.getRastreamentos)
      .post('/', pedidosController.createPedido)
      .put('/:id', pedidosController.updatePedido)
      .delete('/:id', pedidosController.deletePedido)
      .post('/:id/associar-transporte', pedidosController.associarTransporte)
      .post('/:id/remover-transporte', pedidosController.removerAssociacaoTransporte)
      .get('/codigo/:codigoPedido', pedidosController.getPedidoByCodigo)



// RECEBIMENTOS
router.post('/recebimentos/:id/associar-pedido', pedidosController.associarRecebimento);
router.post('/recebimentos/:id/remover-pedido/:pedidoId', pedidosController.removerAssociacaoRecebimento);

// TRANSFERÊNCIAS
router.post('/transferencias/:id/associar-pedido', pedidosController.associarTransferencia);
router.post('/transferencias/:id/remover-pedido/:pedidoId', pedidosController.removerAssociacaoTransferencia);

// CONFERÊNCIAS
router.post('/conferencias/:id/associar-pedido', pedidosController.associarConferencia);
router.post('/conferencias/:id/remover-pedido/:pedidoId', pedidosController.removerAssociacaoConferencia);

module.exports = router;