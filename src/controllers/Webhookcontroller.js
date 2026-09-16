const crypto = require("crypto");
const Invoice = require("../models/Invoice");
const BillingSettings = require("../models/BillingSettings");

// IMPORTANT: this route needs the RAW request body (not JSON-parsed) to
// verify the signature correctly. In your route file, mount it with:
//   router.post("/webhook", express.raw({ type: "application/json" }), handleWebhook);
// ...BEFORE your global express.json() middleware runs on it, or the
// signature check below will always fail.

exports.handleWebhook = async (req, res) => {
  try {
    const settings = await BillingSettings.getSettings();
    const webhookSecret = settings.razorpay_webhook_secret;

    if (!webhookSecret) {
      console.error("Razorpay webhook secret not configured in Billing Settings.");
      return res.status(400).json({ success: false, message: "Webhook secret not configured" });
    }

    const signature = req.headers["x-razorpay-signature"];
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(req.body) // raw buffer
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(400).json({ success: false, message: "Invalid webhook signature" });
    }

    const event = JSON.parse(req.body.toString());
    const eventType = event.event;

    // Always acknowledge fast — Razorpay retries if you don't 200 quickly.
    res.status(200).json({ received: true });

    switch (eventType) {
      case "payment.captured": {
        const payment = event.payload.payment.entity;
        await Invoice.findOneAndUpdate(
          { razorpay_order_id: payment.order_id },
          {
            razorpay_payment_id: payment.id,
            status: "paid",
            payment_status: "captured",
            paid_at: new Date(),
          }
        );
        break;
      }

      case "payment.failed": {
        const payment = event.payload.payment.entity;
        await Invoice.findOneAndUpdate(
          { razorpay_order_id: payment.order_id },
          { status: "failed", payment_status: "failed" }
        );
        break;
      }

      case "refund.processed": {
        const refund = event.payload.refund.entity;
        await Invoice.findOneAndUpdate(
          { razorpay_payment_id: refund.payment_id },
          { status: "refunded" }
        );
        break;
      }

      default:
        // Unhandled event types are fine to ignore — just log for visibility.
        console.log(`Unhandled Razorpay webhook event: ${eventType}`);
    }
  } catch (err) {
    console.error("Webhook processing error:", err.message);
    // Response was already sent above; nothing more to do here.
  }
};