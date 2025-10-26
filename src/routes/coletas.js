const express = require('express');
const ColetaController = require('../controllers/ColetaController');

const router = express.Router();

router.get('/', ColetaController.getAllColetas);
router.get('/:id', ColetaController.getColetaByID);
router.post('/', ColetaController.createColeta);
router.put('/:id', ColetaController.updateColeta);
router.delete('/:id', ColetaController.deleteColeta);
router.put('/coletas/:id/coletar', ColetaController.marcarComoColetado);
router.get('/coletas/pendentes', ColetaController.getPendentes);
router.get('/coletas', ColetaController.getAllColetas);

// FK
// router.get('/:id/pedido', ColetaController.getPedidoByColeta);
// router.get('/:id/motorista', ColetaController.getMotoristaByColeta);

module.exports = router;