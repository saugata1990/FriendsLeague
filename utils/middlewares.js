const jwt = require('jsonwebtoken') 
const Team = require('../models/team')
const Match = require('../models/match')
const readXlsxFile = require('read-excel-file/node')
const date = require('date-and-time')


const isLoggedIn = (req, res, next) => {
    if(req.isAuthenticated()){
        next();
    }
    else{
        res.render('error')
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
            const dt = date.parse(`${row[0]} ${row[1]}`, 'YYYY/MM/DD HH:mm')
            const start_time = new Date(`${dt} GMT+0530`)
            Match.findOne({start_time, team1: row[2], team2: row[3]}).exec()
            .then(match => {
                if(!match){
                    new Match({
                        start_time,
                        team1: row[2],
                        team2: row[3]
                    }).save()
                }
            })
        })

        next()
    })
    .catch(error => res.status(500).json({error}))
}


const rankUsers = (users) => {
    const scores = new Set(Object.keys(users).map(key => users[key].score))
    const ordered_scores = Array.from(scores).sort((a, b) => b-a)
    users.forEach(user => {
        user.rank = ordered_scores.indexOf(user.score) + 1
        return user
    })
    users.sort((user1, user2) => user1.rank - user2.rank)

}

const evaluate_predicted_score = (predicted_score, actual_score) => {
    const bonus = (predicted_score === actual_score)? parseInt(process.env.score_match_bonus) : 0
    return parseInt(process.env.score_prediction_points - Math.round(0.05 * (Math.abs(predicted_score - actual_score))) + bonus)
}




module.exports = { isLoggedIn, verifyToken, rankUsers, evaluate_predicted_score, create_schedule }