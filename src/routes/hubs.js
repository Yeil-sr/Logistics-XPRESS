const express = require('express');
const router = express.Router();
const hubController = require('../controllers/HubController');

router.post('/:pedidoId', hubController.createHub);
router.get('/', hubController.getAllHubs);
router.delete('/:id', hubController.deleteHub);

module.exports = router;