import jwt from 'jsonwebtoken';
import request from 'supertest';
import { getConfig, resetConfigCache } from '../src/config/configuration';

// Env is set in setup-e2e.ts before this file loads
resetConfigCache();

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require('../src/index') as { app: import('express').Express };

/**
 * Covers the fixes made in response to the FarmaGuard pentest
 * (2026-08-06) against /catalogs/parishes/list, scoped to what's
 * actionable from this backend:
 *   - #11/#12/#13/#30: auth must run BEFORE payload decryption, so a
 *     missing/invalid/expired token always gets a plain 401 — never a 400
 *     from the crypto layer, and never wrapped in an encrypted
 *     ResponseJson.
 *   - #15/#33/#36/#38/#41/#45/#50: security headers (Permissions-Policy,
 *     Cache-Control: no-store on business responses).
 * CORS method/origin hardening (#16/#21/#26/#28/#31/#37/#42) is covered by
 * unit tests in configuration.spec.ts (localhost filter) since it requires
 * building the app with different CORS_ORIGINS, and by the dedicated
 * Postman collection (ftd-spi-security-verification) for the live preflight
 * shape — see docs/security.
 */
describe('Security hardening e2e (post-pentest fixes)', () => {
  let token: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/ftd-spi-employee/rest/security/token')
      .send({ client_id: 'test-client', client_secret: 'test-secret' });
    token = res.body.access_token;
  });

  describe('auth gate runs before payload decryption (pentest #11/#12/#13/#30)', () => {
    it('no token + garbage RequestJson → 401, not the crypto layer\'s 400', async () => {
      const res = await request(app)
        .post('/ftd-spi-employee/rest/employee/get')
        .set('X-Country-Code', 'VE')
        .type('form')
        .send({ RequestJson: 'not-a-valid-cipher' })
        .expect(401);
      expect(res.body.statusCode).toBe(401);
      expect(res.body.message).not.toMatch(/encrypted payload/i);
    });

    it('expired token + garbage RequestJson → 401, not 400', async () => {
      const cfg = getConfig();
      const expired = jwt.sign(
        { countries: ['VE'] },
        cfg.jwt.privateKey,
        {
          algorithm: 'RS256',
          issuer: cfg.jwt.issuer,
          subject: 'test-client',
          expiresIn: -10,
        },
      );
      const res = await request(app)
        .post('/ftd-spi-employee/rest/employee/get')
        .set('Authorization', `Bearer ${expired}`)
        .set('X-Country-Code', 'VE')
        .type('form')
        .send({ RequestJson: 'not-a-valid-cipher' })
        .expect(401);
      expect(res.body.statusCode).toBe(401);
    });

    it('401 responses are never wrapped in encrypted ResponseJson', async () => {
      const res = await request(app)
        .post('/ftd-spi-employee/rest/employee/get')
        .set('X-Country-Code', 'VE')
        .type('form')
        .send({ RequestJson: 'not-a-valid-cipher' })
        .expect(401);
      expect(res.body).not.toHaveProperty('ResponseJson');
      expect(res.body).toMatchObject({ statusCode: 401 });
    });

    it('a valid token still lets the crypto layer run (existing 400 contract for a bad cipher is preserved)', () =>
      request(app)
        .post('/ftd-spi-employee/rest/employee/create')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Country-Code', 'VE')
        .type('form')
        .send({ RequestJson: 'not-a-valid-cipher' })
        .expect(400));

    it('catalogs module: no token + garbage RequestJson → 401 too (same gate, not just employee)', () =>
      request(app)
        .post('/ftd-spi-employee/rest/catalogs/countries/list')
        .set('X-Country-Code', 'VE')
        .type('form')
        .send({ RequestJson: 'not-a-valid-cipher' })
        .expect(401));
  });

  describe('security headers (pentest #15/#33/#36/#38/#41/#45/#50)', () => {
    it('sets Permissions-Policy denying all browser APIs', async () => {
      const res = await request(app).get('/health').expect(200);
      expect(res.headers['permissions-policy']).toBe(
        'camera=(), microphone=(), geolocation=(), payment=()',
      );
    });

    it('sets Cache-Control: no-store on /ftd-spi-employee/rest/** business responses', async () => {
      const res = await request(app)
        .post('/ftd-spi-employee/rest/catalogs/countries/list')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Country-Code', 'VE')
        .send({ page: 1, size: 20 })
        .expect(200);
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('still sets HSTS/X-Content-Type-Options/X-Frame-Options from helmet (unchanged)', async () => {
      const res = await request(app).get('/health').expect(200);
      expect(res.headers['strict-transport-security']).toContain(
        'max-age=31536000',
      );
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
    });
  });

  describe('unauthenticated requests get a uniform 401, even for unknown paths (closes pentest #27 differential enumeration)', () => {
    it('unknown path without a token → 401, same as a real endpoint (not a 404 that would confirm/deny it exists)', () =>
      request(app)
        .post('/ftd-spi-employee/rest/does-not-exist')
        .send({})
        .expect(401));

    it('unknown path WITH a valid token still correctly falls through to 404 (nothing broke)', () =>
      request(app)
        .post('/ftd-spi-employee/rest/does-not-exist')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Country-Code', 'VE')
        .send({})
        .expect(404));
  });

  describe('payload-crypto misconfiguration guard (fail closed, not open)', () => {
    afterEach(() => {
      delete process.env.REQUIRE_ENCRYPTED_PAYLOAD;
      process.env.PAYLOAD_ENCRYPTION_KEY = 'e2e-shared-key';
      resetConfigCache();
    });

    it('REQUIRE_ENCRYPTED_PAYLOAD=true with no key configured → 500, not silent plaintext acceptance', async () => {
      process.env.REQUIRE_ENCRYPTED_PAYLOAD = 'true';
      process.env.PAYLOAD_ENCRYPTION_KEY = '';
      resetConfigCache();

      const res = await request(app)
        .post('/ftd-spi-employee/rest/catalogs/countries/list')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Country-Code', 'VE')
        .send({ page: 1, size: 5 })
        .expect(500);
      expect(res.body.message).toBe('Server misconfiguration');
    });

    it('health and /security/token stay exempt even under this misconfiguration', async () => {
      process.env.REQUIRE_ENCRYPTED_PAYLOAD = 'true';
      process.env.PAYLOAD_ENCRYPTION_KEY = '';
      resetConfigCache();

      await request(app).get('/health').expect(200);
      await request(app)
        .post('/ftd-spi-employee/rest/security/token')
        .send({ client_id: 'test-client', client_secret: 'test-secret' })
        .expect(200);
    });
  });
});
