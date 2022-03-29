process.chdir(__dirname);
const axios = require('axios');
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
            param.append('message', `\n〖${data.name}〗：\n${data.text}\n《 https://twitter.com/hololive/status/${data.tweetsId} 》`);
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
                param.append('message', `\n〖${data.name}〗：\n${data.text}\n《 https://twitter.com/hololive/status/${data.tweetsId} 》`);
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
    axios.post(notifyUrl, body.toString(), {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
        .then((res) => {
            const data = res.data;
            if (data.status !== 200) {
                console.log(`::::: User token : ${token} , status : ${JSON.stringify(res)} :::::`);
            }
        }).catch((e) => {
        console.log(e)
    })
}

/**
 * send message to server notify
 * @param {String} message
 * @return {Promise<String>}
 */
function sendServerStatus(message) {
    const param = new URLSearchParams();
    param.append('message', message);
    param.append('notificationDisabled', 'true');
    return new Promise((resolve, reject) => {
        axios.post(notifyUrl, param.toString(), {
            headers: {
                'Authorization': `Bearer ${process.env.server_notify_token}`,
            }
        }).then((res) => {
            const data = res.data;
            if (res.status !== 200) {
                console.log(`notify send fail : ${JSON.stringify(data)}`);
                resolve(false);
            } else {
                resolve(true);
            }
        }).catch((e) => {
            console.log(e)
        })
    })
}

module.exports = {
    formatMessage,
    sendServerStatus,
};
