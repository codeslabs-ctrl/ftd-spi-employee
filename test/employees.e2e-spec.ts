import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as CryptoJS from 'crypto-js';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/http-exception.filter';
import { TenantConnectionService } from '../src/database/tenant-connection.service';
import { EmployeesRepository } from '../src/employees/employees.repository';

describe('Employees e2e', () => {
  let app: INestApplication;
  let token: string;

  const repoMock = {
    create: jest.fn(async (_c: string, d: { idNumber: string }) => ({
      idNumber: d.idNumber,
      message: 'OK',
    })),
    findById: jest.fn(async () => ({ idNumber: '12345678' })),
    findAll: jest.fn(async () => ({ page: 1, size: 20, items: [] })),
    update: jest.fn(async () => ({ idNumber: '12345678' })),
    softDelete: jest.fn(async () => undefined),
  };

  const tenantsMock = {
    getPool: () => ({}),
    enabledCountries: () => ['VE'],
    onModuleInit: async () => undefined,
    onModuleDestroy: async () => undefined,
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmployeesRepository)
      .useValue(repoMock)
      .overrideProvider(TenantConnectionService)
      .useValue(tenantsMock)
      .compile();

    app = mod.createNestApplication();
    app.setGlobalPrefix('ftd-spi-employee/rest', { exclude: ['health', 'health/ready'] });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    const res = await request(app.getHttpServer())
      .post('/ftd-spi-employee/rest/security/token')
      .send({ client_id: 'test-client', client_secret: 'test-secret' });
    token = res.body.access_token;
  });

  afterAll(() => app.close());

  it('issues a token with 12h TTL', async () => {
    const res = await request(app.getHttpServer())
      .post('/ftd-spi-employee/rest/security/token')
      .send({ client_id: 'test-client', client_secret: 'test-secret' })
      .expect(200);
    expect(res.body.expires_in).toBe(43200);
    expect(res.body.token_type).toBe('Bearer');
  });

  it('wrong credentials → 401', () =>
    request(app.getHttpServer())
      .post('/ftd-spi-employee/rest/security/token')
      .send({ client_id: 'test-client', client_secret: 'nope' })
      .expect(401));

  it('no token → 401', () =>
    request(app.getHttpServer())
      .post('/ftd-spi-employee/rest/employee/get')
      .set('X-Country-Code', 'VE')
      .send({ idNumber: '1' })
      .expect(401));

  it('missing X-Country-Code → 400', () =>
    request(app.getHttpServer())
      .post('/ftd-spi-employee/rest/employee/get')
      .set('Authorization', `Bearer ${token}`)
      .send({ idNumber: '1' })
      .expect(400));

  it('country not enabled → 422', () =>
    request(app.getHttpServer())
      .post('/ftd-spi-employee/rest/employee/get')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Country-Code', 'AR')
      .send({ idNumber: '1' })
      .expect(422));

  it('token not authorized for the requested country → 403', async () => {
    const coRes = await request(app.getHttpServer())
      .post('/ftd-spi-employee/rest/security/token')
      .send({ client_id: 'co-client', client_secret: 'co-secret' });
    await request(app.getHttpServer())
      .post('/ftd-spi-employee/rest/employee/get')
      .set('Authorization', `Bearer ${coRes.body.access_token}`)
      .set('X-Country-Code', 'VE')
      .send({ idNumber: '12345678' })
      .expect(403);
  });

  it('valid POST → 201', () =>
    request(app.getHttpServer())
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
      .expect(({ body }) =>
        expect(body).toEqual({ idNumber: '12345678', message: 'OK' }),
      ));

  it('invalid POST body → 400 with per-field errors', async () => {
    const res = await request(app.getHttpServer())
      .post('/ftd-spi-employee/rest/employee/create')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Country-Code', 'VE')
      .send({ idNumber: '' })
      .expect(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
    expect(res.body).toMatchObject({
      statusCode: 400,
      path: '/ftd-spi-employee/rest/employee/create',
    });
  });

  it('POST search (id in body) → 200', () =>
    request(app.getHttpServer())
      .post('/ftd-spi-employee/rest/employee/get')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Country-Code', 'VE')
      .send({ idNumber: '12345678' })
      .expect(200));

  it('POST list (pagination in body) → 200', () =>
    request(app.getHttpServer())
      .post('/ftd-spi-employee/rest/employee/list')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Country-Code', 'VE')
      .send({ page: 1, size: 20 })
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ page: 1, size: 20 })));

  it('POST update (id in body) → 200', () =>
    request(app.getHttpServer())
      .post('/ftd-spi-employee/rest/employee/update')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Country-Code', 'VE')
      .send({ idNumber: '12345678', firstName: 'ANA' })
      .expect(200));

  it('POST delete (id in body) → 204', () =>
    request(app.getHttpServer())
      .post('/ftd-spi-employee/rest/employee/delete')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Country-Code', 'VE')
      .send({ idNumber: '12345678' })
      .expect(204));

  it('health endpoints are public', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
    const ready = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200);
    expect(ready.body.countries).toEqual(['VE']);
  });

  it('accepts an encrypted RequestJson and returns an encrypted ResponseJson', async () => {
    const KEY = 'e2e-shared-key'; // matches setup-e2e PAYLOAD_ENCRYPTION_KEY
    const employee = {
      idNumber: '55555555',
      nationality: 'VENEZOLANO',
      firstName: 'CARLOS',
      lastName: 'RODRIGUEZ',
      birthDate: '1988-03-10',
      gender: 'M',
    };
    const cipher = CryptoJS.AES.encrypt(
      JSON.stringify(employee),
      KEY,
    ).toString();
    expect(cipher.startsWith('U2FsdGVkX1')).toBe(true);

    const res = await request(app.getHttpServer())
      .post('/ftd-spi-employee/rest/employee/create')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Country-Code', 'VE')
      .type('form')
      .send({ RequestJson: cipher })
      .expect(201);

    expect(res.body.ResponseJson).toBeDefined();
    const clear = JSON.parse(
      CryptoJS.AES.decrypt(res.body.ResponseJson, KEY).toString(
        CryptoJS.enc.Utf8,
      ),
    );
    expect(clear).toEqual({ idNumber: '55555555', message: 'OK' });
  });

  it('rejects an invalid encrypted payload with 400', () =>
    request(app.getHttpServer())
      .post('/ftd-spi-employee/rest/employee/create')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Country-Code', 'VE')
      .type('form')
      .send({ RequestJson: 'not-a-valid-cipher' })
      .expect(400));
});
