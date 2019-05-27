const mongoose = require('mongoose')
const Schema = mongoose.Schema
const findOrCreate = require('mongoose-findorcreate')
mongoose.Promise = global.Promise
const db = mongoose.createConnection(process.env.mongo_url, { useNewUrlParser: true })

const matchSchema = new Schema({
    match_no: Number,
    start_time: Date,
    start_time_display: Date, // local time
    team1: String, 
    team1_flag: {data: String, contentType: String},
    team2: String, 
    team2_flag: {data: String, contentType: String},
    winner: String,
    first_inns_score: Number,
    mom: String,
    result_updated: Boolean
})

matchSchema.plugin(findOrCreate)

const Match = db.model('Match', matchSchema)

module.exports = Match