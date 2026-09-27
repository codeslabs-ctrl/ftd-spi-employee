import request from 'supertest';
import { resetConfigCache } from '../src/config/configuration';

resetConfigCache();

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require('../src/index') as { app: import('express').Express };

/**
 * Pedido de PeopleOne (correo Andros/Raymond 2026-09-23): poblar un
 * comboBox contra un endpoint paginado no es viable — no saben si hay más
 * datos. Se agrega `paginate` (default true, no rompe a nadie) a TODOS los
 * endpoints de listado: cuando es false, ignora page/size y devuelve todo.
 */
describe('paginate flag on list endpoints (PeopleOne 2026-09-23)', () => {
  let token: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/ftd-spi-employee/rest/security/token')
      .send({ client_id: 'test-client', client_secret: 'test-secret' });
    token = res.body.access_token;
  });

  const auth = (req: request.Test) =>
    req.set('Authorization', `Bearer ${token}`).set('X-Country-Code', 'VE');

  it('default (no paginate sent) behaves exactly like before: paginated, page/size honored', () =>
    auth(request(app).post('/ftd-spi-employee/rest/catalogs/countries/list'))
      .send({ page: 1, size: 1 })
      .expect(200)
      .expect(({ body }) => {
        expect(body.page).toBe(1);
        expect(body.size).toBe(1);
        expect(body.paginate).toBe(true);
        expect(body.items.length).toBeLessThanOrEqual(1);
      }));

  it('paginate=false on a catalog ignores page/size and returns everything', () =>
    auth(request(app).post('/ftd-spi-employee/rest/catalogs/countries/list'))
      .send({ page: 1, size: 1, paginate: false })
      .expect(200)
      .expect(({ body }) => {
        expect(body.paginate).toBe(false);
        expect(Array.isArray(body.items)).toBe(true);
        expect(body.items.length).toBeGreaterThan(1);
        expect(body.size).toBe(body.items.length);
      }));

  it('paginate=false works with string "false" too (form/querystring clients, not just JSON booleans)', () =>
    auth(request(app).post('/ftd-spi-employee/rest/catalogs/countries/list'))
      .type('form')
      .send({ paginate: 'false' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.paginate).toBe(false);
      }));

  it('paginate=false on employee/list returns all employees in one shot', () =>
    auth(request(app).post('/ftd-spi-employee/rest/employee/list'))
      .send({ page: 1, size: 1, paginate: false })
      .expect(200)
      .expect(({ body }) => {
        expect(body.paginate).toBe(false);
        expect(Array.isArray(body.items)).toBe(true);
      }));

  it('paginate=false on company/list returns all companies in one shot', () =>
    auth(request(app).post('/ftd-spi-employee/rest/company/list'))
      .send({ paginate: false })
      .expect(200)
      .expect(({ body }) => {
        expect(body.paginate).toBe(false);
        expect(Array.isArray(body.items)).toBe(true);
        expect(body.items.length).toBeGreaterThan(0);
      }));

  it('paginate=false on position/list (with companyId filter) still respects the filter', async () => {
    await auth(request(app).post('/ftd-spi-employee/rest/position/create'))
      .send({ companyId: '1', id: 'PF1', name: 'Cajero' })
      .expect(201);
    await auth(request(app).post('/ftd-spi-employee/rest/position/create'))
      .send({ companyId: '1', id: 'PF2', name: 'Supervisor' })
      .expect(201);

    return auth(request(app).post('/ftd-spi-employee/rest/position/list'))
      .send({ companyId: '1', paginate: false })
      .expect(200)
      .expect(({ body }) => {
        expect(body.paginate).toBe(false);
        expect(body.items.length).toBeGreaterThanOrEqual(2);
        expect(
          body.items.every((it: { companyId: string }) => it.companyId === '1'),
        ).toBe(true);
      });
  });

  it('paginate=false on marital-status/list returns all in one shot', () =>
    auth(request(app).post('/ftd-spi-employee/rest/marital-status/list'))
      .send({ paginate: false })
      .expect(200)
      .expect(({ body }) => {
        expect(body.paginate).toBe(false);
        expect(Array.isArray(body.items)).toBe(true);
      }));

  it('an invalid paginate value (not a recognizable boolean-ish string) still resolves rather than 400ing', () =>
    // toBooleanDefaultTrue treats unknown truthy strings as true — documenting
    // the behavior rather than rejecting, since class-validator only runs
    // @IsBoolean() AFTER the @Transform already coerced it to a real boolean.
    auth(request(app).post('/ftd-spi-employee/rest/catalogs/countries/list'))
      .send({ paginate: 'yes' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.paginate).toBe(true);
      }));
});
