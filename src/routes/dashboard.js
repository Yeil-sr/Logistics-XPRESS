const express = require('express');
const router = express.Router();
const path = require("path");

router.get("/diagrama", (req, res) => {
    res.sendFile(path.join(__dirname, "../views/diagrama.html"));
});
router.get("/diagrama-bpmn", (req, res) => {
    res.sendFile(path.join(__dirname, "../views/diagramaBPMN.html"));
});
router.get("/rota", (req, res) => {
    res.sendFile(path.join(__dirname, "../views/rota.html"));
});
router.get("/expedicao", (req, res) => {
    res.sendFile(path.join(__dirname, "../views/expedicao.html"));
});
router.get("/processamento", (req, res) => {
    res.sendFile(path.join(__dirname, "../views/processamento.html"));
});
router.get("/separacao", (req, res) => {
    res.sendFile(path.join(__dirname, "../views/separacao.html"));
});
router.get("/excecoes", (req, res) => {
    res.sendFile(path.join(__dirname, "../views/excecoes.html"));
});
router.get("/relatorios", (req, res) => {
    res.sendFile(path.join(__dirname, "../views/relatorio.html"));
});
router.get("/estoque", (req, res) => {
    res.sendFile(path.join(__dirname, "../views/estoque.html"));
});
router.get("/rastreamento", (req, res) => {
    res.sendFile(path.join(__dirname, "../views/rastreamento.html"));
});
router.get("/hubs", (req, res) => {
    res.sendFile(path.join(__dirname, "../views/hubs.html"));
});
router.get("/gestao", (req, res) => {
    res.sendFile(path.join(__dirname, "../views/gestao.html"));
});
router.get("/entrada", (req, res) => {
    res.sendFile(path.join(__dirname, "../views/entrega.html"));
});
router.get("/transferencia", (req, res) => {
    res.sendFile(path.join(__dirname, "../views/saida.html"));
});
router.get("/pedidos", (req, res) => {
    res.sendFile(path.join(__dirname, "../views/pedidos.html"));
});
router.get("/transporte", (req, res) => {
    res.sendFile(path.join(__dirname, "../views/transporte.html"));
});

module.exports = router;
