const express = require('express');
const paymentRoute = express.Router();
const { createPayment, verifyPayment } = require('../controllers/paymentController');

paymentRoute.post('/create', createPayment)

paymentRoute.post('/verify', verifyPayment);

module.exports = paymentRoute;