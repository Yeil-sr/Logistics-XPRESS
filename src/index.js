require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes/routes.js');

const port = 8080; 
const app = express();

const corsOptions = {
  origin: 'http://localhost:8080',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

app.use(express.json());

routes(app);

app.listen(port, () => console.log(`Server running on port ${port}`));

module.exports = app;
