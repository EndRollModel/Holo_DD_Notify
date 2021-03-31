const express = require('express');
const bodyParse = require('body-parser');
const router = new express.Router();
const jsonParse = bodyParse.json();
router.use(jsonParse);

router.post('/', (req, res) => {
    if (req.body.name !== undefined) {
        switch (req.body.name) {
        case 'select':
            res.send({id: process.env.liff_select});
            break;
        case 'binding':
            res.send({id: process.env.liff_bind});
            break;
        default:
            res.send({id: 'unknown'});
            break;
        }
    } else {
        res.status(500).send();
    }
});

module.exports = router;
