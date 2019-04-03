const mongoose = require('mongoose')
const findOrCreate = require('mongoose-findorcreate')
const Schema = mongoose.Schema
mongoose.Promise = global.Promise
const db = mongoose.createConnection(process.env.mongo_url, { useNewUrlParser: true })

const subscriptionSchema = new Schema({
    subscription: Object
})

subscriptionSchema.plugin(findOrCreate)

const Subscription = db.model('Subscription', subscriptionSchema)

module.exports = Subscription