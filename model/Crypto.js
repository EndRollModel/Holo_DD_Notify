require('dotenv').config();
const Crypto = require('crypto');

/**
 * aes decode function
 * @param  {string} decodeData
 * @return {string} string
 * @return {null}   null
 */
function decryptionAes(decodeData) {
    decodeData = Buffer.from(decodeData, 'base64').toString('binary');
    const decipher = Crypto.createDecipheriv('aes-256-cbc', process.env.aeskey, process.env.aesiv);
    let decoded = decipher.update(decodeData, 'binary', 'utf8');
    decoded += decipher.final('utf8');
    return decoded;
}

/**
 * aes encrcode function
 * @param   {string}  encryptedData
 * @return  {string}  crypted
 * @return  {null}    null
 */
function encryptionAes(encryptedData) {
    try {
        const cipher = Crypto.createCipheriv('aes-256-cbc', process.env.aeskey, process.env.aesiv);
        let crypted = cipher.update(encryptedData, 'utf8', 'binary');
        crypted += cipher.final('binary');
        crypted = Buffer.from(crypted, 'binary').toString('base64');
        return crypted;
    } catch (error) {
        return null;
    }
}

module.exports = {
    encryptionAes,
    decryptionAes,
};
