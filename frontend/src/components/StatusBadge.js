import React from "react";

export function StatusBadge({ status }) {
  const label = status.replace(/_/g, " ");
  return <span className={`badge badge-status-${status}`}>{label}</span>;
}

export function UrgencyBadge({ level }) {
  if (!level) return null;
  return <span className={`badge badge-${level.toLowerCase()}`}>{level} urgency</span>;
}
