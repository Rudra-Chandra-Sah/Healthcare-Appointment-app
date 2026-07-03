const { google } = require("googleapis");

const isLive = () => process.env.GOOGLE_CALENDAR_MODE === "live";

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getAuthUrl(state) {
  const oAuth2Client = getOAuthClient();
  return oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.events"],
    state,
  });
}

async function exchangeCodeForTokens(code) {
  const oAuth2Client = getOAuthClient();
  const { tokens } = await oAuth2Client.getToken(code);
  return tokens; // { access_token, refresh_token, expiry_date, ... }
}

function getCalendarClient(user) {
  const oAuth2Client = getOAuthClient();
  oAuth2Client.setCredentials({
    access_token: user.googleCalendar.accessToken,
    refresh_token: user.googleCalendar.refreshToken,
  });
  return google.calendar({ version: "v3", auth: oAuth2Client });
}

/**
 * Creates a calendar event for a user (patient or doctor) if they have
 * connected Google Calendar and GOOGLE_CALENDAR_MODE=live. Otherwise
 * returns a simulated event so the rest of the booking flow (DB writes,
 * email, UI) behaves identically either way.
 */
async function createEvent(user, { summary, description, startISO, endISO, timeZone }) {
  if (!isLive() || !user?.googleCalendar?.connected) {
    return mockEvent(summary, startISO);
  }
  try {
    const calendar = getCalendarClient(user);
    const { data } = await calendar.events.insert({
      calendarId: user.googleCalendar.calendarId || "primary",
      requestBody: {
        summary,
        description,
        start: { dateTime: startISO, timeZone: timeZone || "UTC" },
        end: { dateTime: endISO, timeZone: timeZone || "UTC" },
        reminders: { useDefault: true },
      },
    });
    return { id: data.id, link: data.htmlLink, mocked: false };
  } catch (err) {
    console.error("Google Calendar createEvent failed:", err.message);
    return { ...mockEvent(summary, startISO), failed: true };
  }
}

async function updateEvent(user, eventId, { summary, description, startISO, endISO, timeZone }) {
  if (!isLive() || !user?.googleCalendar?.connected || !eventId || eventId.startsWith("mock_")) {
    return mockEvent(summary, startISO);
  }
  try {
    const calendar = getCalendarClient(user);
    const { data } = await calendar.events.patch({
      calendarId: user.googleCalendar.calendarId || "primary",
      eventId,
      requestBody: {
        summary,
        description,
        start: { dateTime: startISO, timeZone: timeZone || "UTC" },
        end: { dateTime: endISO, timeZone: timeZone || "UTC" },
      },
    });
    return { id: data.id, link: data.htmlLink, mocked: false };
  } catch (err) {
    console.error("Google Calendar updateEvent failed:", err.message);
    return { ...mockEvent(summary, startISO), failed: true };
  }
}

async function deleteEvent(user, eventId) {
  if (!isLive() || !user?.googleCalendar?.connected || !eventId || eventId.startsWith("mock_")) {
    return { deleted: true, mocked: true };
  }
  try {
    const calendar = getCalendarClient(user);
    await calendar.events.delete({
      calendarId: user.googleCalendar.calendarId || "primary",
      eventId,
    });
    return { deleted: true, mocked: false };
  } catch (err) {
    console.error("Google Calendar deleteEvent failed:", err.message);
    return { deleted: false, failed: true, error: err.message };
  }
}

function mockEvent(summary, startISO) {
  const id = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return { id, link: `https://calendar.google.com/mock-event/${id}`, mocked: true };
}

module.exports = { getAuthUrl, exchangeCodeForTokens, createEvent, updateEvent, deleteEvent };
