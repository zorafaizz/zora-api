const CREATOR = 'KanjutGede';

export function legacyCompatMiddleware(req, res, next) {
  res.sendSuccess = (result, extraMeta = {}) => {
    const latency = `${Date.now() - (req._startTime || Date.now())}ms`;
    return res.json({
      status: true,
      creator: CREATOR,
      latency,
      result,
      data: result, // Alias penting untuk bot yang membaca json.data
      ...extraMeta
    });
  };

  res.sendError = (error, code = 400) => {
    const latency = `${Date.now() - (req._startTime || Date.now())}ms`;
    const message = error.message || (typeof error === 'string' ? error : 'Internal Error');
    return res.status(code).json({
      status: false,
      creator: CREATOR,
      latency,
      error: message,
      message,
      code: error.code || 'REQUEST_FAILED'
    });
  };

  next();
}
