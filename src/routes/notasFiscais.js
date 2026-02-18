const { Router } = require('express');
const NotasFiscaisController = require('../controllers/NotasFiscaisController');
const router = Router();

router.get('/', NotasFiscaisController.getAll);
router.get('/:id', NotasFiscaisController.getOne);
router.post('/', NotasFiscaisController.create);
router.put('/:id', NotasFiscaisController.update);
router.delete('/:id', NotasFiscaisController.remove);

// Rotas adicionais
router.get('/by-pedido/:pedidoId', NotasFiscaisController.getByPedido);
router.get('/:id/itens', NotasFiscaisController.getItens);

module.exports = router;