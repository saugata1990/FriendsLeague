const mongoose = require('mongoose')
const findOrCreate = require('mongoose-findorcreate')
const Schema = mongoose.Schema
mongoose.Promise = global.Promise
const db = mongoose.createConnection(process.env.mongo_url, { useNewUrlParser: true })

const flagSchema = new Schema({
    team_name: String,
    flag: {data: String, contentType: String}
})

flagSchema.plugin(findOrCreate)

const Flag = db.model('Flag', flagSchema)

module.exports = Flag