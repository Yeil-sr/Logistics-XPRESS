const express = require('express')
const router = express.Router()
const rastreamentoController = require('../controllers/RastreamentoController')

router.get('/', rastreamentoController.getAllRastreamento)
     .get('/:id', rastreamentoController.getRastreamentoByID)
     .post('/', rastreamentoController.createRastreamento)
     .put('/:id', rastreamentoController.updateRastreamento)
     .delete('/:id', rastreamentoController.deleteRastreamento)

module.exports = router