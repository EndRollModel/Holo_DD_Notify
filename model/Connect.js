const fetch = require('node-fetch');
const {URLSearchParams} = require('url');
const notifyTokenUrl = 'https://notify-bot.line.me/oauth/token';
const notifyRevokeUrl = 'https://notify-api.line.me/api/revoke';

/**
 * use user code get user notify token
 * @param {String} code
 * @return {Promise<any>}
 */
function notifyGetToken(code, redirect) {
    return new Promise((resolve, reject) => {
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('redirect_uri', redirect);
        params.append('client_id', process.env.notify_client_id);
        params.append('client_secret', process.env.notify_secret);
        fetch(notifyTokenUrl, {method: 'post', body: params})
            .then((res) => res.json())
            .then((json) => {
                console.log(JSON.stringify(json));
                if (json.hasOwnProperty('access_token')) {
                    resolve(json.access_token);
                } else {
                    resolve('');
                }
            })
            .catch((err) => {
                console.log(err);
                resolve('');
            });
    });
}

/**
 * revoke user token
 * @param {String} token
 * @return {Promise<object>}
 */
function notifyRevoke(token) {
    return new Promise((resolve, reject) => {
        fetch(notifyRevokeUrl, {
            method: 'post',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then((res) => res.json())
            .then((json) => {
                switch (json.status) {
                case 200:
                    return resolve({status: 'success'});
                default:
                    return resolve({status: 'fail', message: `${JSON.stringify(json)}`});
                }
            });
    });
}

module.exports = {
    notifyGetToken,
    notifyRevoke,
};
