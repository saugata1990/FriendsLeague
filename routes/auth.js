const express = require('express')
const auth = express.Router()
const passport = require('passport')
const { isLoggedIn } = require('../utils/middlewares')


auth.get('/facebook-login', passport.authenticate('facebook'))



auth.get('/facebook/callback', passport.authenticate('facebook',
 { successRedirect: '/league/matches', failureRedirect: '/auth/failure', failureFlash: true }));



auth.get('/failure', (req, res) => {
    console.log('SOME ERROR OCCURED')
    res.render('error')
})








module.exports = auth