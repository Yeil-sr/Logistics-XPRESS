const express = require('express');
const MotoristaController = require('../controllers/MotoristaController');

const router = express.Router();

router.get('/', MotoristaController.getAllMotoristas);
router.get('/:id', MotoristaController.getMotoristaByID);
router.get('/:id/coletas', MotoristaController.getColetasPorMotorista);
router.post('/', MotoristaController.createMotorista);
router.put('/:id', MotoristaController.updateMotorista);
router.delete('/:id', MotoristaController.deleteMotorista);

module.exports = router;