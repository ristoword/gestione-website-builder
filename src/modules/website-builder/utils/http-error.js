class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    if (extra && typeof extra === 'object') {
      Object.assign(this, extra);
    }
  }
}

function sendError(res, err) {
  const status = err.status || 500;
  const body = { error: err.message || 'Errore interno' };
  if (err.feature) body.feature = err.feature;
  if (err.limit != null) body.limit = err.limit;
  if (err.usage != null) body.usage = err.usage;
  if (err.planKey) body.planKey = err.planKey;
  if (err.errors) body.errors = err.errors;
  if (err.requiresConfirm) body.requiresConfirm = true;
  if (status >= 500) {
    console.error('[website-builder]', err);
  }
  res.status(status).json(body);
}

function wrapAsync(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch((err) => sendError(res, err));
  };
}

module.exports = { HttpError, sendError, wrapAsync };
