const { Router } = require('express');
const EstoqueController = require('../controllers/EstoqueController');

const router = Router();

router.get('/', EstoqueController.getAll);
router.get('/:id', EstoqueController.getOne);
router.post('/', EstoqueController.create);
router.put('/:id', EstoqueController.update);
router.delete('/:id', EstoqueController.delete);

module.exports = router;