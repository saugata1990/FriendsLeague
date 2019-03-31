const express = require('express')
const subscription = express.Router()
const Match = require('../models/match')
const date = require('date-and-time')
const webpush = require('web-push')

webpush.setVapidDetails('mailto:saugata1990@gmail.com', process.env.publicVapidKey, process.env.privateVapidKey)

subscription.post('/', (req, res) => {
    const subscription = req.body
    res.status(201).json({})
    let payload = JSON.stringify({title: 'Friends League', body: 'Here is the notification'})
    const schedule = require('node-schedule')
    let match1 = null, match2 = null
    const now = new Date()
   
    
    // test

    // test scheduling on heroku
    schedule.scheduleJob('52 10 * * *', () => {
        payload = JSON.stringify({title: 'Friends League', body: 'Testing notifications'})
        webpush.sendNotification(subscription, payload).catch(error => console.log(error))
    })

    // might merge the following 2 blocks into one block
    schedule.scheduleJob('30 9 * * *', () => { 
        console.log('Scheduled job is running')
        Match.find().exec()
        .then(matches => {
            match1 = matches.find(match => date.subtract(match.start_time, now).toHours() <= 1
             && date.subtract(match.start_time, now).toHours() >= 0)
            if(match1){
                const message = 
                `Match #${match1.match_no}: ${match1.team1} vs ${match1.team2} is coming up in less than an hour.
                 Have you posted your prediction yet?`
                payload = JSON.stringify({title: 'Friends League', body: message})
                webpush.sendNotification(subscription, payload).catch(error => console.log(error))
            }  
        })         
    })


    schedule.scheduleJob('30 14 * * *', () => { 
        console.log('Scheduled job is running')
        Match.find().exec()
        .then(matches => {
            match2 = matches.find(match => date.subtract(match.start_time, now).toHours() <= 1
             && date.subtract(match.start_time, now).toHours() >= 0)
            if(match2){
                const message = 
                `Match #${match2.match_no}: ${match2.team1} vs ${match2.team2} is coming up in less than an hour.
                 Have you posted your prediction yet?`
                payload = JSON.stringify({title: 'Friends League', body: message})
                webpush.sendNotification(subscription, payload).catch(error => console.log(error))
            }  
        })         
    })
})



module.exports = subscription