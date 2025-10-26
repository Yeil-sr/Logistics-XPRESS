const path = require('path');
const bodyParser = require('body-parser');
const express = require('express');

const clientes = require('./clientes');
const coletas = require('./coletas');
const conferencias = require('./conferencias');
const dashboard = require('./dashboard');
const enderecos = require('./enderecos');
const estoques = require('./estoques');
const expedicao = require('./expedicao');
const excecao = require('./excecao');
const hubs = require('./hubs');
const motoristas = require('./motoristas');
const paradas = require('./paradas');
const pedidos = require('./pedidos');
const produtos = require('./produtos');
const rastreamento = require('./rastreamento');
const recebimento = require('./recebimento');
const rotas = require('./rotas');
const separacao = require('./separacoes');
const transferencia = require('./transferencias');
const transporte = require('./transporte');
const usuarios = require('./usuarios');
const indexRouter = require('./indexRouter');

const authenticateToken = require('../authMiddleware/authMiddleware');

module.exports = app => {
  const public = path.join(__dirname, '..', 'public');
  const views = path.join(__dirname, '..', 'views');

  app.use('/public', express.static(public));
  app.use(express.static(public));
  app.use(express.static(views));

  app.use(bodyParser.json());

  app.use('/', indexRouter); 
  app.use('/dashboard', dashboard);

  app.use(authenticateToken);

  app.use('/clientes', clientes);
  app.use('/coletas', coletas);
  app.use('/conferencias', conferencias);
  app.use('/enderecos', enderecos);
  app.use('/estoques', estoques);
  app.use('/excecoes', excecao);
  app.use('/hubs', hubs);
  app.use('/motoristas', motoristas);
  app.use('/paradas', paradas);
  app.use('/pedidos', pedidos);
  app.use('/produtos', produtos);
  app.use('/rastreamento', rastreamento);
  app.use('/recebimentos', recebimento);
  app.use('/rotas', rotas);
  app.use('/separacoes', separacao);
  app.use('/transferencias', transferencia);
  app.use('/transportes', transporte);
  app.use('/usuarios', usuarios);

  app.use((req, res) => {
    res.status(404).sendFile(path.join(views, '404.html'));
  });
};