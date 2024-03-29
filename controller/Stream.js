process.chdir(__dirname);
const fetch = require('node-fetch');
const needle = require('needle');
const axios = require('axios').default;
const {formatMessage} = require('./LineNotify');
const fireDatabase = require('../controller/FirebaseRTD');
const token = `Bearer ${process.env.twitter_auth}`;
const {writeAliveLog} = require('../model/Log');
const rulesUrl = `https://api.twitter.com/2/tweets/search/stream/rules`;
const sampleUrl = `https://api.twitter.com/2/tweets/sample/stream?expansions=attachments.media_keys,author_id&media.fields=url&tweet.fields=entities`;
const filterUrl = `https://api.twitter.com/2/tweets/search/stream?expansions=attachments.media_keys,author_id&media.fields=url&tweet.fields=entities`;
// const filterUrl = `https://api.twitter.com/2/tweets/search/stream?expansions=attachments.media_keys,author_id&media.fields=url&tweet.fields=entities&user.fields=profile_image_url`;
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
                        fireDatabase.searchLocalSubItem(body.includes.users[0].username).then((subUser) => {
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
            fireDatabase.searchLocalSubItem(json.includes.users[0].username).then((subUser) => {
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
 * @param {number} limit
 * @description
 * 斷線機制如下 :
 * 如果為timeout 固定設定分鐘數重新連線
 * 如果為maximum 通常是推特尚未清除上一條異常連線 重新能連線時間不固定
 * 故第一次連線若失敗 則追加一次時間 直到15分鐘內（推特清除連線時間為15分鐘一次間隔）
 */
function streamFConnect(count, limit = 50) {
    // 連線計算方式 count * (60 * 1000)
    // 每次進圈增加一分鐘 最高count : 10 (10min)
    // 第一圈進來為 0 將以一分鐘作為最低標準
    const reconnectTime = count === 0 ? (60 * 1000) : count * (60 * 1000);
    // notify.sendServerStatus('::::: start request :::::').then(() => {
        console.log('::::: start request twitter :::::');
    // });

    // 2021/5 twitter 5min will disconnect loop
    // https://twittercommunity.com/t/filtered-stream-request-breaks-in-5-min-intervals/153926/
    // 遞減增加秒數 0 > 10 * 9 > 20 * 9  > 30 * 9 > 40 * 9
    let limitDef;
    // header次數是否剩餘50 若是limitcount為1 若header剩餘次數為0則為-1 若次數少於50並大於0時 則為(50-次數/10的整數)ˋex: 49-40為4
    let limitCount = limit === 50 ? 1 : limit === 0 ? -1 : Math.floor((50 - limit) / 10 );
    // 計算剩餘次數連線所需秒數 如果剩餘次數為50次 則五秒重新連線 若已經為0次則等待15分鐘 若為0次以上50次以下則為 前者次數 * 2 * 5秒的時間
    // (50-41:0 0秒; 40-31:1 10秒; 30:21:2 20秒; 20:11:3 30秒; 10:1:4; 40秒; 0:15分鐘) 合計1000秒 超過15分鐘(900秒)
    const timeoutRecTime = (limitCount === 0) ? (5 * 1000) : limitCount === -1 ? (15 * 60 * 1000) : limitCount * 2 * (5 * 1000);

    // check server still alive info
    const checkTime = 25 * 1000;
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
        timeout: checkTime,
        responseType: 'stream',
    }).then(function (res) {
        console.log(JSON.stringify(res.headers)); // this req header information
        // console.log(res.status);
        limitDef = res.headers['x-rate-limit-remaining'];
        res.data.on('data', async (data) => {
            // const messageData = Buffer.from(data).toString('utf-8');
            try {
                const json = JSON.parse(data);
                fireDatabase.searchLocalSubItem(json.includes.users[0].username).then((subUser) => {
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
                // https://developer.twitter.com/en/docs/twitter-api/tweets/filtered-stream/integrate/consuming-streaming-data
                clearTimeout(delayMessage);
                delayMessage = setTimeout(() => {
                    // notify.sendServerStatus(`::::: Server stop : 'timeout', reconnect time : ${timeoutRecTime / 1000} sec. :::::`).then((status) => {
                        console.log(`Server stop : 'timeout', reconnect time : ${timeoutRecTime / 1000} sec.`);
                        source.cancel('timeout');
                        setTimeout(() => {
                            streamFConnect(0, limitDef);
                        }, timeoutRecTime);
                    // });
                }, checkTime);
                writeAliveLog(`I'm still alive`);
            }
        });
    }).catch(function (err) {
            if (err.response) {
                if (err.response.status === 429) {
                    // maximum allowed connection
                    // `Server Stop Message : This stream is currently at the maximum allowed connection limit.`
                    notify.sendServerStatus(`::::: Server stop : 'maximum', reconnect time ${reconnectTime / 1000} sec. :::::`).then(() => {
                        source.cancel('maximum');
                        console.log(`::::: Server stop : 'maximum', reconnect time ${reconnectTime / 1000} sec. :::::`);
                        if (count < 10) {
                            setTimeout(() => {
                                streamFConnect(++count, limitDef);
                            }, reconnectTime);
                        } else {
                            setTimeout(() => {
                                streamFConnect(count, limitDef);
                            }, reconnectTime);
                        }
                    });
                    console.log(`Error : This stream is currently at the maximum allowed connection limit.`);
                } else {
                    err.response.data.on('data', (data) => {
                        const errMsg = Buffer.from(data).toString('utf-8');
                        notify.sendServerStatus(`::::: Server stop : 'other', message : ${errMsg} reconnect time : ${reconnectTime / 1000} sec. :::::`).then(() => {
                            // reconnect
                            console.log(`Server stop : 'other', reconnect time : ${reconnectTime / 1000} sec.`);
                            source.cancel('other');
                            setTimeout(() => {
                                streamFConnect(0, limitDef);
                            }, reconnectTime);
                        });
                    });
                }
                // console.log(err.response.status);
                // console.log(err.response.headers);
            } else {
                console.log(`::::: Server stop : 'axios no response', message : ${err.toString()}, reconnect time : ${reconnectTime / 1000} sec. :::::`);
                source.cancel('axios no response')
                setTimeout(() => {
                    streamFConnect(0, limitDef);
                }, reconnectTime);
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
