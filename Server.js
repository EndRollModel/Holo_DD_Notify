require('dotenv').config();
const tweetStream = require('./controller/Stream');
const path = require('path');
const bodyParser = require('body-parser');
const express = require('express');
const notifyRouter = require('./router/LineNotify');
const lineRouter = require('./router/Line');
const apiRouter = require('./router/Api');
const selectRouter = require('./router/SelectSub');
const liffIdRouter = require('./router/Liffid');
const hostPath = process.env.hostpath;
const app = express();
app.use(bodyParser.urlencoded({extended: false}));

// start filter
tweetStream.streamFConnect(0);

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
// resource
app.use(`${hostPath||''}/image`, express.static(__dirname + '/public/image'));
app.use(`${hostPath||''}/js`, express.static(__dirname + '/public/js'));
// router
app.use(`${hostPath||''}/line`, lineRouter);
app.use(`${hostPath||''}/notify`, notifyRouter);
app.use(`${hostPath||''}/select`, selectRouter);
app.use(`${hostPath||''}/getLiffId`, liffIdRouter);
app.use(`${hostPath||''}/apis`, apiRouter);

app.get(`${hostPath||''}/`, (req, res) => {
    console.log(`method : get / ip : ${req.headers['x-forwarded-for'] || req.connection.remoteAddress}`);
    res.status(404).send();
});

// listen port def 3000
const server = app.listen(process.env.PORT || process.env.pport || 3000, () => {
    const port = server.address().port;
    console.log('connect port : ', port);
});
