#
<h4> I want to be a DD King (x </h4>

<h4> 目前為測試階段 </h4>
<h5> <s> I Eng is so bad / 內容破英文注意!</s></h5>

#
How to Build       

You need account 

1. [Twitter dev](https://developer.twitter.com/en)
2. [Line Notify](https://notify-bot.line.me/en/)
3. [Line dev](https://developers.line.biz/en/)
4. [Firebase](https://firebase.google.com/)

create .env file
```
// twitter
twitter_auth = twitter api 2.0 Bearer token 
// line notify client       
notify_client_id= line notify client id 
notify_secret= line notify secret 
// line message
channelAccessToken= line message api token 
channelSecret= line message api token
// crypto
aeskey= you custom aeskey (32char)
aesiv= you custom aesiv (16char)
// firebase {option} | if you want use firebase-admin.json . you can rename 'admin.json' 
DATABASE_URL= firebase database url
PROJECT_ID= firebase admin project_id
PRIVATE_KEY= firebase admin private_key
CLIENT_EMAIL= firebase admin client_email
// other
hostpath= {option} | if you have path (ex: https://www.google.com/'1234') you need write '/1234' in here
// liff
liff_bind= liff bind page id 
liff_select= liff select page id
// server status
server_notify_token= notify token for server status
```
