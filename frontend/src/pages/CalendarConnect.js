import React from "react";
import { useSearchParams, Link } from "react-router-dom";

export default function CalendarConnect() {
  const [params] = useSearchParams();
  const status = params.get("status");

  return (
    <div className="container narrow">
      <div className="card">
        {status === "success" ? (
          <>
            <h2>Google Calendar connected ✓</h2>
            <p className="muted">Your appointments will now sync to your Google Calendar automatically.</p>
          </>
        ) : (
          <>
            <h2>Connection failed</h2>
            <p className="muted">We couldn't connect your Google Calendar. Please try again from your account settings.</p>
          </>
        )}
        <Link to="/" className="btn btn-primary" style={{ marginTop: 14 }}>Back to home</Link>
      </div>
    </div>
  );
}
