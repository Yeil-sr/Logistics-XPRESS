const express = require('express');
const router = express.Router();
const TransporteController = require('../controllers/TransporteController');

router.get('/conferencias/disponiveis', TransporteController.getConferenciasDisponiveis);
router.get('/hubs', TransporteController.getHubs);
router.get('/motoristas-disponiveis', TransporteController.getMotoristasDisponiveis);
router.get('/rotas-disponiveis', TransporteController.getRotasDisponiveis);

router.get('/:id/pedidos', TransporteController.getPedidos);
router.get('/:id/pedidos-rota', TransporteController.getPedidosParaRota);
router.get('/:id/conferencias', TransporteController.getConferenciasAssociadas);
router.post('/:id/associar-pedidos', TransporteController.associarPedidos);
router.post('/:id/associar-conferencia', TransporteController.associarConferencia);
router.post('/:id/remover-conferencia', TransporteController.removerAssociacaoConferencia);
router.post('/:id/atualizar-status', TransporteController.atualizarStatus);
router.post('/:id/iniciar', TransporteController.iniciarTransporte);
router.post('/:id/atribuir-motorista', TransporteController.atribuirMotorista);
router.post('/:id/atribuir-rota', TransporteController.atribuirRota);
router.post('/:id/criar-rota', TransporteController.criarRota);

router.get('/', TransporteController.getAll);
router.get('/:id', TransporteController.getById);
router.post('/', TransporteController.create);
router.put('/:id', TransporteController.update);
router.delete('/:id', TransporteController.delete);


module.exports = router;
