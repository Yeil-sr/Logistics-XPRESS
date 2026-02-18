const express = require('express')
const router = express.Router()
const clienteController = require('../controllers/ClienteController')

router.get('/', clienteController.getAllClients)
     .get('/:id', clienteController.getClientByID)
     .post('/', clienteController.createClient)
     .post('/:id/restaura', clienteController.restoreClient)
     .put('/:id', clienteController.updateClient)
     .delete('/:id', clienteController.deleteClient)
     
module.exports = router