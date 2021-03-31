process.chdir(__dirname);
const fs = require('fs');
const moment = require('moment');
const dirPath = '../log/';
const alivePath = 'aliveLog.json';

// if you want check stream alive status, can open this
const aliveLogSwitch = true;
const maxLine = 300;

/**
 * check dir path
 */
function checkLogDirPath() {
    const logDirCheck = fs.existsSync(dirPath);
    if (!logDirCheck) {
        fs.mkdirSync(dirPath);
    }
}

/**
 * check file path
 * @param {String} path
 */
function checkFilePath(path) {
    checkLogDirPath();
    const logFilePathDir = fs.existsSync(dirPath + path);
    if (!logFilePathDir) {
        fs.writeFileSync(dirPath + path, '[]');
    }
}

/**
 * write alive message
 * @param {String} text
 */
function writeAliveLog(text) {
    if (!aliveLogSwitch) return;
    checkFilePath(alivePath);
    fs.readFile(dirPath + alivePath, (err, data) => {
        let readArray;
        try {
            readArray = JSON.parse(Buffer.from(data).toString('utf-8'));
        } catch (e) {
            readArray = [];
        }
        const aliveText = `${moment().format('YYYY-MM-DD HH:mm:ss')} : ${text}`;
        if (readArray.length >= maxLine) {
            if (readArray.length - maxLine === 0) {
                readArray.shift();
            } else {
                const count = readArray.length - maxLine;
                readArray.splice(0, count + 1);
            }
        }
        readArray.push(aliveText);
        fs.writeFileSync(dirPath + alivePath, JSON.stringify(readArray));
    });
}

module.exports = {
    writeAliveLog,
};
