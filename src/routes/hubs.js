const express = require('express');
const router = express.Router();
const hubController = require('../controllers/HubController');

router.post('/', hubController.createHub);
router.get('/:id', hubController.getHubById);
router.get('/', hubController.getAllHubs);
router.delete('/:id', hubController.deleteHub);

module.exports = router;