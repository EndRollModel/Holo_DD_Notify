const fs = require('fs');
const admin = require('firebase-admin');
const connect = require('../model/Connect');
const config = require('../config/Config');

// firebase connect setting
if (process.env.PROJECT_ID !== undefined) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.PROJECT_ID,
            privateKey: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
            clientEmail: process.env.CLIENT_EMAIL,
        }),
        databaseURL: process.env.DATABASE_URL,
    });
} else {
    // connect info
    const checkPath = fs.existsSync('../admin.json');
    if (checkPath) {
        const pass = require('../admin.json');
        admin.initializeApp({
            credential: admin.credential.cert(pass),
            databaseURL: process.env.DATABASE_URL,
        });
    } else {
        throw new Error('You need set firebase key');
    }
}

const db = admin.database();
const ref = db.ref('userData');

/**
 * searchUser info
 * @description
 * if search user is fail return ''
 * @param {String} userId
 * @return{Promise<object | ''>}
 */
function searchUser(userId) {
    return new Promise((resolve, reject) => {
        ref.child(userId).once('value', (snapshot) => {
            if (snapshot.val() !== null) {
                resolve(snapshot.val());
            } else {
                resolve('');
            }
        });
    });
}

/**
 * @deprecated
 * set user sub list
 * @description
 * update(use set) user data to firebase rtd
 * @param {String} userId
 * @param {Array} subData
 * @return {Promise<{status: string}>}
 */
function updateUserSub(userId, subData) {
    return new Promise((resolve, reject) => {
        ref.child(`${userId}/sub`).set(subData, (err) => {
            if (err === null) {
                resolve({'status': 'success'});
            } else {
                resolve({'status': 'fail'});
            }
        });
    });
}

/**
 * update user all data
 * @description
 * update(use update) user sub page info
 * @param {String} userId
 * @param {Object} info
 * @return {Promise<{status: string}>}
 */
function updateUserInfo(userId, info) {
    return new Promise((resolve, reject) => {
        ref.child(`${userId}/`).update(info, (err) => {
            if (err === null) {
                resolve({'status': 'success'});
            } else {
                resolve({'status': 'fail'});
            }
        });
    });
}


/**
 * add new user data
 * @description
 * create a new user def data
 * @param {String} usertId
 * @param {String} userId
 * @param {String} displayName
 * @param {String} token
 * @return {Promise<object>}
 */
function addNewUser(usertId, userId, displayName, token) {
    return new Promise((resolve, reject) => {
        const sub = [];
        config.headPicList.map((elem)=>{
            sub.push(elem.username);
        });
        ref.child(`${usertId}`).set({
            displayName: displayName,
            id: userId,
            mute: 'true',
            showUrl: 'false',
            sub: sub,
            token: token,
        }, (err) => {
            if (err === null) {
                resolve({'status': 'success'});
            } else {
                resolve({'status': 'fail', 'message': err});
            }
        });
    });
}

/**
 * searchAll user sub
 * @param {String} tagName
 * @return {Promise<Array>}
 */
function searchSubItem(tagName) {
    return new Promise((resolve, reject) => {
        ref.once('value', (snapshot) => {
            const filter = [];
            Object.keys(snapshot.val()).map((elem) => {
                snapshot.val()[elem].sub.filter((item) => {
                    if (item === tagName) {
                        filter.push({
                            token: snapshot.val()[elem].token,
                            mute: snapshot.val()[elem].mute ? snapshot.val()[elem].mute : 'true',
                            showUrl: snapshot.val()[elem].showUrl ? snapshot.val()[elem].showUrl : 'false',
                        });
                    }
                });
            });
            resolve(filter);
        });
    });
}

/**
 * revoke user binding & remove firebase DATA
 * @param {String} userId
 * @return {Promise<object>}
 */
function revokeUserBind(userId) {
    return new Promise((resolve, reject) => {
        ref.child(userId).once('value', async (snapshot) => {
            // get user data
            const userToken = snapshot.val().token;
            const revokeStatus = await connect.notifyRevoke(userToken);
            if (revokeStatus.status === 'success') {
                await ref.child(userId).remove((err) => {
                    if (err === null) {
                        resolve({status: 'success'});
                    } else {
                        resolve({status: 'fail', info: 'ref remove data fail', message: err.toString()});
                    }
                });
            } else {
                resolve({status: 'fail', info: 'notify revoke fail', message: revokeStatus.message});
            }
        });
    });
}

module.exports = {
    searchUser,
    addNewUser,
    updateUserSub,
    updateUserInfo,
    searchSubItem,
    revokeUserBind,
};

