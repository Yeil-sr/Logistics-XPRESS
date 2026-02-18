const { Router } = require('express');
const PedidoItensController = require('../controllers/PedidoItensController');
const router = Router();

router.get('/', PedidoItensController.getAll);
router.get('/:id', PedidoItensController.getOne);
router.post('/', PedidoItensController.create);
router.put('/:id', PedidoItensController.update);
router.delete('/:id', PedidoItensController.remove);

// Rotas adicionais
router.get('/by-pedido/:pedidoId', PedidoItensController.getByPedido);
router.post('/:pedidoId/bulk', PedidoItensController.bulkCreate);

module.exports = router;