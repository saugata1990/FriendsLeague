const mongoose = require('mongoose')
const findOrCreate = require('mongoose-findorcreate')
const Schema = mongoose.Schema
mongoose.Promise = global.Promise
const db = mongoose.createConnection(process.env.mongo_url, { useNewUrlParser: true })

const teamSchema = new Schema({
    name: String,
    squad: [String] 
})

teamSchema.plugin(findOrCreate)

const Team = db.model('Team', teamSchema)

module.exports = Team