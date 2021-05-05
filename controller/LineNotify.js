process.chdir(__dirname);
const fetch = require('node-fetch');
const {URLSearchParams} = require('url');
const notifyUrl = 'https://notify-api.line.me/api/notify';

/**
 * format message
 * @param {object}  userData
 * @param {object}  data
 */
function formatMessage(userData, data) {
    const messageList = [];
    if (data.image.length === 0) {
        // 純文字訊息
        const param = new URLSearchParams();
        if (userData.showUrl === 'true') {
            param.append('message', `\n〖${data.name}〗：\n${data.text}\n《 https://twitter.com/hololive/status/${data.tweetsId} 》` );
        } else {
            param.append('message', `\n〖${data.name}〗：\n${data.text}`);
        }
        param.append('notificationDisabled', userData.mute ? 'true' : 'false');
        messageList.push(param);
    } else {
        // 多圖訊息
        data.image.forEach((elem) => {
            const param = new URLSearchParams();
            if (userData.showUrl === 'true') {
                param.append('message', `\n〖${data.name}〗：\n${data.text}\n《 https://twitter.com/hololive/status/${data.tweetsId} 》` );
            } else {
                param.append('message', `\n〖${data.name}〗：\n${data.text}`);
            }
            param.append('notificationDisabled', userData.mute ? 'true' : 'false');
            param.append('imageThumbnail', elem);
            param.append('imageFullsize', elem);
            messageList.push(param);
        });
    }
    messageList.map((elem) => {
        sendNotifyMessage(userData.token, elem);
    });
}

/**
 * send message
 * @param {String} token
 * @param {object} body
 */
function sendNotifyMessage(token, body) {
    fetch(notifyUrl, {
        method: 'post',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${token}`,
        },
        body: body,
    })
        .then((res) => res.json())
        .then((json) => {
            if (json.status !== 200) {
                console.log(`::::: User token : ${token} , status : ${JSON.stringify(json)} :::::`);
            }
        });
}

/**
 * send message to server notify
 * @param {String} message
 * @return {Promise<String>}
 */
function sendServerStatus(message) {
    const param = new URLSearchParams();
    param.append('message', message);
    return new Promise((resolve, reject) => {
        fetch(notifyUrl, {
            method: 'post',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Bearer ${process.env.server_notify_token}`,
            },
            body: param,
        })
            .then((res)=>res.json())
            .then((json)=>{
                if(json.status !== 200){
                    console.log(`notify send fail : ${JSON.stringify(json)}`);
                    resolve(false);
                }else {
                    resolve(true);
                }
            })
    })
}

module.exports = {
    formatMessage,
    sendServerStatus,
};
