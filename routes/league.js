const express = require('express')
const league = express.Router()
const date = require('date-and-time')
const Team = require('../models/team')
const Match = require('../models/match')
const User = require('../models/user')
const { isLoggedIn } = require('../utils/middlewares')



league.get('/matches', isLoggedIn, (req, res) => {
    return Promise.all([
        Match.find().exec(),
        Team.find().exec(),
        User.findOne({user_id: req.user.user_id}).exec()
    ])
    .then(([all_matches, teams, profile]) => {
        const now = new Date()
        const matches = new Array()
        const user = profile
        const squads = new Array()
        const seen = new Array()
        let firstMatchStarted = false
        if(all_matches.length > 0){
            if(date.subtract(all_matches[0].start_time, now).toMinutes() < 0){
                firstMatchStarted = true
            }
        }
        
        all_matches.map(match => {
            if(date.subtract(match.start_time, now).toMinutes() > 0 &&
             date.subtract(match.start_time, now).toDays() <= 2){
                matches.push(match)
                if(!seen.includes(match.team1)){
                    const squad1 = teams.find(team => team.name === match.team1)
                    squads.push({name: squad1.name, squad: squad1.squad})
                    seen.push(match.team1)
                }
                if(!seen.includes(match.team2)){
                    const squad2 = teams.find(team => team.name === match.team2)
                    squads.push({name: squad2.name, squad: squad2.squad}) // or simply squads.push(squad2)
                    seen.push(match.team2)
                }
            }
        })
        res.render('matches', {matches, user, squads, firstMatchStarted})
    })
    .catch(error =>{
        console.log('the error is ', error)
        res.render('error')
    })
})


league.post('/bonus-prediction', isLoggedIn, (req, res) => {
    User.findOne({user_id: req.user.user_id}).exec()
    .then(user => {
        user.bonus_prediction = {
            playoff_teams: req.body.playoff_teams,
            winning_team: req.body.winning_team,
            orange_cap_winner: req.body.orange_cap_winner,
            purple_cap_winner: req.body.purple_cap_winner
        }
        user.save().then(() => res.redirect('/league/matches'))
    })
    .catch(error => res.render('error'))
})


league.post('/prediction', isLoggedIn, (req, res) => {
    const timestamp = new Date()
    return Promise.all([
        Match.findOne({_id: req.body.match_id}).exec(),
        User.findOne({user_id: req.user.user_id}).exec()
    ])
    .then(([match, user]) => {
        if(date.subtract(match.start_time, timestamp).toMinutes() < 0){
            res.render('error')
        }
        const index = user.predictions.map(prediction => prediction.match_id).indexOf(req.body.match_id)
        const prediction = {
            match_id: req.body.match_id,
            winner: req.body.winner,
            mom: req.body.mom,
            first_inns_score: req.body.predicted_score,
            post_timestamp: timestamp,
            double_used: req.body.multiplier === 'double',
            triple_used: req.body.multiplier === 'triple',
            superboost_used: req.body.multiplier === 'superboost'
        }
        if(prediction.double_used){
            user.doubles_remaining--
        }
        if(prediction.triple_used){
            user.triples_remaining--
        }
        if(prediction.superboost_used){
            user.superboosts_remaining--
        }
        if(index === -1){
            user.predictions.push(prediction)
        } 
        else{
            const previous_prediction = user.predictions[index]
            if(previous_prediction.double_used){
                user.doubles_remaining++
            }
            else if(previous_prediction.triple_used){
                user.triples_remaining++
            }
            else if(previous_prediction.superboost_used){
                user.superboosts_remaining++
            }

            user.predictions[index] = prediction
        }
        user.save()
        .then(() => res.redirect('/league/matches'))
    })
    .catch(error => res.render('error'))
})





module.exports = league
