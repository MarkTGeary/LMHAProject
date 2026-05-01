class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function badRequest(message) {
  return new ApiError(400, message, 'BAD_REQUEST');
}

function forbidden(message) {
  return new ApiError(403, message, 'FORBIDDEN');
}

function conflict(message) {
  return new ApiError(409, message, 'CONFLICT');
}

function notFound(message = 'Not found') {
  return new ApiError(404, message, 'NOT_FOUND');
}

module.exports = {
  ApiError,
  badRequest,
  conflict,
  forbidden,
  notFound,
};
