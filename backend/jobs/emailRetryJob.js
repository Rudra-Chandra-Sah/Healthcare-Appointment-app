const cron = require("node-cron");
const Notification = require("../models/Notification");
const emailService = require("../services/emailService");

/**
 * Runs on EMAIL_RETRY_CRON schedule. Retries any "failed" notification
 * (SMTP hiccup, transient network error, etc.) up to MAX_EMAIL_RETRIES.
 * After that, marks it "abandoned" so it stops being retried forever and
 * shows up clearly in admin/ops queries instead of silently vanishing.
 */
function startEmailRetryJob() {
  const schedule = process.env.EMAIL_RETRY_CRON || "*/10 * * * *";
  const maxRetries = Number(process.env.MAX_EMAIL_RETRIES) || 3;

  cron.schedule(schedule, async () => {
    try {
      const failed = await Notification.find({
        status: "failed",
        attempts: { $lt: maxRetries },
      }).limit(200);

      if (failed.length === 0) return;
      console.log(`[emailRetryJob] Retrying ${failed.length} failed notification(s)...`);
      for (const n of failed) {
        await emailService.attemptSend(n);
      }

      // Abandon anything that has now exhausted its retries
      await Notification.updateMany({ status: "failed", attempts: { $gte: maxRetries } }, { status: "abandoned" });
    } catch (err) {
      console.error("[emailRetryJob] error:", err.message);
    }
  });
  console.log(`Email retry job scheduled: ${schedule}`);
}

module.exports = startEmailRetryJob;
