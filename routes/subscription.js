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
    const now = new Date()
    const timeslots = ['30 9 * * *', '30 14 * * *']
    // const timeslots = ['58 11 * * *', '59 11 * * *']
    timeslots.map(slot => {
        schedule.scheduleJob(slot, () => {  
            console.log('*********Scheduled job is running***********')
            Match.find().exec()
            .then(matches => {
                const match = matches.find(match => date.subtract(match.start_time, now).toHours() <= 1
                 && date.subtract(match.start_time, now).toHours() >= 0)
                if(match){
                    console.log(`*******Found Match ${match}*********`)
                    const message = 
                    `Match #${match.match_no}: ${match.team1} vs ${match.team2} is coming up in less than an hour. Have you posted your prediction yet?`
                    payload = JSON.stringify({title: 'Friends League', body: message})
                    webpush.sendNotification(subscription, payload).catch(error => console.log(error))
                } 
                // this part is for testing in production, and will be removed
                else{
                    console.log('********No match found**********')
                } 
            })         
        })
    })
})



module.exports = subscription