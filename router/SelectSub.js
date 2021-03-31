process.chdir(__dirname);
const config = require('../config/Config');
const fireDatabase = require('../controller/FirebaseRTD');
const express = require('express');
const crypto = require('../model/Crypto');
const router = new express.Router();
const bodyParse = require('body-parser');
const jsonParse = bodyParse.json();
router.use(jsonParse);

router.get('/', async (req, res) => {
    // user select head picture page   page name : select
    console.log(`method : get / connect : select / ip : ${req.headers['x-forwarded-for'] || req.connection.remoteAddress}`);
    try {
        res.render('selectLiff', {path: process.env.hostpath});
    } catch (e) {
        console.log(e.toString());
        res.status(404).send();
    }
});

router.post('/', async (req, res) => {
    console.log(`method : post / connect : select / ip : ${req.headers['x-forwarded-for'] || req.connection.remoteAddress}`);
    if (req.body.liffid) {
        const userId = req.body.liffid;
        const selectId = crypto.encryptionAes(userId).replace(/[\/+]/g, '').trim();
        const userInfo = await fireDatabase.searchUser(selectId);
        if (userInfo !== '') {
            const html = res.render('select', {
                title: userId,
                user: userInfo,
                list: config.headPicList,
                path: process.env.hostpath,
            });
            return res.send(html);
        } else {
            return res.status(200).send(`<h1>此帳號尚未綁定 請先綁定</h1>`);
        }
    }
    if (req.body.id) {
        const userId = req.body.id;
        const userInfo = JSON.parse(JSON.stringify(req.body));
        const status = await fireDatabase.updateUserInfo(userId, userInfo);
        if (status.status === 'success') {
            return res.send(`<h1>更新成功！ 請關閉頁面 / update success & close page</h1>`).status(200);
        } else {
            return res.send(`<h1>更新失敗！ 請稍後再嘗試 / update fail & wait sometime try again</h1>`).status(200);
        }
    }
    res.status(404).send();
});

module.exports = router;
