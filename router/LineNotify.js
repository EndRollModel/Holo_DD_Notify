process.chdir(__dirname);
const fireDatabase = require('../controller/FirebaseRTD');
const connect = require('../model/Connect');
const express = require('express');
const bodyParse = require('body-parser');
const crypto = require('../model/Crypto');
const fireDataBase = require('../controller/FirebaseRTD');
const jsonParse = bodyParse.json();
const router = new express.Router();

router.post('/', async (req, res) => {
    // line notify auth or callback in here
    console.log(`method : post / connect : notify / ip : ${req.headers['x-forwarded-for']||req.connection.remoteAddress}`);
    const code = req.body.code; // token
    const state = req.body.state; // userdata => id @ displayName
    const userId = state.split('@')[0];
    const usertId = userId.replace(/[\/+]/g, '').trim();
    const displayName = decodeURI(state.split('@')[1]);
    const redirectUrl = 'https://' + req.get('host') + (req.originalUrl);
    const notifyToken = await connect.notifyGetToken(code, redirectUrl);
    const addUser = await fireDatabase.addNewUser(usertId, userId, displayName, notifyToken);
    if (addUser.status === 'success') {
        res.render('bind', {message: `綁定成功 請關閉此頁面 / binding success you can close this page`});
    } else {
        res.render('bind', {message: `綁定失敗 / binding fail error msg:${addUser.message}`});
    }
});

router.post('/search-user', jsonParse, async (req, res) => {
    if (req.body.id && req.body.displayName) {
        const fullUrl = 'https://' + req.get('host') + (req.originalUrl).replace('/search-user', '');
        const usertId = crypto.encryptionAes(req.body.id).replace(/[\/+]/g, '').trim();
        const checkId = await fireDataBase.searchUser(usertId);
        if (checkId === '') {
            const username = encodeURI(req.body.displayName);
            const url = `https://notify-bot.line.me/oauth/authorize?response_type=code&client_id=${process.env.notify_client_id}&redirect_uri=${fullUrl}&scope=notify&state=${usertId}@${username}&response_mode=form_post`;
            res.send({status: true, url: url});
        } else {
            res.send({status: false});
        }
    } else {
        res.status(500).send();
    }
});

router.get('/', (req, res) => {
    res.render('bindLiff', {path: process.env.hostpath});
});

module.exports = router;
