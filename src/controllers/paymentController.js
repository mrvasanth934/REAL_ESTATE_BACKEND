const Razorpay = require("razorpay");
const crypto = require("crypto");
const Payment = require("../models/paymentModel");

const razorpay = new Razorpay({
  key_id: process.env.TEST_KEY_ID,
  key_secret: process.env.TEST_KEY_SECRET,
});

const createPayment = async (req, res) => {
  try {
    const {
      payerId,
      receiverId,
      paymentType,
      amount,
      bookingId,
      planId,
      paymentMethod,
      status,
    } = req.body;

    console.log(
      payerId,
      receiverId,
      paymentType,
      amount,
      bookingId,
      planId,
      paymentMethod,
      status,
    );

    if (paymentType === "SUBSCRIPTION") {
      const subscription = await razorpay.subscriptions.create({
        plan_id: planId,
        total_count: 12,
        customer_notify: 1,
      });

      const paymentDoc = await Payment.create({
        payer: payerId,
        paymentType: "SUBSCRIPTION",
        amount: amount,
        status: "Pending",
        subscriptionDetails: {
          planId: planId,
          razorpaySubscriptionId: subscription.id,
        },
      });

      return res.json({
        success: true,
        isSubscription: true,
        subscriptionId: subscription.id,
        paymentId: paymentDoc._id,
      });
    }

    console.log(paymentMethod);

    const method = paymentMethod ? paymentMethod.toLowerCase() : "";

    if (
      method === "online" ||
      method === "upi" ||
      method === "card" ||
      method === "bank transfer"
    ) {
      const options = {
        amount: amount * 100,
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
      };

      const order = await razorpay.orders.create(options);
      const commission = amount * 0.05;
      const transferAmt = amount - commission;

      const paymentDoc = await Payment.create({
        payer: payerId,
        receiver: receiverId || null,
        paymentType: paymentType || "BOOKING",
        booking: bookingId || null,
        amount: amount,
        platformFee: commission,
        transferAmount: transferAmt,
        razorpayOrderId: order.id,
        status: "Pending",
        paymentMethod,
      });

      // if (bookingId) {
      //     await Booking.findByIdAndUpdate(bookingId, { payment: paymentDoc._id });
      // }

      return res.json({
        success: true,
        isSubscription: false,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        paymentId: paymentDoc._id,
      });
    }
    const commission = amount * 0.05;
    const transferAmt = amount - commission;

    const paymentDoc = await Payment.create({
      payer: payerId,
      receiver: receiverId || null,
      paymentType: paymentType || "BOOKING",
      booking: bookingId || null,
      amount: amount,
      platformFee: commission,
      transferAmount: transferAmt,
      razorpayOrderId: null,
      status: "Pending",
      paymentMethod,
      status,
    });

    // if (bookingId) {
    //     await Booking.findByIdAndUpdate(bookingId, { payment: paymentDoc._id });
    // }

    return res.json({
      success: true,
      isSubscription: false,
      paymentId: paymentDoc._id,
      message: "Offline payment recorded successfully",
    });
  } catch (error) {
    console.error("Universal payment creation error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      razorpay_subscription_id,
      paymentId,
      paymentType,
    } = req.body;

    let hmac = crypto.createHmac("sha256", process.env.TEST_KEY_SECRET);

    // A. Verification for Subscriptions
    if (paymentType === "SUBSCRIPTION") {
      hmac.update(razorpay_payment_id + "|" + razorpay_subscription_id);
      const generated_signature = hmac.digest("hex");

      if (generated_signature === razorpay_signature) {
        await Payment.findByIdAndUpdate(paymentId, {
          status: "Active",
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
        });
        return res.json({
          success: true,
          message: "Subscription activated successfully!",
        });
      }
    }

    // B. Verification for Bookings / Direct User-to-User Payments
    else {
      hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
      const generated_signature = hmac.digest("hex");

      console.log("sign", razorpay_signature);

      if (generated_signature === razorpay_signature) {
        const payment = await Payment.findById(paymentId);
        console.log(payment);

        if (!payment)
          return res
            .status(404)
            .json({ success: false, message: "Payment record not found" });

        // Update payment record
        payment.status = "Completed";
        payment.razorpayPaymentId = razorpay_payment_id;
        payment.razorpaySignature = razorpay_signature;
        await payment.save();

        return res.json({
          success: true,
          message: "Payment verified and completed successfully!",
        });
      }
    }

    return res
      .status(400)
      .json({ success: false, message: "Invalid signature / Payment failed!" });
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = { createPayment, verifyPayment };
