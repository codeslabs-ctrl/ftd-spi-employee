import * as CryptoJS from 'crypto-js';
import request from 'supertest';
import { resetConfigCache } from '../src/config/configuration';

// Env is set in setup-e2e.ts before this file loads
resetConfigCache();

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require('../src/index') as { app: import('express').Express };

describe('Employees e2e (Express SPI contracts)', () => {
  let token: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/ftd-spi-employee/rest/security/token')
      .send({ client_id: 'test-client', client_secret: 'test-secret' });
    token = res.body.access_token;
  });

  it('issues a token with frozen contract shape', async () => {
    const res = await request(app)
      .post('/ftd-spi-employee/rest/security/token')
      .send({ client_id: 'test-client', client_secret: 'test-secret' })
      .expect(200);
    expect(res.body).toEqual({
      access_token: expect.any(String),
      token_type: 'Bearer',
      expires_in: 43200,
    });
  });

  it('wrong credentials → 401', () =>
    request(app)
      .post('/ftd-spi-employee/rest/security/token')
      .send({ client_id: 'test-client', client_secret: 'nope' })
      .expect(401));

  it('no token → 401', () =>
    request(app)
      .post('/ftd-spi-employee/rest/employee/get')
      .set('X-Country-Code', 'VE')
      .send({ idNumber: '1' })
      .expect(401));

  it('missing X-Country-Code → 400', () =>
    request(app)
      .post('/ftd-spi-employee/rest/employee/get')
      .set('Authorization', `Bearer ${token}`)
      .send({ idNumber: '1' })
      .expect(400));

  it('country not enabled → 422', () =>
    request(app)
      .post('/ftd-spi-employee/rest/employee/get')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Country-Code', 'AR')
      .send({ idNumber: '1' })
      .expect(422));

  it('token not authorized for the requested country → 403', async () => {
    const coRes = await request(app)
      .post('/ftd-spi-employee/rest/security/token')
      .send({ client_id: 'co-client', client_secret: 'co-secret' });
    await request(app)
      .post('/ftd-spi-employee/rest/employee/get')
      .set('Authorization', `Bearer ${coRes.body.access_token}`)
      .set('X-Country-Code', 'VE')
      .send({ idNumber: '12345678' })
      .expect(403);
  });

  it('valid POST → 201 frozen create shape', () =>
    request(app)
      .post('/ftd-spi-employee/rest/employee/create')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Country-Code', 'VE')
      .send({
        idNumber: '12345678',
        nationality: 'V',
        firstName: 'MARIA',
        lastName: 'PEREZ',
        birthDate: '1990-05-14',
        gender: 'F',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({ idNumber: '12345678', message: 'OK' });
        expect(body).not.toHaveProperty('cod');
      }));

  it('invalid POST body → 400 with frozen error envelope', async () => {
    const res = await request(app)
      .post('/ftd-spi-employee/rest/employee/create')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Country-Code', 'VE')
      .send({ idNumber: '' })
      .expect(400);
    expect(res.body).toEqual({
      statusCode: 400,
      message: expect.any(String),
      errors: expect.any(Array),
      timestamp: expect.any(String),
      path: '/ftd-spi-employee/rest/employee/create',
    });
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('POST search → 200 employee object', () =>
    request(app)
      .post('/ftd-spi-employee/rest/employee/get')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Country-Code', 'VE')
      .send({ idNumber: '12345678' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.idNumber).toBe('12345678');
        expect(body).not.toHaveProperty('cod');
      }));

  it('POST list → 200 frozen page shape', () =>
    request(app)
      .post('/ftd-spi-employee/rest/employee/list')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Country-Code', 'VE')
      .send({ page: 1, size: 20 })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ page: 1, size: 20 });
        expect(Array.isArray(body.items)).toBe(true);
      }));

  it('POST update → 200', () =>
    request(app)
      .post('/ftd-spi-employee/rest/employee/update')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Country-Code', 'VE')
      .send({ idNumber: '12345678', firstName: 'ANA' })
      .expect(200));

  it('POST delete → 204 empty body', async () => {
    const res = await request(app)
      .post('/ftd-spi-employee/rest/employee/delete')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Country-Code', 'VE')
      .send({ idNumber: '12345678' })
      .expect(204);
    expect(res.body).toEqual({});
  });

  it('health endpoints are public with frozen shapes', async () => {
    const live = await request(app).get('/health').expect(200);
    expect(live.body).toEqual({ status: 'ok' });
    const ready = await request(app).get('/health/ready').expect(200);
    expect(ready.body.status).toBe('ok');
    expect(ready.body.countries).toEqual(
      expect.arrayContaining(['VE', 'CO']),
    );
  });

  it('accepts encrypted RequestJson and returns encrypted ResponseJson', async () => {
    const KEY = 'e2e-shared-key';
    const employee = {
      idNumber: '55555555',
      nationality: 'VENEZOLANO',
      firstName: 'PEDRO',
      lastName: 'GOMEZ',
      birthDate: '1988-03-10',
      gender: 'M',
    };
    const cipher = CryptoJS.AES.encrypt(
      JSON.stringify(employee),
      KEY,
    ).toString();

    const res = await request(app)
      .post('/ftd-spi-employee/rest/employee/create')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Country-Code', 'VE')
      .type('form')
      .send({ RequestJson: cipher })
      .expect(201);

    expect(Object.keys(res.body)).toEqual(['ResponseJson']);
    const clear = JSON.parse(
      CryptoJS.AES.decrypt(res.body.ResponseJson, KEY).toString(
        CryptoJS.enc.Utf8,
      ),
    );
    expect(clear).toEqual({ idNumber: '55555555', message: 'OK' });
  });

  it('rejects an invalid encrypted payload with frozen 400 envelope', async () => {
    const res = await request(app)
      .post('/ftd-spi-employee/rest/employee/create')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Country-Code', 'VE')
      .type('form')
      .send({ RequestJson: 'not-a-valid-cipher' })
      .expect(400);
    expect(res.body).toEqual({
      statusCode: 400,
      message: expect.any(String),
      errors: expect.any(Array),
      timestamp: expect.any(String),
      path: '/ftd-spi-employee/rest/employee/create',
    });
  });
});
