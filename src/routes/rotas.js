const express = require('express')
const router  = express.Router()
const rotaController = require('../controllers/RotaController')
const ParadaController = require('../controllers/ParadaController');

router.get('/', rotaController.getAll)
     .get('/:id', rotaController.getById)
     .get('/pedidos-disponiveis', rotaController.getPedidosDisponiveis)
     .get('/disponiveis/transportes', rotaController.getRotasDisponiveisParaTransportes) 
     .post('/:id/finalizar', rotaController.finalizarRota)
     .get('/:id/paradas', rotaController.getParadas)
     .post('/:rotaId/paradas/:pedidoId', ParadaController.createParada)
     .post('/', rotaController.create)
     .put('/:id', rotaController.update)
     .delete('/:id', rotaController.delete)

module.exports = router;