const express = require('express')
require('dotenv').config()
const app = express()
const session = require('express-session')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const passport = require('passport')
const FacebookStrategy = require('passport-facebook').Strategy
const auth = require('./routes/auth')
const league = require('./routes/league')
const admin = require('./routes/admin')
const User = require('./models/user')

app.use(session({
    secret: "tHiSiSasEcRetStr", // will use random string
    resave: true,
    saveUninitialized: true 
}));

app.use(cookieParser());

app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.urlencoded({extended: true, limit: '50mb'}))
app.use(bodyParser.json({limit: '50mb'}))

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});

passport.use(new FacebookStrategy({
    clientID: process.env.facebook_app_id,  
    clientSecret: process.env.facebook_app_secret,
    callbackURL: process.env.callback_url,
    profileFields: ['id', 'displayName', 'photos']
}, (accessToken, refreshToken, profile, cb) => {
    User.findOne({user_id: profile.id}, (err, user) => {
        if(!user){
            user = new User({
                user_id: profile.id,
                name: profile.displayName,
                signup_timestamp: new Date(),
                avatar_url: profile.photos[0].value
            })
        }
        else{
            user.name = profile.displayName
            user.avatar_url = profile.photos[0].value
        }
        user.save((err) => cb(err, user))
    })
}))


app.set('view engine', 'ejs')

app.use('/auth', auth)
app.use('/league', league)
app.use('/admin', admin)


app.get('/', (req, res) => {
    res.redirect('/auth/facebook-login')
})



app.listen(process.env.PORT||3000, () => console.log('listening on port 3000'))