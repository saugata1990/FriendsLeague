const jwt = require('jsonwebtoken') 
const Team = require('../models/team')
const Match = require('../models/match')
const readXlsxFile = require('read-excel-file/node')
const date = require('date-and-time')
const webpush = require('web-push')
webpush.setVapidDetails('mailto:saugata1990@gmail.com', process.env.publicVapidKey, process.env.privateVapidKey)





const isLoggedIn = (req, res, next) => {
    if(req.isAuthenticated()){
        next();
    }
    else{
        res.render('error', {user: 'player'})
    }
}

const verifyToken = (key) => {
    return (req, res, next) => {
        const auth = req.cookies.auth
        if(!auth){
            res.redirect('/admin')
        }
        else{
            jwt.verify(auth, key, (err, authData) => {
                if(err){
                    res.redirect('/admin')
                }
                else{
                    req.authData = authData
                }
                next()
            })    
        }
    }
}


const create_schedule = (req, res, next) => {
    return Promise.all([
        readXlsxFile('./uploads/roster', {sheet: 1}),
        readXlsxFile('./uploads/roster', {sheet: 2})
    ])
    .then(([teams_rows, schedule_rows]) => {
        teams_rows.map(row => {
            row = row.filter(player => player != null)
            Team.findOne({name: row[0]}).exec()
            .then(team => {
                if(!team){
                    team = new Team({
                        name: row[0],
                        squad: row.slice(1,row.length)
                    })
                }
                else{
                    team.squad = row.slice(1,row.length)
                }
                team.save().then(() => {})
            })
        })
        schedule_rows.splice(0,1)
        schedule_rows.map(row => {
            const start_time = new Date(date.parse(`${row[1]} ${row[2]}`, 'YYYY/MM/DD HH:mm'))
            Match.findOne({match_no: parseInt(row[0]), team1: row[3], team2: row[4]}).exec()
            .then(match => {
                if(!match){
                    new Match({
                        match_no: parseInt(row[0]),
                        start_time: new Date(start_time - 330*60000),
                        start_time_display: start_time,
                        team1: row[3],
                        team2: row[4] 
                    }).save()
                }
            })
        })

        next()
    })
    .catch(error => {
        console.log('ERROR ', error)
        res.render('error', {user: 'admin'})
    })
}


const rankUsers = users => {
    users.sort((u1, u2) => u2.score - u1.score)
    let rank = 0
    let last_score = null
    let numUsersWithSameRank = 0
    users.forEach(user => {   
        if(user.score == last_score){
            user.rank = rank
            numUsersWithSameRank++
        }
        else{
            user.rank = ++rank + numUsersWithSameRank  
            rank = user.rank
            numUsersWithSameRank = 0
        }
        last_score = user.score
    })
}


const evaluate_predicted_score_v0 = (predicted_score, actual_score) => {
    const bonus = (predicted_score === actual_score)? parseInt(process.env.score_match_bonus) : 0
    return parseInt(process.env.score_prediction_points - Math.max(Math.round(0.1 * (Math.abs(predicted_score - actual_score))) + bonus), -5)
}

const evaluate_predicted_score = (predicted_score, actual_score) => {
    const diff = parseInt(Math.abs(predicted_score - actual_score))
    if(predicted_score === actual_score){
        return 10
    } else if(diff<=5){
        return 5
    } else if(diff<=20){
        return 3
    } else if(diff<=30){
        return 1
    } else if(diff<=50){
        return 0
    } else {
        const penalty = -(diff - 50) / 10
        return parseInt(Math.max(penalty, -5))
    }
    
}


const schedule_notifications = (subscription) => {
    let payload = JSON.stringify({title: 'Friends League', body: 'Hello from Friends League'})
    const schedule = require('node-schedule')
    const now = new Date()
    const timeslots = ['30 8 * * *', '30 11 * * *']
    
    timeslots.map(slot => {
        schedule.scheduleJob(slot, () => {  
            Match.find().exec()
            .then(matches => {
                const match = matches.find(match => date.subtract(match.start_time, now).toHours() <= 1
                 && date.subtract(match.start_time, now).toHours() >= 0)
                if(match){
                    const message = 
                    `Match #${match.match_no}: ${match.team1} vs ${match.team2} is scheduled to begin 
                     shortly. Have you posted your prediction yet?`
                    payload = JSON.stringify({title: 'WCPL', body: message})
                    webpush.sendNotification(subscription, payload).catch(error => console.log(error))
                } 
            })         
        })
    })
}


module.exports = { isLoggedIn, verifyToken, rankUsers, evaluate_predicted_score, create_schedule, schedule_notifications }