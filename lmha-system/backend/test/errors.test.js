const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const { ApiError, badRequest, conflict, forbidden, notFound } = require('../lib/errors');

describe('ApiError', () => {
  test('sets status, message, code, and name', () => {
    const err = new ApiError(418, "I'm a teapot", 'TEAPOT');
    assert.equal(err.status, 418);
    assert.equal(err.message, "I'm a teapot");
    assert.equal(err.code, 'TEAPOT');
    assert.equal(err.name, 'ApiError');
  });

  test('is an instance of Error', () => {
    const err = new ApiError(400, 'bad', 'BAD_REQUEST');
    assert.ok(err instanceof Error);
    assert.ok(err instanceof ApiError);
  });

  test('has a stack trace', () => {
    const err = new ApiError(500, 'boom', 'SERVER_ERROR');
    assert.equal(typeof err.stack, 'string');
  });
});

describe('badRequest', () => {
  test('returns a 400 ApiError with BAD_REQUEST code', () => {
    const err = badRequest('missing field');
    assert.ok(err instanceof ApiError);
    assert.equal(err.status, 400);
    assert.equal(err.code, 'BAD_REQUEST');
    assert.equal(err.message, 'missing field');
  });
});

describe('forbidden', () => {
  test('returns a 403 ApiError with FORBIDDEN code', () => {
    const err = forbidden('nope');
    assert.equal(err.status, 403);
    assert.equal(err.code, 'FORBIDDEN');
    assert.equal(err.message, 'nope');
  });
});

describe('conflict', () => {
  test('returns a 409 ApiError with CONFLICT code', () => {
    const err = conflict('already booked');
    assert.equal(err.status, 409);
    assert.equal(err.code, 'CONFLICT');
    assert.equal(err.message, 'already booked');
  });
});

describe('notFound', () => {
  test('returns a 404 ApiError with NOT_FOUND code', () => {
    const err = notFound('missing booking');
    assert.equal(err.status, 404);
    assert.equal(err.code, 'NOT_FOUND');
    assert.equal(err.message, 'missing booking');
  });

  test('defaults message to "Not found" when omitted', () => {
    const err = notFound();
    assert.equal(err.message, 'Not found');
  });
});
