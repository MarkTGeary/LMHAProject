const { afterEach, describe, test } = require('node:test');
const assert = require('node:assert/strict');

const config = require('../lib/config');

const ENV_KEYS = [
  'NODE_ENV', 'FRONTEND_URL', 'FRONTEND_URLS', 'BACKEND_URL', 'PORT',
  'ALLOWED_EMAILS', 'ADMIN_EMAILS', 'ROOT_ADMIN_EMAIL', 'SESSION_SECRET',
  'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
  'SPREADSHEET_ID_LMHA', 'SPREADSHEET_ID_SOLACE', 'GOOGLE_SERVICE_ACCOUNT_JSON',
  'GOOGLE_SERVICE_ACCOUNT_KEY_PATH', 'APP_TIME_ZONE',
];

function snapshotEnv() {
  const snapshot = {};
  for (const key of ENV_KEYS) snapshot[key] = process.env[key];
  return snapshot;
}

function restoreEnv(snapshot) {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
}

const originalEnv = snapshotEnv();
afterEach(() => restoreEnv(originalEnv));

describe('splitList', () => {
  test('splits a comma-separated list and trims entries', () => {
    assert.deepEqual(config.splitList('a, b ,c'), ['a', 'b', 'c']);
  });

  test('filters out empty entries', () => {
    assert.deepEqual(config.splitList('a,,b,'), ['a', 'b']);
  });

  test('returns [] for undefined/null/empty input', () => {
    assert.deepEqual(config.splitList(undefined), []);
    assert.deepEqual(config.splitList(null), []);
    assert.deepEqual(config.splitList(''), []);
  });

  test('returns a single-element array for a value with no commas', () => {
    assert.deepEqual(config.splitList('solo'), ['solo']);
  });
});

describe('normaliseEmail', () => {
  test('lowercases and trims', () => {
    assert.equal(config.normaliseEmail('  Admin@Example.COM  '), 'admin@example.com');
  });

  test('returns "" for undefined/null', () => {
    assert.equal(config.normaliseEmail(undefined), '');
    assert.equal(config.normaliseEmail(null), '');
  });
});

describe('normaliseOrigin', () => {
  test('extracts the origin from a full URL with a path', () => {
    assert.equal(config.normaliseOrigin('https://example.com/some/path?x=1'), 'https://example.com');
  });

  test('preserves a non-default port', () => {
    assert.equal(config.normaliseOrigin('http://localhost:5173/'), 'http://localhost:5173');
  });

  test('returns "" for empty input', () => {
    assert.equal(config.normaliseOrigin(''), '');
    assert.equal(config.normaliseOrigin(undefined), '');
  });

  test('falls back to trimmed, trailing-slash-stripped input when not a valid URL', () => {
    assert.equal(config.normaliseOrigin('not a url///'), 'not a url');
  });
});

describe('getFrontendUrls', () => {
  test('defaults to localhost:5173 when nothing is configured', () => {
    delete process.env.FRONTEND_URL;
    delete process.env.FRONTEND_URLS;
    assert.deepEqual(config.getFrontendUrls(), ['http://localhost:5173']);
  });

  test('uses FRONTEND_URL when set', () => {
    process.env.FRONTEND_URL = 'https://app.example.com/';
    delete process.env.FRONTEND_URLS;
    assert.deepEqual(config.getFrontendUrls(), ['https://app.example.com']);
  });

  test('FRONTEND_URLS takes precedence and supports multiple comma-separated origins', () => {
    process.env.FRONTEND_URLS = 'https://a.example.com, https://b.example.com';
    process.env.FRONTEND_URL = 'https://ignored.example.com';
    assert.deepEqual(config.getFrontendUrls(), ['https://a.example.com', 'https://b.example.com']);
  });

  test('dedupes identical origins', () => {
    process.env.FRONTEND_URLS = 'https://a.example.com,https://a.example.com/';
    assert.deepEqual(config.getFrontendUrls(), ['https://a.example.com']);
  });
});

describe('getPrimaryFrontendUrl', () => {
  test('returns the first configured frontend URL', () => {
    process.env.FRONTEND_URLS = 'https://a.example.com,https://b.example.com';
    assert.equal(config.getPrimaryFrontendUrl(), 'https://a.example.com');
  });
});

describe('getBackendUrl', () => {
  test('uses BACKEND_URL when set', () => {
    process.env.BACKEND_URL = 'https://api.example.com';
    assert.equal(config.getBackendUrl(), 'https://api.example.com');
  });

  test('falls back to localhost with PORT when BACKEND_URL is unset', () => {
    delete process.env.BACKEND_URL;
    process.env.PORT = '4000';
    assert.equal(config.getBackendUrl(), 'http://localhost:4000');
  });

  test('falls back to localhost:3000 when neither BACKEND_URL nor PORT is set', () => {
    delete process.env.BACKEND_URL;
    delete process.env.PORT;
    assert.equal(config.getBackendUrl(), 'http://localhost:3000');
  });
});

describe('getAllowedEmailSeeds', () => {
  test('parses and normalises a comma-separated list', () => {
    process.env.ALLOWED_EMAILS = 'A@Example.com, b@example.com';
    assert.deepEqual(config.getAllowedEmailSeeds(), ['a@example.com', 'b@example.com']);
  });

  test('returns [] when unset', () => {
    delete process.env.ALLOWED_EMAILS;
    assert.deepEqual(config.getAllowedEmailSeeds(), []);
  });
});

describe('getRootAdminEmail', () => {
  test('prefers explicit ROOT_ADMIN_EMAIL', () => {
    process.env.ROOT_ADMIN_EMAIL = 'Root@Example.com';
    process.env.ADMIN_EMAILS = 'other@example.com';
    process.env.ALLOWED_EMAILS = 'allowed@example.com';
    assert.equal(config.getRootAdminEmail(), 'root@example.com');
  });

  test('falls back to the first ADMIN_EMAILS entry', () => {
    delete process.env.ROOT_ADMIN_EMAIL;
    process.env.ADMIN_EMAILS = 'first-admin@example.com,second-admin@example.com';
    assert.equal(config.getRootAdminEmail(), 'first-admin@example.com');
  });

  test('falls back to the first ALLOWED_EMAILS entry', () => {
    delete process.env.ROOT_ADMIN_EMAIL;
    delete process.env.ADMIN_EMAILS;
    process.env.ALLOWED_EMAILS = 'first-allowed@example.com';
    assert.equal(config.getRootAdminEmail(), 'first-allowed@example.com');
  });

  test('returns "" when nothing is configured', () => {
    delete process.env.ROOT_ADMIN_EMAIL;
    delete process.env.ADMIN_EMAILS;
    delete process.env.ALLOWED_EMAILS;
    assert.equal(config.getRootAdminEmail(), '');
  });
});

describe('getAdminEmails', () => {
  test('combines ADMIN_EMAILS with the derived root admin, deduped', () => {
    process.env.ADMIN_EMAILS = 'a@example.com,b@example.com';
    process.env.ROOT_ADMIN_EMAIL = 'a@example.com';
    const admins = config.getAdminEmails();
    assert.deepEqual([...admins].sort(), ['a@example.com', 'b@example.com']);
  });

  test('includes a root admin derived from ALLOWED_EMAILS even if not in ADMIN_EMAILS', () => {
    delete process.env.ADMIN_EMAILS;
    delete process.env.ROOT_ADMIN_EMAIL;
    process.env.ALLOWED_EMAILS = 'only-allowed@example.com';
    assert.deepEqual(config.getAdminEmails(), ['only-allowed@example.com']);
  });

  test('returns [] when nothing is configured', () => {
    delete process.env.ADMIN_EMAILS;
    delete process.env.ROOT_ADMIN_EMAIL;
    delete process.env.ALLOWED_EMAILS;
    assert.deepEqual(config.getAdminEmails(), []);
  });
});

describe('isAdminEmail / isRootAdminEmail', () => {
  test('isAdminEmail is case-insensitive and matches configured admins', () => {
    process.env.ADMIN_EMAILS = 'admin@example.com';
    assert.equal(config.isAdminEmail('Admin@Example.com'), true);
    assert.equal(config.isAdminEmail('staff@example.com'), false);
  });

  test('isRootAdminEmail matches only the root admin', () => {
    process.env.ROOT_ADMIN_EMAIL = 'root@example.com';
    process.env.ADMIN_EMAILS = 'root@example.com,other-admin@example.com';
    assert.equal(config.isRootAdminEmail('Root@Example.com'), true);
    assert.equal(config.isRootAdminEmail('other-admin@example.com'), false);
  });

  test('isRootAdminEmail is false when no root admin is configured', () => {
    delete process.env.ROOT_ADMIN_EMAIL;
    delete process.env.ADMIN_EMAILS;
    delete process.env.ALLOWED_EMAILS;
    assert.equal(config.isRootAdminEmail('anyone@example.com'), false);
  });
});

describe('isProduction', () => {
  test('true only when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production';
    assert.equal(config.isProduction(), true);
    process.env.NODE_ENV = 'development';
    assert.equal(config.isProduction(), false);
    process.env.NODE_ENV = 'test';
    assert.equal(config.isProduction(), false);
  });
});

describe('getSessionSecret', () => {
  test('uses SESSION_SECRET when set', () => {
    process.env.SESSION_SECRET = 'my-custom-secret';
    assert.equal(config.getSessionSecret(), 'my-custom-secret');
  });

  test('falls back to the dev default when unset', () => {
    delete process.env.SESSION_SECRET;
    assert.equal(config.getSessionSecret(), 'lmha-dev-secret-change-me');
  });
});

describe('getAuthCookieOptions / getExpiredAuthCookieOptions', () => {
  test('non-production cookies use SameSite=Lax and omit Secure', () => {
    process.env.NODE_ENV = 'development';
    const opts = config.getAuthCookieOptions();
    assert.match(opts, /HttpOnly/);
    assert.match(opts, /Path=\//);
    assert.match(opts, /Max-Age=28800/);
    assert.match(opts, /SameSite=Lax/);
    assert.doesNotMatch(opts, /Secure/);
  });

  test('production cookies use SameSite=None and include Secure', () => {
    process.env.NODE_ENV = 'production';
    const opts = config.getAuthCookieOptions();
    assert.match(opts, /SameSite=None/);
    assert.match(opts, /Secure/);
  });

  test('expired cookie options set Max-Age=0', () => {
    process.env.NODE_ENV = 'development';
    const opts = config.getExpiredAuthCookieOptions();
    assert.match(opts, /Max-Age=0/);
  });
});

describe('validateProductionEnv', () => {
  function setAllRequired() {
    process.env.NODE_ENV = 'production';
    process.env.TURSO_DATABASE_URL = 'libsql://db';
    process.env.TURSO_AUTH_TOKEN = 'token';
    process.env.GOOGLE_CLIENT_ID = 'id';
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    process.env.BACKEND_URL = 'https://api.example.com';
    process.env.SESSION_SECRET = 'x'.repeat(32);
    process.env.SPREADSHEET_ID_LMHA = 'sheet1';
    process.env.SPREADSHEET_ID_SOLACE = 'sheet2';
    process.env.FRONTEND_URL = 'https://app.example.com';
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = '{}';
    process.env.ALLOWED_EMAILS = 'admin@example.com';
    process.env.APP_TIME_ZONE = 'Europe/Dublin';
  }

  test('is a no-op outside production', () => {
    process.env.NODE_ENV = 'development';
    assert.doesNotThrow(() => config.validateProductionEnv());
  });

  test('does not throw when all required vars are present', () => {
    setAllRequired();
    assert.doesNotThrow(() => config.validateProductionEnv());
  });

  test('throws listing missing required vars', () => {
    setAllRequired();
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.SPREADSHEET_ID_LMHA;
    assert.throws(() => config.validateProductionEnv(), (err) => {
      assert.match(err.message, /GOOGLE_CLIENT_SECRET/);
      assert.match(err.message, /SPREADSHEET_ID_LMHA/);
      return true;
    });
  });

  test('throws when session secret is too short', () => {
    setAllRequired();
    process.env.SESSION_SECRET = 'short';
    assert.throws(() => config.validateProductionEnv(), /SESSION_SECRET length/);
  });

  test('throws when neither FRONTEND_URL nor FRONTEND_URLS is set', () => {
    setAllRequired();
    delete process.env.FRONTEND_URL;
    delete process.env.FRONTEND_URLS;
    assert.throws(() => config.validateProductionEnv(), /FRONTEND_URL or FRONTEND_URLS/);
  });

  test('accepts FRONTEND_URLS in place of FRONTEND_URL', () => {
    setAllRequired();
    delete process.env.FRONTEND_URL;
    process.env.FRONTEND_URLS = 'https://app.example.com';
    assert.doesNotThrow(() => config.validateProductionEnv());
  });

  test('throws when neither Google service account var is set', () => {
    setAllRequired();
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
    assert.throws(() => config.validateProductionEnv(), /GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_KEY_PATH/);
  });

  test('accepts GOOGLE_SERVICE_ACCOUNT_KEY_PATH in place of the JSON var', () => {
    setAllRequired();
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH = '/path/to/key.json';
    assert.doesNotThrow(() => config.validateProductionEnv());
  });

  test('throws when no allowed emails or root admin is configured', () => {
    setAllRequired();
    delete process.env.ALLOWED_EMAILS;
    delete process.env.ROOT_ADMIN_EMAIL;
    delete process.env.ADMIN_EMAILS;
    assert.throws(() => config.validateProductionEnv(), /ALLOWED_EMAILS or ROOT_ADMIN_EMAIL/);
  });

  test('throws when APP_TIME_ZONE is not Europe/Dublin', () => {
    // APP_TIME_ZONE is captured as a module-level constant at require time,
    // so this must reload the module under the mutated env to observe it.
    setAllRequired();
    const originalTz = process.env.TZ;
    process.env.APP_TIME_ZONE = 'UTC';
    const configPath = require.resolve('../lib/config');
    delete require.cache[configPath];
    try {
      const freshConfig = require('../lib/config');
      assert.throws(() => freshConfig.validateProductionEnv(), /APP_TIME_ZONE=Europe\/Dublin/);
    } finally {
      delete require.cache[configPath];
      process.env.APP_TIME_ZONE = 'Europe/Dublin';
      require('../lib/config');
      process.env.TZ = originalTz;
    }
  });
});
