const mongoose = require('mongoose')
const findOrCreate = require('mongoose-findorcreate')
const Schema = mongoose.Schema
mongoose.Promise = global.Promise
const db = mongoose.createConnection(process.env.mongo_url, { useNewUrlParser: true })

const userSchema = new Schema({
    user_id: String,
    avatar_url: String,
    name: String,
    signup_timestamp: Date,
    rank: Number,
    bonus_prediction: {
        playoff_teams: [String],
        winning_team: String,
        orange_cap_winner: String,
        purple_cap_winner: String
    },
    predictions: [
        {
            match_id: String,
            winner: String, 
            mom: String, 
            first_inns_score: Number, 
            post_timestamp: Date,
            double_used: Boolean,
            triple_used: Boolean,
            superboost_used: Boolean
        }
    ],
    score: {type: Number, default:  0}, 
    doubles_remaining: {type: Number, default: process.env.doubles},
    triples_remaining: {type: Number, default: process.env.triples},
    superboosts_remaining: {type: Number, default: process.env.superboosts},
    competition_finished: {type: Boolean, default: false}
})

userSchema.plugin(findOrCreate)

const User = db.model('User', userSchema)

module.exports = User