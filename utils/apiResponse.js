/**
 * Consistent JSON response helpers.
 * Every endpoint responds with: { success, message, data? } (+ errors for validation failures)
 */

export function sendSuccess(res, statusCode, message, data = null) {
  return res.status(statusCode).json({ success: true, message, data });
}

export function sendError(res, statusCode, message, extra = {}) {
  return res.status(statusCode).json({ success: false, message, ...extra });
}
