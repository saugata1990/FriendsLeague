const mongoose = require('mongoose')
const findOrCreate = require('mongoose-findorcreate')
const Schema = mongoose.Schema
mongoose.Promise = global.Promise
// const date = require('date-and-time')
const db = mongoose.createConnection(process.env.mongo_url, { useNewUrlParser: true })

const adminSchema = new Schema({
    id: String,
    password_hash: String
})

adminSchema.plugin(findOrCreate)

const Admin = db.model('Admin', adminSchema)

module.exports = Admin