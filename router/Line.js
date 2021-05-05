process.chdir(__dirname);
const express = require('express');
const line = require('@line/bot-sdk');
const crypto = require('../model/Crypto');
const router = new express.Router();
const fireDatabase = require('../controller/FirebaseRTD');
const config = {
    channelAccessToken: process.env.channelAccessToken,
    channelSecret: process.env.channelSecret,
};

const client = new line.Client(config);

router.post('/', line.middleware(config), (req, res) => {
    Promise
        .all(req.body.events.map(handleEvent))
        .then((result) => res.json(result));
});

/**
 * @param {object} event
 * @return {Promise<any>}
 */
async function handleEvent(event) {
    let returnMessage = null;
    switch (event.type) {
    case 'message':
        console.log(event.type);
        console.log(event.message.type);
        if (event.message.type === 'text') {
            returnMessage = await textMessageEvent(event);
        }
        break;
    case 'postback':
        returnMessage = await postbackEvent(event);
        break;
    case 'follow':
        returnMessage = await followEvent(event);
        break;
    }
    if (returnMessage == null) {
        return Promise.resolve(null);
    }
    return client.replyMessage(event.replyToken, returnMessage);
}

/**
 * postback Event
 * @param {object} event
 * @return {Promise<object>}
 */
async function postbackEvent(event) {
    try {
        const data = JSON.parse(event.postback.data);
        const userId = crypto.encryptionAes(event.source.userId).replace(/[\/+]/g, '').trim();
        // const checkAccount = await fireDatabase.searchUser(userId);
        const checkAccount = await fireDatabase.searchLocalUser(userId);
        switch (data.action) {
        case 'revoke':
            if (checkAccount !== '') {
                return {
                    'type': 'text',
                    'text': '確定解除綁定？',
                    'quickReply': {
                        'items': [
                            {
                                'type': 'action',
                                'action': {
                                    'type': 'postback',
                                    'text': 'Yes',
                                    'data': JSON.stringify({action: 'revokeAccount'}),
                                    'label': '是/Yes',
                                },
                            },
                            {
                                'type': 'action',
                                'action': {
                                    'type': 'postback',
                                    'text': 'No',
                                    'data': JSON.stringify({action: 'nope'}),
                                    'label': '否/No',
                                },
                            },
                        ],
                    },
                };
            } else {
                return {
                    'type': 'text',
                    'text': '無帳號資訊！',
                };
            }
        case 'revokeAccount':
            const checkRevoke = await fireDatabase.revokeUserBind(userId);
            if (checkRevoke.status === 'success') {
                return {
                    type: 'text',
                    text: '解除綁定成功 / revoke success',
                };
            } else {
                console.log(checkRevoke.message);
                return {
                    type: 'text',
                    text: `解除綁定失敗 / revoke fail \r\n error msg : ${checkRevoke.info }`,
                };
            }
        }
    } catch (e) {
        console.log(e.toString());
        return Promise.resolve(null);
    }
}

/**
 * @param {object} event
 * @return {Promise<any>}
 */
async function textMessageEvent(event) {
    switch (event.message.text) {
    }
}

/**
 * follow event
 * @param {object} event
 * @return {Promise<object>}
 */
async function followEvent(event) {
    const revokeAction = JSON.stringify({action: 'revoke'});
    return {
        type: 'flex',
        altText: '歡迎你使用HoloLiveDDNotify 請參考以下說明進行操作',
        contents:
            {
                'type': 'bubble',
                'size': 'mega',
                'direction': 'ltr',
                'body': {
                    'type': 'box',
                    'layout': 'vertical',
                    'contents': [
                        {
                            'type': 'box',
                            'layout': 'vertical',
                            'contents': [
                                {
                                    'type': 'text',
                                    'text': '功能選單',
                                    'size': 'md',
                                    'align': 'center',
                                    'weight': 'bold',
                                    'wrap': true,
                                    'contents': [],
                                },
                                {
                                    'type': 'text',
                                    'text': ' ',
                                    'wrap': true,
                                    'contents': [],
                                },
                                {
                                    'type': 'text',
                                    'text': '1. 綁定：',
                                    'size': 'md',
                                    'wrap': true,
                                    'contents': [],
                                },
                                {
                                    'type': 'text',
                                    'text': '指定傳送位置（一次只能綁定一個) 若需改位置 解除綁定可以再綁定',
                                    'size': 'md',
                                    'wrap': true,
                                    'contents': [],
                                },
                                {
                                    'type': 'text',
                                    'text': '2. 訂閱:',
                                    'size': 'md',
                                    'wrap': true,
                                    'contents': [],
                                },
                                {
                                    'type': 'text',
                                    'text': '瀏覽該帳號的訂閱項目與選項 需有綁定帳號',
                                    'size': 'md',
                                    'wrap': true,
                                    'contents': [],
                                },
                                {
                                    'type': 'text',
                                    'text': '3. 解除 :',
                                    'size': 'md',
                                    'wrap': true,
                                    'contents': [],
                                },
                                {
                                    'type': 'text',
                                    'text': '解除與機器人的綁定',
                                    'size': 'md',
                                    'wrap': true,
                                    'contents': [],
                                },
                            ],
                        },
                    ],
                },
                'footer': {
                    'type': 'box',
                    'layout': 'vertical',
                    'contents': [
                        {
                            'type': 'box',
                            'layout': 'vertical',
                            'contents': [
                                {
                                    'type': 'button',
                                    'action': {
                                        'type': 'uri',
                                        'label': '綁定/bind',
                                        'uri': `https://liff.line.me/${process.env.liff_bind}`,
                                    },
                                },
                                {
                                    'type': 'button',
                                    'action': {
                                        'type': 'uri',
                                        'label': '訂閱/sub',
                                        'uri': `https://liff.line.me/${process.env.liff_select}`,
                                    },
                                },
                                {
                                    'type': 'button',
                                    'action': {
                                        'type': 'postback',
                                        'label': '解除/revoke',
                                        'data': revokeAction,
                                    },
                                },
                            ],
                        },
                    ],
                },
                'styles': {
                    'body': {
                        'separator': true,
                    },
                    'footer': {
                        'separator': false,
                    },
                },
            },
    };
}

module.exports = router;
