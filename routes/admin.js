const bcrypt = require('bcrypt') 
const date = require('date-and-time')
const jwt = require('jsonwebtoken') 
const { verifyToken, create_schedule, rankUsers, evaluate_predicted_score } = require('../utils/middlewares')
const express = require('express')
const admin = express.Router()
const Admin = require('../models/admin')
const User = require('../models/user')
const Match = require('../models/match')
const Team = require('../models/team')
const multer  = require('multer')

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/')
    },
    filename: (req, file, cb) => {
        cb(null, 'roster')
    }
})

const upload = multer({ storage })

const notifier = require('node-notifier')



admin.post('/new', (req, res) => {
    bcrypt.hash(req.body.password, 10)
    .then(hash => {
        new Admin({
            id: req.body.id,
            password_hash: hash
        }).save()
        .then(() => res.redirect('/admin'))
    })
    .catch(error => res.render('error'))
})

admin.get('/', (req, res) => {
    if(!req.cookies.auth){
        res.render('admin_login')
    }
    else{
        res.redirect('/admin/dashboard')
    }
})

admin.post('/login', (req, res) => {
    Admin.findOne({id: req.body.id}).exec()
    .then(admin => {
        if(!admin){
            res.redirect('/admin')
        }
        else{
            bcrypt.compare(req.body.password, admin.password_hash, (err, isValid) => {
                if(isValid){
                    jwt.sign({admin: admin._id}, process.env.admin_secret_key, (err, token) => {
                        res.cookie('auth', token)
                        res.redirect('/admin/dashboard')
                    })
                }
                else{
                    res.status(403).json({message: 'Invalid password'})
                }
            })
        }
    })
    .catch(error => res.render('error'))
})

admin.get('/dashboard', verifyToken(process.env.admin_secret_key), (req, res) => {
    return Promise.all([
        User.find().exec(),
        Match.find().exec(),
        Team.find().exec()
    ])
    .then(([users, all_matches, teams]) => {
        const now = new Date()
        const matches = new Array()
        const squads = new Array()
        const seen = new Array()
        const xl_uploaded = (all_matches.length > 0) ? true : false
        rankUsers(users)
        users.map(user => user.save())
        all_matches.map(match => {
            if(date.subtract(now, match.start_time).toHours() >= 3 && !match.result_updated){  
                matches.push(match)
                if(!seen.includes(match.team1)){
                    const squad1 = teams.find(team => team.name === match.team1)
                    squads.push({name: squad1.name, squad: squad1.squad})
                    seen.push(match.team1)
                }
                if(!seen.includes(match.team2)){
                    const squad2 = teams.find(team => team.name === match.team2)
                    squads.push({name: squad2.name, squad: squad2.squad})
                    seen.push(match.team2)
                }
            }
        })

        res.render('dashboard', {users, matches, teams, squads, xl_uploaded})
    })
    .catch(error => res.render('error'))
})

admin.post('/result/:match_id', verifyToken(process.env.admin_secret_key), (req, res) => {
    return Promise.all([
        Match.findOne({_id: req.params.match_id}).exec(),
        User.find().exec()  
    ])
    .then(([match, users]) => {
        match.winner = req.body.winner
        match.first_inns_score = parseInt(req.body.first_inns_score)
        match.mom = req.body.mom
        match.result_updated = true
        users.forEach(user => {
            let points = 0
            let multiplier = 1
            const prediction = user.predictions.find(pred => pred.match_id == req.params.match_id)
            if(!prediction && date.subtract(match.start_time, user.signup_timestamp).toMinutes() > 0 ){ 
                user.score += parseInt(process.env.no_post_penalty)
            }
            else if(!prediction && date.subtract(match.start_time, user.signup_timestamp).toMinutes() < 0){
                user.score += 0
            }
            else{
                if(prediction.double_used) {
                    multiplier = 2
                } else if(prediction.triple_used) {
                    multiplier = 3
                } else if(prediction.superboost_used) {
                    multiplier = 5
                }
                points += (prediction.winner==match.winner)? parseInt(process.env.winner_correct_points)
                    : parseInt(process.env.winner_incorrect_points)
                if(prediction.mom){
                    points += (prediction.mom==match.mom)? parseInt(process.env.mom_correct_points)
                        : parseInt(process.env.mom_incorrect_points)
                }
                if(prediction.first_inns_score){
                    predicted_score = parseInt(prediction.first_inns_score)
                    points+=evaluate_predicted_score(predicted_score, parseInt(match.first_inns_score))
                }          
                user.score += parseInt(points) * multiplier
            }
            return user
        })
        return Promise.all([
            users.map(user => user.save()),
            match.save()
        ])
        .then(() => res.redirect('/admin/dashboard'))

    })
    .catch(error =>{
        console.log('error ', error)
        res.render('error')
    })
})

admin.post('/bonus-results', verifyToken(process.env.admin_secret_key), (req, res) => {
    User.find().exec()
    .then(users => {
        const playoff_teams = req.body.playoff_teams.sort()
        const winner = req.body.winner
        const orange_cap_winner = req.body.orange_cap_winner
        const purple_cap_winner = req.body.purple_cap_winner
        users.forEach(user => {
            user.competition_finished = true
            let matches_found = 0
            user.bonus_prediction.playoff_teams.sort()
            for(let i=0; i < user.bonus_prediction.playoff_teams.length; i++){
                if(user.bonus_prediction.playoff_teams[i] == playoff_teams[i]){
                    matches_found++
                }
            }
            if(matches_found >= 3){
                user.score += process.env.playoff_teams_correct_points
            }
            if(user.bonus_prediction.orange_cap_winner == orange_cap_winner){
                user.score += process.env.orange_cap_correct_points
            }
            if(user.bonus_prediction.purple_cap_winner == purple_cap_winner){
                user.score += process.env.purple_cap_correct_points
            }
            if(user.bonus_prediction.winner == winner){
                user.score += process.env.champion_correct_points
            }
            return user
        })
        users.map(user => user.save())   
        .then(() => res.redirect('/admin/dashboard'))
    })
    .catch(error => res.render('error'))
})


admin.post('/multipliers', verifyToken(process.env.admin_secret_key), (req, res) => {
    User.find().exec()
    .then(users => {
        return Promise.resolve(
            users.map(user => {
                user.doubles_remaining += req.body.doubles_added? parseInt(req.body.doubles_added) : 0
                user.triples_remaining += req.body.triples_added? parseInt(req.body.triples_added) : 0
                user.superboosts_remaining += req.body.superboosts_added? parseInt(req.body.superboosts_added) : 0
                user.save()
            })
        )
        .then(() => res.redirect('/admin/dashboard'))
        
    })
    .catch(error => res.render('error'))
})


admin.post('/upload-roster',
            verifyToken(process.env.admin_secret_key), 
            upload.single('roster'), 
            create_schedule, (req, res) => {
    notifier.notify({
        title: 'Success!',
        message: 'Roster updated',
        wait: false
    }, (err, response) => { })
    res.redirect('/admin/dashboard')
})


admin.get('/test', (req, res) => {
    const t = evaluate_predicted_score(req.query.predicted, req.query.actual)
    res.send(`<h1>Score: ${t}</h1>`)
})



module.exports = admin