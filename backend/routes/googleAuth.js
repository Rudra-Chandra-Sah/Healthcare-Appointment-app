const express = require("express");
const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const calendarService = require("../services/calendarService");

const router = express.Router();

// @route  GET /api/auth/google/callback?code=...&state=...
// @desc   Public redirect target from Google's consent screen. Exchanges
//         the code for tokens and saves them on the user, then redirects
//         back to the client app.
router.get(
  "/google/callback",
  asyncHandler(async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.redirect(`${process.env.CLIENT_URL}/calendar-connect?status=error`);
    }
    let userId;
    try {
      userId = JSON.parse(state).userId;
    } catch {
      return res.redirect(`${process.env.CLIENT_URL}/calendar-connect?status=error`);
    }

    try {
      const tokens = await calendarService.exchangeCodeForTokens(code);
      await User.findByIdAndUpdate(userId, {
        googleCalendar: {
          connected: true,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
          calendarId: "primary",
        },
      });
      return res.redirect(`${process.env.CLIENT_URL}/calendar-connect?status=success`);
    } catch (err) {
      console.error("Google OAuth callback failed:", err.message);
      return res.redirect(`${process.env.CLIENT_URL}/calendar-connect?status=error`);
    }
  })
);

module.exports = router;
