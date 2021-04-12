process.chdir(__dirname);
const fetch = require('node-fetch');
const needle = require('needle');
const axios = require('axios').default;
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
 * @deprecated
 * twitter official sample
 * @param {number} retryAttempt
 * @return {*}
 */
function streamConnect(retryAttempt) {
    notify.sendServerStatus('server start').then((status) => {
        console.log(`server start : notify send status ${status}`);
    });
    const delayTime = 25000;
    // set countdown check
    let delayfunc = setTimeout(() => {
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
                // if 25 sec not call \r\n = dead (official doc : 20 sec)
                clearTimeout(delayfunc);
                delayfunc = setTimeout(() => {
                    console.log(`I'm Dead`);
                    notify.sendServerStatus(`Hi I'm Dead`).then((status) => {
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
            notify.sendServerStatus(`stream error :ECONNRESET ${error.code}`).then((status) => {
                process.exit(1);
            });
        } else {
            // This reconnection logic will attempt to reconnect when a disconnection is detected.
            // To avoid rate limits, this logic implements exponential backoff, so the wait time
            // will increase if the client cannot reconnect to the stream.
            setTimeout(() => {
                console.log('A connection error occurred. Reconnecting...');
                notify.sendServerStatus('A connection error occurred. Reconnecting...').then((status) => {
                    streamConnect(++retryAttempt);
                });
            }, 2 ** retryAttempt);
        }
    }).on('timeout', (type) => {
        console.log(`timeout: ${type}`);
    });
    return stream;
}

/**
 * Filter stream ( axios ver. )
 * @param {number} count
 */
function streamFConnect(count) {
    // 連線計算方式 count * (5 * 60000)
    // 每次進圈增加五分鐘 最高count : 3 (15min)
    // 第一圈進來為 0 將以五分鐘作為最低標準
    const reconnectTime = count === 0 ? (5 * 60000) : count * (5 * 60000);
    notify.sendServerStatus('start request: ').then(() => {
        console.log('start request : ');
    });
    // check server still alive info
    const checkTime = 25000;
    let delayMessage = setTimeout(() => {
        console.log(`I'm dead !`);
    }, checkTime);
    // 改用axios 可以中斷連線 重複連線請求
    // user axios disconnect / request again
    const CancelToken = axios.CancelToken;
    const source = CancelToken.source();
    axios({
        cancelToken: source.token,
        url: filterUrl,
        method: 'get',
        headers: {
            'User-Agent': 'v2FilterStreamJS',
            'Authorization': token,
        },
        timeout: 20000,
        responseType: 'stream',
    }).then(function (res) {
        console.log(JSON.stringify(res.headers)); // this req header information
        console.log(res.status);
        res.data.on('data', async (data) => {
            // const messageData = Buffer.from(data).toString('utf-8');
            try {
                const json = JSON.parse(data);
                fireDataBase.searchSubItem(json.includes.users[0].username).then((subUser) => {
                    if (subUser.length > 0) {
                        const filterBody = formatFilter(json);
                        subUser.map((data) => {
                            formatMessage(data, filterBody);
                        });
                    }
                });
                console.log(JSON.stringify(json));
            } catch (e) {
                // Keep alive signal received. Do nothing.
                // if 25 sec not call \r\n = dead (official doc : 20 sec)
                clearTimeout(delayMessage);
                delayMessage = setTimeout(() => {
                    notify.sendServerStatus(`Server stop : 'timeout', reconnect time : ${reconnectTime / 1000} sec.`).then((status) => {
                        console.log(`Server stop : 'timeout', reconnect time : ${reconnectTime / 1000} sec.`);
                        source.cancel('timeout');
                        setTimeout(() => {
                            streamFConnect(0);
                        }, reconnectTime);
                    });
                }, checkTime);
                writeAliveLog(`I'm still alive`);
            }
        });
    }).catch(function (err) {
            if (err.response) {
                if (err.response.status === 429) {
                    // maximum allowed connection
                    // `Server Stop Message : This stream is currently at the maximum allowed connection limit.`
                    notify.sendServerStatus(`Server stop : 'maximum', reconnect time ${reconnectTime / 1000} sec.`).then(() => {
                        source.cancel('maximum');
                        console.log(`Server stop : 'maximum', reconnect time ${reconnectTime / 1000} sec.`);
                        if (count < 3) {
                            setTimeout(() => {
                                streamFConnect(++count);
                            }, reconnectTime);
                        } else {
                            setTimeout(() => {
                                streamFConnect(count);
                            }, reconnectTime);
                        }
                    });
                    console.log(`Error : This stream is currently at the maximum allowed connection limit.`);
                } else {
                    err.response.data.on('data', (data) => {
                        const errMsg = Buffer.from(data).toString('utf-8');
                        notify.sendServerStatus(`Server stop : 'other', message : ${errMsg} reconnect time : ${reconnectTime / 1000} sec.`).then(() => {
                            // reconnect
                            console.log(`Server stop : 'other', reconnect time : ${reconnectTime / 1000} sec.`);
                            source.cancel('other');
                            setTimeout(() => {
                                streamFConnect(0);
                            }, reconnectTime);
                        });
                    });
                }
                // console.log(err.response.status);
                // console.log(err.response.headers);
            } else {
                console.log(`axios no response : ${err.toString()}`)
            }
        }
    ).then(() => {
    });
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
    streamFConnect,
};
