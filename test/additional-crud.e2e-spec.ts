import request from 'supertest';
import { resetConfigCache } from '../src/config/configuration';

resetConfigCache();

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require('../src/index') as { app: import('express').Express };

describe('Additional CRUD e2e (FAKE_DB)', () => {
  let token: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/ftd-spi-employee/rest/security/token')
      .send({ client_id: 'test-client', client_secret: 'test-secret' });
    token = res.body.access_token;
  });

  const auth = (req: request.Test) =>
    req
      .set('Authorization', `Bearer ${token}`)
      .set('X-Country-Code', 'VE');

  describe('position', () => {
    it('create → 201', () =>
      auth(request(app).post('/ftd-spi-employee/rest/position/create'))
        .send({
          companyId: '1',
          id: '50',
          name: 'Analista',
          description: 'Análisis de procesos',
        })
        .expect(201)
        .expect(({ body }) => {
          expect(body).toEqual({
            companyId: '1',
            id: '50',
            message: 'OK',
          });
        }));

    it('get → 200', () =>
      auth(request(app).post('/ftd-spi-employee/rest/position/get'))
        .send({ companyId: '1', id: '50' })
        .expect(200)
        .expect(({ body }) => {
          expect(body.companyId).toBe('1');
          expect(body.id).toBe('50');
          expect(body.name).toBe('Analista');
        }));

    it('list → 200 with items', () =>
      auth(request(app).post('/ftd-spi-employee/rest/position/list'))
        .send({ page: 1, size: 20, companyId: '1' })
        .expect(200)
        .expect(({ body }) => {
          expect(body.page).toBe(1);
          expect(body.size).toBe(20);
          expect(Array.isArray(body.items)).toBe(true);
          expect(body.items.length).toBeGreaterThan(0);
        }));

    it('update → 200', () =>
      auth(request(app).post('/ftd-spi-employee/rest/position/update'))
        .send({ companyId: '1', id: '50', name: 'Analista Senior' })
        .expect(200)
        .expect(({ body }) => {
          expect(body.name).toBe('Analista Senior');
        }));

    it('duplicate create → 409', () =>
      auth(request(app).post('/ftd-spi-employee/rest/position/create'))
        .send({ companyId: '1', id: '50', name: 'Dup' })
        .expect(409));
  });

  describe('company', () => {
    it('list → 200', () =>
      auth(request(app).post('/ftd-spi-employee/rest/company/list'))
        .send({})
        .expect(200)
        .expect(({ body }) => {
          expect(body.items.length).toBeGreaterThan(0);
        }));

    it('get → 200', () =>
      auth(request(app).post('/ftd-spi-employee/rest/company/get'))
        .send({ id: '1' })
        .expect(200)
        .expect(({ body }) => {
          expect(body.id).toBe('1');
        }));
  });

  describe('marital-status', () => {
    it('list → 200', () =>
      auth(request(app).post('/ftd-spi-employee/rest/marital-status/list'))
        .send({})
        .expect(200)
        .expect(({ body }) => {
          expect(body.items.length).toBeGreaterThan(0);
        }));
  });

  describe('job-post', () => {
    it('list → 200', () =>
      auth(request(app).post('/ftd-spi-employee/rest/job-post/list'))
        .send({ companyId: '1' })
        .expect(200)
        .expect(({ body }) => {
          expect(body.items.length).toBeGreaterThan(0);
        }));

    it('get → 200', () =>
      auth(request(app).post('/ftd-spi-employee/rest/job-post/get'))
        .send({ companyId: '1', unitId: '10', id: '100' })
        .expect(200)
        .expect(({ body }) => {
          expect(body.id).toBe('100');
        }));
  });

  describe('org-unit', () => {
    it('list → 200', () =>
      auth(request(app).post('/ftd-spi-employee/rest/org-unit/list'))
        .send({ companyId: '1' })
        .expect(200)
        .expect(({ body }) => {
          expect(body.items.length).toBeGreaterThan(0);
        }));

    it('get → 200', () =>
      auth(request(app).post('/ftd-spi-employee/rest/org-unit/get'))
        .send({ companyId: '1', id: '10' })
        .expect(200)
        .expect(({ body }) => {
          expect(body.id).toBe('10');
        }));
  });
});
