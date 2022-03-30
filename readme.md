#
本專案利用Twitter api 去撈取HoloLive成員發送的推 

並利用Line Notify來傳送至訂閱者 

訂閱者可自由選擇自己所需接收訊息的HoloLive Member

給習慣於Line的使用者可以不用開啟推特看通知

# 
This project is get Hololive members tweets send to lineNotify

you can get favorite waifu tweets on Line app in first time

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
// firebase {option} | if you want use firebase-admin.json . you can rename 'admin.json' in this project root path
DATABASE_URL= firebase database url
PROJECT_ID= firebase admin project_id
PRIVATE_KEY= firebase admin private_key
CLIENT_EMAIL= firebase admin client_email
// other
hostpath= {option} | if you have path (ex: https://www.google.com/'1234') you need write '/1234' in here or not write any thing
// liff
liff_bind= liff bind page id 
liff_select= liff select page id
// server status
server_notify_token= notify token for server status
```

本專案所使用Hololive頭像 版權皆為Cover與Hololive所有 如有侵權請告知 感謝 
