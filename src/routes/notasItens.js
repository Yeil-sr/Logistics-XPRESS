const { Router } = require('express');
const NotasItensController = require('../controllers/NotasItensController');
const router = Router();

router.get('/', NotasItensController.getAll);
router.get('/:id', NotasItensController.getOne);
router.post('/', NotasItensController.create);
router.put('/:id', NotasItensController.update);
router.delete('/:id', NotasItensController.remove);

// Rotas adicionais
router.get('/by-nota/:notaId', NotasItensController.getByNota);
router.post('/bulk', NotasItensController.bulkCreate);

module.exports = router;