const express = require('express');
const ProdutoController = require('../controllers/ProdutoController');

const router = express.Router();

router.get('/', ProdutoController.getAllProdutos);
router.get('/:id', ProdutoController.getProdutoByID);
router.post('/', ProdutoController.createProduto);
router.put('/:id', ProdutoController.updateProduto);
router.delete('/:id', ProdutoController.deleteProduto);
router.get('/:id/pedido', ProdutoController.getPedidoByProduto);

module.exports = router;