const { Router } = require('express');
const ManifestosController = require('../controllers/ManisfestosController'); 
const router = Router();

router.get('/', ManifestosController.getAll);
router.get('/:id', ManifestosController.getOne);
router.post('/', ManifestosController.create);
router.put('/:id', ManifestosController.update);
router.delete('/:id', ManifestosController.delete);

router.post('/:id/associate-notas', ManifestosController.associateNotas);
router.get('/:id/notas', ManifestosController.getNotas);

router.post('/from-pedidos', ManifestosController.createFromPedidos);

module.exports = router;
