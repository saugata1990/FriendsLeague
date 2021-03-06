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
const Flag = require('../models/flag')
const multer  = require('multer')
const fs = require('fs')
const path = require('path')

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/')
    },
    filename: (req, file, cb) => {
        cb(null, path.parse(file.originalname).name)
    }
})


const upload = multer({ storage })


admin.post('/new', (req, res) => {
    bcrypt.hash(req.body.password, 10)
    .then(hash => {
        new Admin({
            id: req.body.id,
            password_hash: hash
        }).save()
        .then(() => res.redirect('/admin'))
    })
    .catch(error => {
        console.log('the error is ', error)
        res.render('error', {user: 'admin'})
    })
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
    .catch(error => res.render('error', {user: 'admin'}))
})


// hacky method
admin.get('/change-password/:id', (req, res) => {
    return Promise.all([
        Admin.findOne({id}).exec(),
        bcrypt.hash(req.query.password, 10)
    ])
    .then(([admin, hash]) => {
        admin.password_hash = hash
        admin.save()
        .then(() => res.send('The password was changed'))
    })
    .catch(error => {
        console.log('error is ', error)
        res.send(error)
    })
})

// future plan
admin.post('/change-password', verifyToken(process.env.admin_secret_key), (req, res) => {
    return Promise.all([
        Admin.findOne({_id: req.authData.admin}).exec(),
        bcrypt.hash(req.body.password, 10)
    ])
    .then(([admin, hash]) => {
        admin.password_hash = hash
        admin.save()
        .then(() => res.redirect('/admin/dashboard'))
    })
    .catch(error => {
        console.log('error is ', error)
        res.render('error', {user: 'admin'})
    })
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
                    squad1.squad.sort()
                    squads.push(squad1)
                    seen.push(match.team1)
                }
                if(!seen.includes(match.team2)){
                    const squad2 = teams.find(team => team.name === match.team2)
                    squad2.squad.sort()
                    squads.push(squad2)
                    seen.push(match.team2)
                }
            }
        })

        res.render('dashboard', {users, matches, teams, squads, xl_uploaded})
    })
    .catch(error => {
        console.log('error is ', error)
        res.render('error', {user: 'admin'})
    })
})

admin.post('/result/:match_id', verifyToken(process.env.admin_secret_key), (req, res) => {
    return Promise.all([
        Match.findOne({_id: req.params.match_id}).exec(),
        User.find().exec()  
    ])
    .then(([match, users]) => {
        match.winner = req.body.winner
        match.first_inns_score = req.body.first_inns_score? parseInt(req.body.first_inns_score) : null
        match.mom = req.body.mom
        match.result_updated = true
        users.forEach(user => {
            let points = 0
            let multiplier = 1
            const prediction = user.predictions.find(pred => pred.match_id == req.params.match_id)
            // if(prediction){
            //     prediction.actual_winner = match.winner
            //     prediction.actual_mom = match.mom
            //     prediction.actual_first_inns_score = match.first_inns_score
            // }
            if(match.winner === 'No Result'){
                if(prediction){
                    if(prediction.double_used){
                        user.doubles_remaining++
                    } else if(prediction.triple_used){
                        user.triples_remaining++
                    } else if(prediction.superboost_used){
                        user.superboosts_remaining++
                    }
                } 
            }
            else if(!prediction && date.subtract(match.start_time, user.signup_timestamp).toMinutes() > 0 ){ 
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
                if(prediction.first_inns_score && match.winner != 'No Result'){
                    predicted_score = parseInt(prediction.first_inns_score)
                    points+=evaluate_predicted_score(predicted_score, parseInt(match.first_inns_score))
                }          
                user.score += parseInt(points) * multiplier
                // const index = user.predictions.findIndex(prd => prd.match_id == prediction.match_id)
                // user.predictions[index] = prediction 
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
        res.render('error', {user: 'admin'})
    })
})

admin.post('/bonus-results', verifyToken(process.env.admin_secret_key), (req, res) => {
    User.find().exec()
    .then(users => {
        const sf_teams = req.body.sf_teams.sort()
        const winner = req.body.winner
        const motm = req.body.motm
        const highest_run_scorer = req.body.highest_run_scorer
        const highest_wicket_taker = req.body.highest_wicket_taker
        users.forEach(user => {
            user.competition_finished = true
            let matches_found = 0
            if(user.bonus_prediction){
                if(user.bonus_prediction.sf_teams.length > 0){
                    user.bonus_prediction.sf_teams.sort()
    
                    for(let i=0; i < user.bonus_prediction.sf_teams.length; i++){
                        if(user.bonus_prediction.sf_teams[i] == sf_teams[i]){
                            matches_found++
                        }
                    }
                }
                if(matches_found >= 3){
                    user.score += parseInt(process.env.sf_teams_correct_points)
                }
                if(user.bonus_prediction.motm == motm){
                    user.score += parseInt(process.env.motm_correct_points)
                }
                if(user.bonus_prediction.highest_run_scorer == highest_run_scorer){
                    user.score += parseInt(process.env.highest_run_scorer_correct_points)
                }
                if(user.bonus_prediction.highest_wicket_taker == highest_wicket_taker){
                    user.score += parseInt(process.env.highest_wicket_taker_correct_points)
                }
                if(user.bonus_prediction.winning_team == winner){
                    user.score += parseInt(process.env.champion_correct_points)
                }
            }    
            return user
        })
        return Promise.all([users.map(user => user.save())]) 
        .then(() => res.redirect('/admin/dashboard'))
    })
    .catch(error => res.render('error', {user: 'admin'}))
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
    .catch(error => res.render('error', {user: 'admin'}))
})


admin.post('/upload-roster',
            verifyToken(process.env.admin_secret_key), 
            upload.single('roster'), 
            create_schedule, (req, res) => {
    res.redirect('/admin/dashboard')
})


admin.post('/upload-flags', upload.array('flags', 10), (req, res) => { // verifyToken(process.env.admin_secret_key),
    return Promise.all([
        Team.find().exec(),
    ])
    .then(([teams]) => {
        return Promise.resolve(
            teams.map(team => {
                let flagfile = req.files.find(file => file.filename.toLowerCase() === team.name.toLowerCase())
                new Flag({
                    team_name: team.name.toLowerCase(),
                    flag: {data: fs.readFileSync(flagfile.path).toString('base64'), contentType: 'image/jpg'}
                }).save()
            })
        )
        .then(() => res.redirect('/admin/dashboard'))
    })
    .catch(error => res.render('error', {user: 'admin'}))
})




module.exports = admin