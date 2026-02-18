const express = require('express')
const router = express.Router();
const path = require('path')

router.get('/',(req,res)=>{
    res.sendFile(path.join(__dirname, "../views/login.html"));
})

router.get('/gerar/mdf-e', (req,res)=>{
    res.sendFile(path.join(__dirname, "../views/mdf-e.html"))
})

router.get('/gerar/nf-e',(req,res)=>{
    res.sendFile(path.join(__dirname, "../views/nf-e.html"))
})

module.exports = router