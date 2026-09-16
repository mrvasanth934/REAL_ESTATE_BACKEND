const Razorpay = require('razorpay');

const razorpayInstance = new Razorpay({
  key_id: process.env.TEST_KEY_ID,
  key_secret: process.env.TEST_KEY_SECRET,
});

module.exports = razorpayInstance;