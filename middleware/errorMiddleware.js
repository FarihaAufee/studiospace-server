import { sendError } from '../utils/apiResponse.js';

/** Catches every unmatched route (must be registered after all routers). */
export function notFoundHandler(req, res) {
  return sendError(res, 404, `Route ${req.method} ${req.originalUrl} not found`);
}

/** Central error middleware — Express 5 also forwards rejected promise handlers here. */
export function errorHandler(err, req, res, next) {
  let status = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';

  // Malformed JSON body from express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    status = 400;
    message = 'Invalid JSON in request body';
  }

  if (status >= 500) {
    console.error(err);
  }

  return sendError(res, status, message);
}
