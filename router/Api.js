require('dotenv').config();
process.chdir(__dirname);
const express = require('express');
const router = new express.Router();

router.post('/', (req, res) => {
    // you can open some api function in here
    console.log(`method : post / connect : api / ip : ${req.headers['x-forwarded-for'] || req.connection.remoteAddress}`);
    res.status(404);
});

module.exports = router;
