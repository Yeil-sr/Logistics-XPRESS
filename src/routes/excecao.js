const { Router } = require('express');
const ExcecaoController = require('../controllers/ExcecaoController');

const router = Router();

router.get('/', ExcecaoController.getAll);
router.get('/:id', ExcecaoController.getOne);
router.post('/', ExcecaoController.create);
router.put('/:id', ExcecaoController.update);
router.delete('/:id', ExcecaoController.delete);

module.exports = router;