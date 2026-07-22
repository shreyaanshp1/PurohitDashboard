import crypto from "node:crypto";

export function authenticateDashboardPassword({ password }) {
  const configuredPassword = String(process.env.ADMIN_DASHBOARD_PASSWORD || "");
  const submittedPassword = String(password || "");

  if (!configuredPassword) {
    throw statusError("Dashboard password is not configured.", 503);
  }

  if (!submittedPassword || !secureCompare(submittedPassword, configuredPassword)) {
    throw statusError("Invalid dashboard password.", 401);
  }

  return {
    session: {
      name: process.env.ADMIN_DASHBOARD_NAME || "Dashboard Admin",
      role: "admin",
      username: "dashboard-admin"
    },
    success: true
  };
}

function secureCompare(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function statusError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
