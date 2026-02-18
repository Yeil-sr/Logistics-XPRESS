const { Router } = require('express');
const EstoqueController = require('../controllers/EstoqueController');
const router = Router();

router.get('/', EstoqueController.getAll);

router.get('/low-stock', EstoqueController.lowStock);

router.get('/summary', EstoqueController.summary);

// GET /estoques/movimentacao?produto_id=1&hub_id=1
router.get('/movimentacao', EstoqueController.getMovimentacoesByQuery);

// movimentacoes by estoque id
// GET /estoques/:id/movimentacoes
router.get('/:id/movimentacoes', EstoqueController.getMovimentacoes);

// get one estoque
// GET /estoques/:id
router.get('/:id', EstoqueController.getOne);

// operações de estoque
router.post('/entrada', EstoqueController.entrada);
router.post('/reservar', EstoqueController.reservar);
router.post('/liberar-reserva', EstoqueController.liberarReserva);
router.post('/saida', EstoqueController.saida);
router.post('/transferir', EstoqueController.transferir);
router.post('/ajustar', EstoqueController.ajustar);

module.exports = router;
