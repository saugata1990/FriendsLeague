const express = require('express')
require('dotenv').config()
const app = express()
const session = require('express-session')
const MongoDBStore = require('connect-mongodb-session')(session)
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
// const webpush = require('web-push')
const passport = require('passport')
const FacebookStrategy = require('passport-facebook').Strategy
const auth = require('./routes/auth')
const league = require('./routes/league')
const admin = require('./routes/admin')
const subscription = require('./routes/subscription')
const User = require('./models/user')
const Subscription = require('./models/push_subscription')
const { schedule_notifications } = require('./utils/middlewares')
const path = require('path')

const store = new MongoDBStore({
    uri: process.env.mongo_url,
    collection: 'user_sessions'
})

app.use(express.static(path.join(__dirname, 'serviceworker')))

app.use(session({
    secret: process.env.session_secret,
    store: store,
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
app.use('/subscription', subscription)


app.get('/', (req, res) => {
    res.redirect('/auth/facebook-login')
})

app.get('/test', (req, res) => {
    res.render('test')
})

app.listen(process.env.PORT, () => {
    Subscription.find({})
    .then(subscriptions => {
        subscriptions.map(subscription => schedule_notifications(subscription.subscription))
    })
    console.log(`listening on port ${process.env.PORT}`)
})