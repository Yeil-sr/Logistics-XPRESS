const express = require('express')
const router = express.Router()
const separaController = require('../controllers/SeparacaoController')

router.get('/', separaController.getAllSeparacoes)
     .get('/:id', separaController.getSeparacaoByID)
     .get('/:id/pedidos', separaController.getPedidosBySeparacao)
     .post('/', separaController.createSeparacao)
     .put('/:id', separaController.updateSeparacao)
     .delete('/:id', separaController.deleteSeparacao)
     router.put('/separacoes/:id/separar',separaController.marcarComoSeparado);
router.get('/separacoes/pendentes',separaController.getPendentes);
router.get('/separacoes',separaController.getAllSeparacoes);

module.exports = router