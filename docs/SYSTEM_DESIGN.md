# System Design Write-up

*(≤800 words — covers double-booking prevention, doctor leave conflict handling, slot hold
mechanism, and notification failure handling.)*

## 1. Double-booking prevention

The core guarantee — "two patients can never end up confirmed for the same doctor at the same
time" — is enforced at the **database layer**, not in application code, because application-level
checks ("query for a conflict, then insert if none found") are inherently racy: two simultaneous
requests can both pass the check before either has inserted, and both insert successfully.

Instead, `Appointment` has a **partial unique index**:

```js
appointmentSchema.index(
  { doctor: 1, date: 1, startTime: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ["hold", "confirmed"] } } }
);
```

Every booking attempt is an `insert` (via `Appointment.create`), never an update-in-place of a
shared "slots" document. MongoDB evaluates uniqueness atomically at the storage-engine level, so
if two requests race for `(doctorId, "2026-07-10", "09:00")`, exactly one insert succeeds and the
second receives a duplicate-key error (`code === 11000`), which the route handler in
`routes/appointment.js` translates into an HTTP `409 Conflict` — "This slot was just booked by
someone else." The index is *partial* (only applies to `hold`/`confirmed` statuses) so that
cancelled or completed appointments don't block the slot from being reused later.

This means correctness doesn't depend on application-level locking, transactions, or careful
ordering of reads and writes — it's structurally impossible for two `hold`/`confirmed` rows to
exist for the same doctor/date/time, regardless of request timing, server restarts, or horizontal
scaling to multiple API instances.

## 2. Slot hold mechanism

Booking is a two-step UX (pick a slot → fill in symptoms → confirm), but we don't want a slot to
be reserved indefinitely by someone who abandons the flow. So `POST /appointments/hold` doesn't
just check availability — it immediately **inserts** an `Appointment` with `status: "hold"` and a
`holdExpiresAt` timestamp 5 minutes in the future. That insert is exactly what the partial unique
index above protects, so a hold is just as "real" a reservation as a confirmed booking, and no
other patient can grab the same slot while it's held.

`holdExpiresAt` also has a **TTL index** (`expireAfterSeconds: 0`), so MongoDB's background reaper
automatically deletes any hold document once its `holdExpiresAt` passes — no cron job or manual
cleanup required. If the patient completes the flow in time, `POST /appointments/:id/confirm`
flips `status` to `"confirmed"` and **unsets** `holdExpiresAt`, which removes the document from
TTL consideration entirely (permanent until explicitly cancelled). If they don't confirm, the
slot silently frees itself and reappears as available on the next slot-list query.

## 3. Doctor leave conflict handling

When an admin calls `POST /admin/doctors/:profileId/leave` with a date, three things happen inside
one handler, in order, each designed to degrade gracefully if a later step fails:

1. The date is appended to `DoctorProfile.leaveDays`, which immediately removes that date from
   future availability (`slotService.getAvailableSlots` checks `leaveDays` before generating any
   slots for a date).
2. All existing `hold`/`confirmed` appointments for that doctor+date are queried and transitioned
   to a distinct status, `doctor_leave_cancelled` (kept separate from a normal patient/doctor
   `cancelled` so admins and analytics can tell *why* a visit didn't happen).
3. For each affected appointment, the system best-effort deletes the associated Google Calendar
   events (wrapped in `.catch(() => {})` so a Calendar API hiccup never blocks the cancellation
   itself) and queues a `doctor_leave_notice` email to the patient explaining the appointment was
   cancelled and inviting them to rebook.

Because cancellation flips `status` away from `hold`/`confirmed`, the partial unique index
automatically frees that `(doctor, date, startTime)` slot for other patients — no separate
"release the slot" step is needed.

## 4. Notification failure handling

Emails are never sent synchronously-only. `emailService.queueAndSend()` first **persists** a
`Notification` row (`status: "pending"`) — this is the source of truth — and only then attempts an
immediate send via `attemptSend()`. A send failure (bad SMTP creds, transient network error, rate
limit) sets `status: "failed"` with `attempts` and `lastError` recorded, but never throws back up
into the booking/cancellation/visit-completion route, so a broken mail server can't break the core
product.

Two cron jobs (`node-cron`, configurable via `EMAIL_RETRY_CRON` / `REMINDER_CRON`) close the loop:
`emailRetryJob` re-attempts any `"failed"` notification up to `MAX_EMAIL_RETRIES` times, then marks
it `"abandoned"` so it stops retrying forever and is easy to find in an ops query; `reminderJob`
sends notifications that were deliberately scheduled for the future (24h appointment reminders,
per-dose medication reminders) once their `scheduledFor` time arrives. The same queue/retry
pattern is reused for every notification type, so reminder delivery and failure recovery share one
code path instead of being reimplemented per feature.
