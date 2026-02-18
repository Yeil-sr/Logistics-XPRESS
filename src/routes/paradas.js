const express = require('express')
const router = express.Router()
const paradaController = require('../controllers/ParadaController')

router.get('/', paradaController.getAllParadas)
     .get('/:id', paradaController.getParadaByID)
     .post('/', paradaController.createParada)
     .put('/:id', paradaController.updateParada)
     .delete('/:id', paradaController.deleteParada)

module.exports = router