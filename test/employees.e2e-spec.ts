import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
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
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] });
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
      .post('/api/v1/auth/token')
      .send({ client_id: 'test-client', client_secret: 'test-secret' });
    token = res.body.access_token;
  });

  afterAll(() => app.close());

  it('issues a token with 12h TTL', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/token')
      .send({ client_id: 'test-client', client_secret: 'test-secret' })
      .expect(200);
    expect(res.body.expires_in).toBe(43200);
    expect(res.body.token_type).toBe('Bearer');
  });

  it('wrong credentials → 401', () =>
    request(app.getHttpServer())
      .post('/api/v1/auth/token')
      .send({ client_id: 'test-client', client_secret: 'nope' })
      .expect(401));

  it('no token → 401', () =>
    request(app.getHttpServer())
      .get('/api/v1/employees/1')
      .set('X-Country-Code', 'VE')
      .expect(401));

  it('missing X-Country-Code → 400', () =>
    request(app.getHttpServer())
      .get('/api/v1/employees/1')
      .set('Authorization', `Bearer ${token}`)
      .expect(400));

  it('country not enabled → 422', () =>
    request(app.getHttpServer())
      .get('/api/v1/employees/1')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Country-Code', 'AR')
      .expect(422));

  it('valid POST → 201', () =>
    request(app.getHttpServer())
      .post('/api/v1/employees')
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
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Country-Code', 'VE')
      .send({ idNumber: '' })
      .expect(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
    expect(res.body).toMatchObject({
      statusCode: 400,
      path: '/api/v1/employees',
    });
  });

  it('GET by id → 200', () =>
    request(app.getHttpServer())
      .get('/api/v1/employees/12345678')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Country-Code', 'VE')
      .expect(200));

  it('GET list → 200 with pagination', () =>
    request(app.getHttpServer())
      .get('/api/v1/employees?page=1&size=20')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Country-Code', 'VE')
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ page: 1, size: 20 })));

  it('PUT → 200', () =>
    request(app.getHttpServer())
      .put('/api/v1/employees/12345678')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Country-Code', 'VE')
      .send({ firstName: 'ANA' })
      .expect(200));

  it('DELETE → 204', () =>
    request(app.getHttpServer())
      .delete('/api/v1/employees/12345678')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Country-Code', 'VE')
      .expect(204));

  it('health endpoints are public', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
    const ready = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200);
    expect(ready.body.countries).toEqual(['VE']);
  });
});
