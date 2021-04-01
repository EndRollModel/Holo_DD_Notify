process.chdir(__dirname);
const fetch = require('node-fetch');
const needle = require('needle');
const {formatMessage} = require('./LineNotify');
const fireDataBase = require('../controller/FirebaseRTD');
const token = `Bearer ${process.env.twitter_auth}`;
const {writeAliveLog} = require('../model/Log');
const rulesUrl = `https://api.twitter.com/2/tweets/search/stream/rules`;
const sampleUrl = `https://api.twitter.com/2/tweets/sample/stream?expansions=attachments.media_keys,author_id&media.fields=url&tweet.fields=entities`;
const filterUrl = `https://api.twitter.com/2/tweets/search/stream?expansions=attachments.media_keys,author_id&media.fields=url&tweet.fields=entities`;
const notify = require('../controller/LineNotify');

/**
 * @description
 * get twitter 1% tweets
 * (test function)
 * @param {String} query
 */
function startSampleStream(query = null) {
    fetch(sampleUrl, {
        headers: {
            Authorization: token,
        },
        timeout: 15000,
    })
        .then((res) => {
            res.body.on('data', (data) => {
                try {
                    const formatBody = Buffer.from(data).toString('utf-8');
                    if (formatBody !== '\r\n') {
                        const body = JSON.parse(formatBody);
                        if (query != null && Array.isArray(query)) {
                            query.map((elem) => {
                                if (body.data.text.indexOf(elem) > -1) {
                                    const filterBody = formatFilter(elem);
                                    console.log(JSON.stringify(filterBody));
                                }
                            });
                        } else {
                            const filterBody = formatFilter(body);
                            console.log(JSON.stringify(filterBody));
                        }
                    }
                } catch (e) {
                    console.log(e.toString());
                    console.log(Buffer.from(data).toString('utf-8'));
                }
            },
            );
        });
}

/**
 * @description
 * filter tweet data
 */
function startFilterStream() {
    fetch(filterUrl, {
        headers: {
            Authorization: token,
        },
        timeout: 15000,
    }).then((res) => {
        res.body.on('data', (data) => {
            try {
                const formatBody = Buffer.from(data).toString('utf-8');
                if (formatBody !== '\r\n') { // 固定會傳換行符號
                    const body = JSON.parse(formatBody);
                    console.log(JSON.stringify(body));
                    fireDataBase.searchSubItem(body.includes.users[0].username).then((subUser) => {
                        if (subUser.length > 0) {
                            const filterBody = formatFilter(body);
                            subUser.map((token) => {
                                formatMessage(token, filterBody);
                            });
                        }
                    });
                }
            } catch (e) {
                console.log(e.toString());
                console.log(Buffer.from(data).toString('utf-8'));
            }
        },
        );
    });
}

/**
 * twitter official sample
 * @param {number} retryAttempt
 * @return {*}
 */
function streamConnect(retryAttempt) {
    console.log('start stream :');
    const delayTime = 25000;
    // set countdown check
    let delayfunc = setTimeout(()=>{
        console.log(`I'm dead !`);
    }, delayTime);

    const stream = needle.get(filterUrl, {
        headers: {
            'User-Agent': 'v2FilterStreamJS',
            'Authorization': token,
        },
        timeout: 20000,
    });
    stream.on('data', async (data) => {
        try {
            const json = JSON.parse(data);
            console.log(JSON.stringify(json));
            // A successful connection resets retry count.
            retryAttempt = 0;
            fireDataBase.searchSubItem(json.includes.users[0].username).then((subUser) => {
                if (subUser.length > 0) {
                    const filterBody = formatFilter(json);
                    subUser.map((data) => {
                        formatMessage(data, filterBody);
                    });
                }
            });
        } catch (e) {
            if (data.detail === 'This stream is currently at the maximum allowed connection limit.') {
                // maximum allowed connection
                console.log(`Error : ${data.detail}`);
                await notify.sendServerStatus(`Server Stop Message : This stream is currently at the maximum allowed connection limit.`);
                process.exit(1);
            } else if (data.hasOwnProperty('errors')) {
                // has error message
                try {
                    const dataMsg = JSON.stringify(data);
                    await notify.sendServerStatus(`Server Stop Message : ${dataMsg}`);
                } catch (e) {
                    await notify.sendServerStatus(`Server Stop Message : ${data}`);
                }
                process.exit(1);
            } else {
                // Keep alive signal received. Do nothing.
                clearTimeout(delayfunc);
                delayfunc = setTimeout(()=>{
                    console.log(`I'm Dead ( 25 second not any call this )`);
                    notify.sendServerStatus(`I'm Dead ( 25 second not any call this )`).then((status)=>{
                        process.exit(2);
                    });
                }, delayTime);
                writeAliveLog(`I'm still alive`);
            }
        }
    }).on('header', (status, header) => {
        console.log(`headers : status = ${status} , header = ${JSON.stringify(header)}`);
    }).on('err', (error) => {
        if (error.code !== 'ECONNRESET') {
            console.log(`stream error :ECONNRESET ${error.code}`);
            notify.sendServerStatus(`stream error :ECONNRESET ${error.code}`).then((status)=>{
                process.exit(1);
            });
        } else {
            // This reconnection logic will attempt to reconnect when a disconnection is detected.
            // To avoid rate limits, this logic implements exponential backoff, so the wait time
            // will increase if the client cannot reconnect to the stream.
            setTimeout(() => {
                console.log('A connection error occurred. Reconnecting...');
                notify.sendServerStatus('A connection error occurred. Reconnecting...').then((status)=>{
                    streamConnect(++retryAttempt);
                });
            }, 2 ** retryAttempt);
        }
    });
    return stream;
}


/**
 * Filter data Format
 * @param {Object} data
 * @return {{}}
 * @example
 * object info :
 * {
 *     username : twitter ID,
 *     name : twitter name,
 *     image : [], // if media type == 'photo'
 * }
 */
function formatFilter(data) {
    const filterBody = {};
    filterBody.username = data.includes.users[0].username;
    filterBody.name = data.includes.users[0].name;
    filterBody.tweetsId = data.data.id;
    filterBody.text = data.data.text;
    filterBody.image = [];
    if (data.includes.hasOwnProperty('media')) { // 如果有媒體內容
        data.includes.media.forEach((image) => {
            if (image.type === 'photo') {
                filterBody.image.push(image.url);
            }
        });
    }
    return filterBody;
}

/**
 * rules add / delete
 * @param {Object} rules
 * @description
 * https://developer.twitter.com/en/docs/twitter-api/tweets/filtered-stream/api-reference/post-tweets-search-stream-rules
 * @example
 * add :
 * { "add" : [{"value": "cat has:media", "tag": "cats with media"}]}
 * delete :
 * { "delete" : [{"ids": 123456789}]}
 */
async function rulesADs(rules) {
    return new Promise((resolve, reject) => {
        fetch(rulesUrl, {
            method: 'post',
            headers: {
                'Content-type': 'application/json',
                'Authorization': token,
            },
            timeout: 5000,
            body: JSON.stringify(rules),
        }).then((res) => {
            res.body.on('data', (data) => {
                const rules = Buffer.from(data).toString('utf-8');
                resolve(rules);
            });
        });
    });
}

/**
 * Browse rules info
 * @description
 * https://developer.twitter.com/en/docs/twitter-api/tweets/filtered-stream/api-reference/get-tweets-search-stream-rules
 * @return {Promise<String>}
 */
async function rulesInfo() {
    return new Promise((resolve, reject) => {
        fetch(rulesUrl, {
            headers: {
                Authorization: token,
            },
            timeout: 5000,
        }).then((res) => {
            res.body.on('data', (data) => {
                const rules = Buffer.from(data).toString('utf-8');
                resolve(rules);
            });
        });
    });
}

module.exports = {
    rulesInfo,
    rulesADs,
    startSampleStream,
    startFilterStream,
    streamConnect,
};
