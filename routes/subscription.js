const express = require('express')
const subscription = express.Router()
const Subscription = require('../models/push_subscription')
const { schedule_notifications } = require('../utils/middlewares')


subscription.post('/', (req, res) => {
    const subscription = req.body
    res.status(201).json({})
    Subscription.findOrCreate({subscription})
    .then(() => {
        schedule_notifications(subscription)
    })
    
    
})





module.exports = subscription