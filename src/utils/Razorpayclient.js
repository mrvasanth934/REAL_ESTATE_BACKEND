const Razorpay = require("razorpay");

// FIX: standardized to use env vars (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)
// as the SINGLE credential source across the whole app.
//
// Why the change: Subscriptioncontroller.js (createSubscriptionOrder — the
// code path that actually takes tenant payments) already builds its Razorpay
// client from process.env directly. This old version built a SEPARATE client
// from BillingSettings in Mongo (the Settings tab). Those two credential
// sets were never guaranteed to match — if the Settings tab was left empty
// (which it was), every billing-side Razorpay call (refund, renewal order,
// test connection) failed with "not configured", but the controllers wrapped
// it into a generic 500 instead of surfacing the real message.
//
// This also avoids storing the Razorpay key secret in plaintext in Mongo,
// which was already flagged as a pre-launch security risk.
//
// NOTE: this means the "Key ID" / "Key Secret" fields in the Settings tab
// (SettingsTab.jsx, updateGatewaySettings) are no longer the source of
// truth. Either remove those fields from the UI, or keep them as read-only
// display of which mode (test/live) is active — actual credentials now
// come only from your .env file (or your hosting provider's env config for
// production).
function getRazorpayInstance() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    const error = new Error(
      "Razorpay credentials are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your .env file."
    );
    error.statusCode = 400;
    throw error;
  }

  return new Razorpay({ key_id, key_secret });
}

module.exports = { getRazorpayInstance };