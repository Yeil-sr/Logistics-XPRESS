const express = require('express');
const router = express.Router();
const TransferenciaController = require('../controllers/TransferenciaController');

router.get('/', TransferenciaController.getAllTransferencias)
      .post('/from-recebimento/:recebimentoId', TransferenciaController.createFromRecebimento)
      .post('/', TransferenciaController.createTransferencia)
      .get('/:id/pedidos', TransferenciaController.getPedidos)
      .get('/:id', TransferenciaController.getTransferenciaByID)
      .put('/:id', TransferenciaController.updateTransferencia)
      .delete('/:id', TransferenciaController.deleteTransferencia)
      .post('/:id/concluir', TransferenciaController.concluirTransferencia);

module.exports = router;