# FTD SPI Employee API — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** API RESTful en NestJS para gestión de empleados SPI (CRUD), multi-tenant por header `X-Country-Code` (VE habilitado, AR/CO por configuración), JWT RS256 TTL 12h, desplegada en GCP Cloud Run.

**Architecture:** Un solo servicio NestJS con un connection pool `oracledb` por país creado al bootstrap; un middleware resuelve el tenant por header y el repositorio usa el pool del país. POST envuelve `corsox.pkg_management_employee.prc_crear_datos_basicos`; GET consulta `INFOCENT.EO_PERSONA`; DELETE es borrado lógico. Auth autocontenida: `POST /auth/token` firma RS256 con llaves de Secret Manager.

**Tech Stack:** Node 20 LTS, NestJS 10, TypeScript, `oracledb` (thin), `@nestjs/passport` + `passport-jwt` + `jsonwebtoken`, `class-validator`, `@nestjs/swagger`, Jest + supertest, Docker, Cloud Run, Cloud Build, Secret Manager, Serverless VPC Access.

**Spec:** `docs/superpowers/specs/2026-07-02-ftd-spi-employee-design.md`
**Raíz del proyecto:** `C:\Users\cerodriguez\Desktop\DOCUMENTACIONES\PERSONALES\ftd-spi-employee`

---

## Convenciones globales del plan

- Todos los comandos se ejecutan desde la raíz del proyecto salvo que se indique otra cosa.
- Commits pequeños y frecuentes con formato conventional commits (`feat:`, `test:`, `chore:`, `docs:`).
- TDD: en cada task primero el test que falla, luego la implementación mínima, luego verde, luego commit.
- El contrato exacto del DTO de creación se **cierra en la Task 0**; las Tasks 7–9 usan la firma asumida documentada allí y se ajustan con el resultado real.

---

### Task 0: Verificar la firma del PKG en la BD espejo (bloqueante para Tasks 7–9)

**Files:**
- Create: `docs/superpowers/specs/pkg-management-employee-firma.md` (resultado de la verificación)

El servicio no consulta `corsox.ftd_ingresos`; sus datos llegan como parámetros del request. Para cerrar el contrato hay que extraer la firma real del procedimiento.

- [ ] **Step 1: Conectarse a la BD espejo VE (SQL Developer / sqlplus) con las credenciales entregadas y ejecutar:**

```sql
-- Parámetros exactos del procedimiento de creación
SELECT argument_name, position, data_type, in_out, defaulted
FROM   all_arguments
WHERE  owner = 'CORSOX'
AND    package_name = 'PKG_MANAGEMENT_EMPLOYEE'
AND    object_name = 'PRC_CREAR_DATOS_BASICOS'
ORDER  BY position;

-- ¿Existen procedimientos de actualización / eliminación en el PKG?
SELECT DISTINCT object_name
FROM   all_arguments
WHERE  owner = 'CORSOX'
AND    package_name = 'PKG_MANAGEMENT_EMPLOYEE';

-- Código fuente de la especificación del paquete (comentarios y validaciones)
SELECT text
FROM   all_source
WHERE  owner = 'CORSOX'
AND    name  = 'PKG_MANAGEMENT_EMPLOYEE'
AND    type  = 'PACKAGE'
ORDER  BY line;

-- Columnas de la tabla de consulta
SELECT column_name, data_type, nullable
FROM   all_tab_columns
WHERE  owner = 'INFOCENT'
AND    table_name = 'EO_PERSONA'
ORDER  BY column_id;
```

- [ ] **Step 2: Documentar el resultado en `docs/superpowers/specs/pkg-management-employee-firma.md`** con: lista de parámetros (nombre, tipo, IN/OUT, obligatorio), procedimientos disponibles de update/delete, y columnas clave de `EO_PERSONA` (identificador, status, nombres).

- [ ] **Step 3: Ajustar la firma asumida.** Las Tasks 7–9 asumen esta firma de trabajo (basada en datos típicos de `ftd_ingresos`):

```
prc_crear_datos_basicos(
  p_cedula          IN VARCHAR2,   -- identificación
  p_nacionalidad    IN VARCHAR2,   -- V/E
  p_primer_nombre   IN VARCHAR2,
  p_segundo_nombre  IN VARCHAR2,   -- opcional
  p_primer_apellido IN VARCHAR2,
  p_segundo_apellido IN VARCHAR2,  -- opcional
  p_fecha_nacimiento IN DATE,
  p_sexo            IN VARCHAR2,   -- M/F
  p_codigo_resultado OUT NUMBER,
  p_mensaje          OUT VARCHAR2
)
```

Si la firma real difiere (lo esperable), actualizar: `CreateEmployeeDto` (Task 7), el diccionario `EMPLOYEE_FIELD_MAP` y los OUT binds del repositorio (Task 8), y los tests correspondientes. El contrato del API se mantiene en inglés; solo cambian los nombres de binds/columnas del lado Oracle. **No continuar con la Task 8 sin la firma real.**

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/pkg-management-employee-firma.md
git commit -m "docs: firma real de pkg_management_employee desde BD espejo VE"
```

---

### Task 1: Scaffold del proyecto

**Files:**
- Create: proyecto NestJS completo en la raíz, `.gitignore`, `.env.example`

- [ ] **Step 1: Generar el proyecto e iniciar git**

```bash
cd "C:\Users\cerodriguez\Desktop\DOCUMENTACIONES\PERSONALES"
npx --yes @nestjs/cli@10 new ftd-spi-employee --package-manager npm --skip-git
cd ftd-spi-employee
git init -b main
```

(Los docs de `docs/superpowers/` ya existen en la carpeta; conservarlos.)

- [ ] **Step 2: Instalar dependencias**

```bash
npm i oracledb @nestjs/passport passport passport-jwt jsonwebtoken @nestjs/config class-validator class-transformer @nestjs/swagger nestjs-pino pino-http
npm i -D @types/passport-jwt @types/jsonwebtoken supertest @types/supertest
```

- [ ] **Step 3: Crear `.env.example`**

```dotenv
# Server
PORT=8080

# JWT (en Cloud Run vienen de Secret Manager; local: llaves de desarrollo)
JWT_PRIVATE_KEY_BASE64=
JWT_PUBLIC_KEY_BASE64=
JWT_TTL_SECONDS=43200
JWT_ISSUER=ftd-spi-employee

# Clientes del API (JSON: [{"clientId":"...","secretHash":"..."}])
API_CLIENTS_JSON=[]

# Venezuela (único país habilitado en fase 1)
DB_VE_CONNECT_STRING=host:1521/SPI
DB_VE_USER=corsox
DB_VE_PASSWORD=
DB_VE_POOL_MIN=1
DB_VE_POOL_MAX=5

# Para habilitar AR/CO: agregar DB_AR_* / DB_CO_* (sin cambios de código)
```

- [ ] **Step 4: Agregar `.env` a `.gitignore`, verificar build y test base**

```bash
echo ".env" >> .gitignore
npm run build && npm test
```
Expected: build OK, test de ejemplo PASS.

- [ ] **Step 5: Configurar cobertura para SonarQube.** En `package.json`, sección `jest`, agregar:

```json
"collectCoverageFrom": ["src/**/*.ts", "!src/main.ts", "!src/**/*.module.ts", "!src/**/*.dto.ts"],
"coverageReporters": ["text", "lcov"],
"coverageThreshold": { "global": { "branches": 80, "functions": 80, "lines": 80, "statements": 80 } }
```

Crear `sonar-project.properties` en la raíz:

```properties
sonar.projectKey=ftd-spi-employee
sonar.projectName=FTD SPI Employee API
sonar.sources=src
sonar.tests=src,test
sonar.test.inclusions=**/*.spec.ts,**/*.e2e-spec.ts
sonar.exclusions=**/node_modules/**,**/dist/**,**/*.module.ts,src/main.ts
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.typescript.tsconfigPaths=tsconfig.json
```

Verificar: `npm test -- --coverage` genera `coverage/lcov.info`. (El umbral fallará mientras no exista código — es esperado; se valida verde a partir de la Task 9.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold NestJS ftd-spi-employee con dependencias base"
```

---

### Task 2: Módulo de configuración tipada

**Files:**
- Create: `src/config/configuration.ts`
- Create: `src/config/configuration.spec.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Test que falla** — `src/config/configuration.spec.ts`:

```typescript
import { buildConfig } from './configuration';

describe('buildConfig', () => {
  it('detecta países habilitados por presencia de variables DB_<CC>_*', () => {
    const cfg = buildConfig({
      DB_VE_CONNECT_STRING: 'h:1521/SPI', DB_VE_USER: 'u', DB_VE_PASSWORD: 'p',
      JWT_TTL_SECONDS: '43200',
    } as any);
    expect(cfg.countries).toEqual({
      VE: { connectString: 'h:1521/SPI', user: 'u', password: 'p', poolMin: 1, poolMax: 5 },
    });
    expect(cfg.jwt.ttlSeconds).toBe(43200);
  });

  it('ignora países sin configuración completa', () => {
    const cfg = buildConfig({ DB_AR_USER: 'u' } as any);
    expect(cfg.countries.AR).toBeUndefined();
  });
});
```

- [ ] **Step 2: Correr y ver fallo**: `npx jest src/config` → FAIL (módulo no existe).

- [ ] **Step 3: Implementación** — `src/config/configuration.ts`:

```typescript
const SUPPORTED = ['AR', 'CO', 'VE'] as const;
export type CountryCode = (typeof SUPPORTED)[number];

export interface CountryDbConfig {
  connectString: string; user: string; password: string;
  poolMin: number; poolMax: number;
}

export interface AppConfig {
  port: number;
  countries: Partial<Record<CountryCode, CountryDbConfig>>;
  jwt: { privateKey: string; publicKey: string; ttlSeconds: number; issuer: string };
  apiClients: Array<{ clientId: string; secretHash: string; countries?: string[] }>;
}

export function buildConfig(env: NodeJS.ProcessEnv): AppConfig {
  const countries: AppConfig['countries'] = {};
  for (const cc of SUPPORTED) {
    const cs = env[`DB_${cc}_CONNECT_STRING`], user = env[`DB_${cc}_USER`], pass = env[`DB_${cc}_PASSWORD`];
    if (cs && user && pass) {
      countries[cc] = {
        connectString: cs, user, password: pass,
        poolMin: Number(env[`DB_${cc}_POOL_MIN`] ?? 1),
        poolMax: Number(env[`DB_${cc}_POOL_MAX`] ?? 5),
      };
    }
  }
  return {
    port: Number(env.PORT ?? 8080),
    countries,
    jwt: {
      privateKey: Buffer.from(env.JWT_PRIVATE_KEY_BASE64 ?? '', 'base64').toString('utf8'),
      publicKey: Buffer.from(env.JWT_PUBLIC_KEY_BASE64 ?? '', 'base64').toString('utf8'),
      ttlSeconds: Number(env.JWT_TTL_SECONDS ?? 43200),
      issuer: env.JWT_ISSUER ?? 'ftd-spi-employee',
    },
    apiClients: JSON.parse(env.API_CLIENTS_JSON ?? '[]'),
  };
}

export default () => buildConfig(process.env);
```

- [ ] **Step 4: Registrar en `src/app.module.ts`** (`ConfigModule.forRoot({ isGlobal: true, load: [configuration] })`), correr `npx jest src/config` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config src/app.module.ts
git commit -m "feat: configuración tipada con detección de países por variables de entorno"
```

---

### Task 3: Formato de error estándar y filtro global de excepciones

**Files:**
- Create: `src/common/http-exception.filter.ts`, `src/common/http-exception.filter.spec.ts`

- [ ] **Step 1: Test que falla** — el filtro produce el cuerpo estándar del spec:

```typescript
import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';

function mockHost(path = '/ftd-spi-employee/rest/employee/create') {
  const json = jest.fn(); const status = jest.fn(() => ({ json }));
  return {
    host: { switchToHttp: () => ({ getResponse: () => ({ status }), getRequest: () => ({ url: path }) }) } as unknown as ArgumentsHost,
    status, json,
  };
}

describe('AllExceptionsFilter', () => {
  it('mapea HttpException al formato estándar', () => {
    const { host, status, json } = mockHost();
    new AllExceptionsFilter().catch(new BadRequestException(['cedula must not be empty']), host);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 400, message: 'Bad Request', errors: ['cedula must not be empty'],
      path: '/ftd-spi-employee/rest/employee/create', timestamp: expect.any(String),
    }));
  });

  it('mapea errores no controlados a 500 sin filtrar detalles', () => {
    const { host, status, json } = mockHost();
    new AllExceptionsFilter().catch(new Error('ORA-00942: table or view does not exist'), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 500, message: 'Internal server error' }));
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('ORA-00942');
  });
});
```

- [ ] **Step 2: Correr y ver fallo**: `npx jest src/common` → FAIL.

- [ ] **Step 3: Implementación** — `src/common/http-exception.filter.ts`:

```typescript
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse(); const req = ctx.getRequest();
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: string[] = [];

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse() as any;
      if (typeof body === 'string') message = body;
      else { message = body.error ?? body.message; errors = Array.isArray(body.message) ? body.message : []; }
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }
    res.status(statusCode).json({ statusCode, message, errors, timestamp: new Date().toISOString(), path: req.url });
  }
}
```

- [ ] **Step 4: Registrar en `src/main.ts`** (`app.useGlobalFilters(new AllExceptionsFilter())` y `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`, `app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] })`). Correr `npx jest src/common` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/common src/main.ts
git commit -m "feat: filtro global de excepciones con formato de error estándar"
```

---

### Task 4: Middleware de tenancy (X-Country-Code)

**Files:**
- Create: `src/tenancy/country.middleware.ts`, `src/tenancy/country.middleware.spec.ts`, `src/tenancy/tenancy.module.ts`

- [ ] **Step 1: Test que falla** — `src/tenancy/country.middleware.spec.ts`:

```typescript
import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { CountryMiddleware } from './country.middleware';

const mw = () => new CountryMiddleware({ get: () => ({ VE: {} }) } as any); // solo VE habilitado
const req = (h?: string) => ({ headers: h ? { 'x-country-code': h } : {} }) as any;

describe('CountryMiddleware', () => {
  it('header ausente → 400', () => {
    expect(() => mw().use(req(), {} as any, jest.fn())).toThrow(BadRequestException);
  });
  it('formato inválido → 400', () => {
    expect(() => mw().use(req('VEN'), {} as any, jest.fn())).toThrow(BadRequestException);
  });
  it('país válido pero no habilitado → 422', () => {
    expect(() => mw().use(req('AR'), {} as any, jest.fn())).toThrow(UnprocessableEntityException);
  });
  it('país habilitado → adjunta req.countryCode y llama next', () => {
    const r = req('ve'); const next = jest.fn();
    mw().use(r, {} as any, next);
    expect(r.countryCode).toBe('VE');
    expect(next).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr y ver fallo**: `npx jest src/tenancy` → FAIL.

- [ ] **Step 3: Implementación** — `src/tenancy/country.middleware.ts`:

```typescript
import { BadRequestException, Injectable, NestMiddleware, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const COUNTRY_HEADER = 'x-country-code';

@Injectable()
export class CountryMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(req: any, _res: any, next: () => void) {
    const raw = (req.headers[COUNTRY_HEADER] ?? '').toString().trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(raw)) {
      throw new BadRequestException(`Header ${COUNTRY_HEADER} is required (ISO 3166-1 alpha-2)`);
    }
    const enabled = this.config.get('countries') ?? {};
    if (!enabled[raw]) {
      throw new UnprocessableEntityException(`Country ${raw} not enabled`);
    }
    req.countryCode = raw;
    next();
  }
}
```

`src/tenancy/tenancy.module.ts` aplica el middleware a todas las rutas excepto `auth/token`, `health`, `health/ready`, `docs`:

```typescript
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CountryMiddleware } from './country.middleware';

@Module({})
export class TenancyModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CountryMiddleware)
      .exclude('api/v1/auth/(.*)', 'health', 'health/(.*)', 'docs')
      .forRoutes('*');
  }
}
```

- [ ] **Step 4: Correr** `npx jest src/tenancy` → PASS. Importar `TenancyModule` en `AppModule`.

- [ ] **Step 5: Commit**

```bash
git add src/tenancy src/app.module.ts
git commit -m "feat: middleware multi-tenant por header X-Country-Code"
```

---

### Task 5: Pools Oracle por país (TenantConnectionService)

**Files:**
- Create: `src/database/tenant-connection.service.ts`, `src/database/tenant-connection.service.spec.ts`, `src/database/database.module.ts`

- [ ] **Step 1: Test que falla** (con `oracledb` mockeado):

```typescript
jest.mock('oracledb', () => ({ createPool: jest.fn(async (o: any) => ({ alias: o.poolAlias, close: jest.fn() })) }));
import * as oracledb from 'oracledb';
import { TenantConnectionService } from './tenant-connection.service';

describe('TenantConnectionService', () => {
  const config = { get: () => ({ VE: { connectString: 'h/SPI', user: 'u', password: 'p', poolMin: 1, poolMax: 5 } }) } as any;

  it('crea un pool por país configurado al init', async () => {
    const svc = new TenantConnectionService(config);
    await svc.onModuleInit();
    expect(oracledb.createPool).toHaveBeenCalledWith(expect.objectContaining({
      poolAlias: 'VE', connectString: 'h/SPI', user: 'u', poolMin: 1, poolMax: 5,
    }));
    expect(svc.getPool('VE')).toBeDefined();
  });

  it('getPool de país sin pool lanza error', async () => {
    const svc = new TenantConnectionService(config);
    await svc.onModuleInit();
    expect(() => svc.getPool('AR')).toThrow();
  });
});
```

- [ ] **Step 2: Correr y ver fallo**: `npx jest src/database` → FAIL.

- [ ] **Step 3: Implementación** — `src/database/tenant-connection.service.ts`:

```typescript
import { Injectable, InternalServerErrorException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as oracledb from 'oracledb';

@Injectable()
export class TenantConnectionService implements OnModuleInit, OnModuleDestroy {
  private pools = new Map<string, oracledb.Pool>();

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const countries = this.config.get('countries') ?? {};
    for (const [cc, db] of Object.entries<any>(countries)) {
      const pool = await oracledb.createPool({
        poolAlias: cc, connectString: db.connectString, user: db.user, password: db.password,
        poolMin: db.poolMin, poolMax: db.poolMax,
      });
      this.pools.set(cc, pool);
    }
  }

  getPool(country: string): oracledb.Pool {
    const pool = this.pools.get(country);
    if (!pool) throw new InternalServerErrorException(`No hay pool para ${country}`);
    return pool;
  }

  enabledCountries(): string[] { return [...this.pools.keys()]; }

  async onModuleDestroy() {
    for (const pool of this.pools.values()) await pool.close(5);
  }
}
```

`src/database/database.module.ts`: módulo `@Global()` que provee y exporta `TenantConnectionService`.

- [ ] **Step 4: Correr** `npx jest src/database` → PASS. Importar en `AppModule`.

- [ ] **Step 5: Commit**

```bash
git add src/database src/app.module.ts
git commit -m "feat: pools oracledb por país con TenantConnectionService"
```

---

### Task 6: Autenticación — /auth/token y guard JWT RS256 global

**Files:**
- Create: `src/auth/auth.module.ts`, `src/auth/auth.controller.ts`, `src/auth/auth.service.ts`, `src/auth/jwt.strategy.ts`, `src/auth/jwt-auth.guard.ts`, `src/auth/dto/token-request.dto.ts`
- Test: `src/auth/auth.service.spec.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Generar llaves RSA de desarrollo** (solo local; en GCP van a Secret Manager):

```bash
mkdir -p keys && openssl genrsa -out keys/dev_private.pem 2048 && openssl rsa -in keys/dev_private.pem -pubout -out keys/dev_public.pem
echo "keys/" >> .gitignore
```

- [ ] **Step 2: Test que falla** — `src/auth/auth.service.spec.ts`:

```typescript
import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { AuthService } from './auth.service';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const secretHash = crypto.createHash('sha256').update('s3cret').digest('hex');
const config = {
  get: (k: string) => k === 'jwt'
    ? { privateKey, publicKey, ttlSeconds: 43200, issuer: 'ftd-spi-employee' }
    : [{ clientId: 'rrhh-app', secretHash, countries: ['VE'] }],
} as any;

describe('AuthService.issueToken', () => {
  it('emite JWT RS256 con exp = iat + 12h y claims correctos', () => {
    const res = new AuthService(config).issueToken('rrhh-app', 's3cret');
    expect(res.token_type).toBe('Bearer');
    expect(res.expires_in).toBe(43200);
    const decoded = jwt.verify(res.access_token, publicKey, { algorithms: ['RS256'] }) as any;
    expect(decoded.sub).toBe('rrhh-app');
    expect(decoded.iss).toBe('ftd-spi-employee');
    expect(decoded.countries).toEqual(['VE']);
    expect(decoded.exp - decoded.iat).toBe(43200);
  });

  it('credenciales inválidas → UnauthorizedException', () => {
    expect(() => new AuthService(config).issueToken('rrhh-app', 'wrong')).toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 3: Correr y ver fallo**: `npx jest src/auth` → FAIL.

- [ ] **Step 4: Implementación.** `src/auth/auth.service.ts`:

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  constructor(private readonly config: ConfigService) {}

  issueToken(clientId: string, clientSecret: string) {
    const clients = this.config.get('apiClients') ?? [];
    const hash = crypto.createHash('sha256').update(clientSecret).digest('hex');
    const client = clients.find((c: any) => c.clientId === clientId && c.secretHash === hash);
    if (!client) throw new UnauthorizedException('Invalid client credentials');

    const { privateKey, ttlSeconds, issuer } = this.config.get('jwt');
    const access_token = jwt.sign(
      { countries: client.countries ?? [] },
      privateKey,
      { algorithm: 'RS256', subject: clientId, issuer, expiresIn: ttlSeconds },
    );
    return { access_token, token_type: 'Bearer', expires_in: ttlSeconds };
  }
}
```

`src/auth/dto/token-request.dto.ts`:

```typescript
import { IsNotEmpty, IsString } from 'class-validator';
export class TokenRequestDto {
  @IsString() @IsNotEmpty() client_id: string;
  @IsString() @IsNotEmpty() client_secret: string;
}
```

`src/auth/auth.controller.ts`:

```typescript
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Public } from './public.decorator';
import { AuthService } from './auth.service';
import { TokenRequestDto } from './dto/token-request.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('token')
  @HttpCode(200)
  token(@Body() dto: TokenRequestDto) {
    return this.auth.issueToken(dto.client_id, dto.client_secret);
  }
}
```

`src/auth/public.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

`src/auth/jwt.strategy.ts` (algoritmo fijado a RS256):

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('jwt').publicKey,
      algorithms: ['RS256'],
      issuer: config.get('jwt').issuer,
    });
  }
  validate(payload: any) { return { clientId: payload.sub, countries: payload.countries ?? [] }; }
}
```

`src/auth/jwt-auth.guard.ts` (guard global que respeta `@Public()`):

```typescript
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) { super(); }
  canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    return isPublic ? true : super.canActivate(ctx);
  }
}
```

`src/auth/auth.module.ts` registra controller, service, strategy y provee `JwtAuthGuard` como `APP_GUARD`. Marcar `/health` con `@Public()` cuando exista (Task 10).

- [ ] **Step 5: Correr** `npx jest src/auth` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/auth src/app.module.ts .gitignore
git commit -m "feat: auth con /auth/token JWT RS256 TTL 12h y guard global"
```

---

### Task 7: DTOs de empleado con validación

**Files:**
- Create: `src/employees/dto/create-employee.dto.ts`, `src/employees/dto/update-employee.dto.ts`, `src/employees/dto/list-employees.query.ts`
- Test: `src/employees/dto/create-employee.dto.spec.ts`

> ⚠️ Ajustar campos al resultado real de la **Task 0** antes de implementar.

- [ ] **Step 1: Test que falla** (validación con class-validator):

```typescript
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEmployeeDto } from './create-employee.dto';

const valid = {
  idNumber: '12345678', nationality: 'V', firstName: 'MARIA', lastName: 'PEREZ',
  birthDate: '1990-05-14', gender: 'F',
};

describe('CreateEmployeeDto', () => {
  it('accepts a valid payload', async () => {
    expect(await validate(plainToInstance(CreateEmployeeDto, valid))).toHaveLength(0);
  });
  it('rejects empty idNumber and invalid gender', async () => {
    const errors = await validate(plainToInstance(CreateEmployeeDto, { ...valid, idNumber: '', gender: 'X' }));
    const props = errors.map(e => e.property);
    expect(props).toEqual(expect.arrayContaining(['idNumber', 'gender']));
  });
});
```

- [ ] **Step 2: Correr y ver fallo**: `npx jest src/employees/dto` → FAIL.

- [ ] **Step 3: Implementación** — `src/employees/dto/create-employee.dto.ts` (firma asumida de Task 0):

```typescript
import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateEmployeeDto {
  @IsString() @IsNotEmpty() @Matches(/^\d{5,10}$/) idNumber: string;
  @IsIn(['V', 'E']) nationality: string;
  @IsString() @IsNotEmpty() @MaxLength(50) firstName: string;
  @IsOptional() @IsString() @MaxLength(50) middleName?: string;
  @IsString() @IsNotEmpty() @MaxLength(50) lastName: string;
  @IsOptional() @IsString() @MaxLength(50) secondLastName?: string;
  @IsDateString() birthDate: string;
  @IsIn(['M', 'F']) gender: string;
}
```

`update-employee.dto.ts`: `export class UpdateEmployeeDto extends PartialType(OmitType(CreateEmployeeDto, ['idNumber'] as const)) {}` (importar `PartialType`, `OmitType` de `@nestjs/swagger`).

`list-employees.query.ts`:

```typescript
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
export class ListEmployeesQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) size = 20;
}
```

- [ ] **Step 4: Correr** `npx jest src/employees/dto` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/employees/dto
git commit -m "feat: DTOs de empleado con validación class-validator"
```

---

### Task 8: Repositorio Oracle (PKG + consultas EO_PERSONA + mapeo de errores)

**Files:**
- Create: `src/employees/employee-field.map.ts` (diccionario campo API → bind PKG → columna)
- Create: `src/employees/employees.repository.ts`
- Test: `src/employees/employees.repository.spec.ts`

> ⚠️ Los binds del PKG y los nombres de columnas de `EO_PERSONA` se ajustan con el resultado de la **Task 0**.

- [ ] **Step 1: Test que falla** (conexión mockeada):

```typescript
import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { EmployeesRepository } from './employees.repository';

function mockPool(executeImpl: jest.Mock) {
  const conn = { execute: executeImpl, close: jest.fn() };
  return { getConnection: jest.fn(async () => conn) } as any;
}
const tenantSvc = (pool: any) => ({ getPool: () => pool }) as any;
const dto = {
  idNumber: '12345678', nationality: 'V', firstName: 'MARIA', lastName: 'PEREZ',
  birthDate: '1990-05-14', gender: 'F',
} as any;

describe('EmployeesRepository', () => {
  it('create llama al PKG con binds derivados del FIELD_MAP y retorna el resultado OUT', async () => {
    const execute = jest.fn(async () => ({ outBinds: { p_result_code: 0, p_message: 'OK' } }));
    const repo = new EmployeesRepository(tenantSvc(mockPool(execute)));
    await repo.create('VE', dto);
    expect(execute.mock.calls[0][0]).toContain('corsox.pkg_management_employee.prc_crear_datos_basicos');
    expect(execute.mock.calls[0][1]).toMatchObject({ p_cedula: '12345678', p_primer_nombre: 'MARIA' });
  });

  it('findById mapea columnas Oracle a campos del API en inglés', async () => {
    const execute = jest.fn(async () => ({ rows: [{ CEDULA: '12345678', PRIMER_NOMBRE: 'MARIA', SEXO: 'F' }] }));
    const repo = new EmployeesRepository(tenantSvc(mockPool(execute)));
    const emp = await repo.findById('VE', '12345678');
    expect(emp).toMatchObject({ idNumber: '12345678', firstName: 'MARIA', gender: 'F' });
    expect(emp).not.toHaveProperty('CEDULA');
  });

  it('ORA-00001 (duplicado) → ConflictException', async () => {
    const execute = jest.fn(async () => { throw Object.assign(new Error('unique'), { errorNum: 1 }); });
    const repo = new EmployeesRepository(tenantSvc(mockPool(execute)));
    await expect(repo.create('VE', dto)).rejects.toThrow(ConflictException);
  });

  it('RAISE_APPLICATION_ERROR -20xxx → UnprocessableEntityException con mensaje del PKG', async () => {
    const execute = jest.fn(async () => { throw Object.assign(new Error('ORA-20001: id already registered'), { errorNum: 20001 }); });
    const repo = new EmployeesRepository(tenantSvc(mockPool(execute)));
    await expect(repo.create('VE', dto)).rejects.toThrow(UnprocessableEntityException);
  });
});
```

- [ ] **Step 2: Correr y ver fallo**: `npx jest src/employees/employees.repository` → FAIL.

- [ ] **Step 3: Implementación.** Primero el diccionario de mapeo — `src/employees/employee-field.map.ts` — **única fuente de verdad** campo API → bind PKG → columna. Agregar un atributo nuevo = 1 campo en el DTO + 1 entrada aquí; binds, PL/SQL, UPDATE y mapeo de respuesta se derivan solos:

```typescript
export interface FieldMapping {
  bind: string;      // nombre del parámetro del PKG
  column: string;    // columna en INFOCENT.EO_PERSONA
  updatable?: boolean;
  sqlExpr?: string;  // expresión SQL para el bind (ej: TO_DATE)
}

// Binds y columnas asumidos — ajustar con el resultado de la Task 0
export const EMPLOYEE_FIELD_MAP: Record<string, FieldMapping> = {
  idNumber:       { bind: 'p_cedula',           column: 'CEDULA' },
  nationality:    { bind: 'p_nacionalidad',     column: 'NACIONALIDAD',    updatable: true },
  firstName:      { bind: 'p_primer_nombre',    column: 'PRIMER_NOMBRE',   updatable: true },
  middleName:     { bind: 'p_segundo_nombre',   column: 'SEGUNDO_NOMBRE',  updatable: true },
  lastName:       { bind: 'p_primer_apellido',  column: 'PRIMER_APELLIDO', updatable: true },
  secondLastName: { bind: 'p_segundo_apellido', column: 'SEGUNDO_APELLIDO', updatable: true },
  birthDate:      { bind: 'p_fecha_nacimiento', column: 'FECHA_NACIMIENTO', updatable: true,
                    sqlExpr: "TO_DATE(:p_fecha_nacimiento, 'YYYY-MM-DD')" },
  gender:         { bind: 'p_sexo',             column: 'SEXO',            updatable: true },
};

export function rowToEmployee(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [field, m] of Object.entries(EMPLOYEE_FIELD_MAP)) {
    if (row[m.column] !== undefined) out[field] = row[m.column];
  }
  return out;
}
```

Luego `src/employees/employees.repository.ts`, que genera todo desde el mapa:

```typescript
import { ConflictException, Injectable, InternalServerErrorException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import * as oracledb from 'oracledb';
import { TenantConnectionService } from '../database/tenant-connection.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EMPLOYEE_FIELD_MAP, rowToEmployee } from './employee-field.map';

const PKG_CREATE = 'corsox.pkg_management_employee.prc_crear_datos_basicos';

@Injectable()
export class EmployeesRepository {
  constructor(private readonly tenants: TenantConnectionService) {}

  private async withConn<T>(country: string, fn: (c: oracledb.Connection) => Promise<T>): Promise<T> {
    const conn = await this.tenants.getPool(country).getConnection();
    try { return await fn(conn); }
    catch (e) { throw this.mapOracleError(e); }
    finally { await conn.close(); }
  }

  async create(country: string, dto: CreateEmployeeDto) {
    return this.withConn(country, async (conn) => {
      // Argumentos y binds generados desde EMPLOYEE_FIELD_MAP
      const entries = Object.entries(EMPLOYEE_FIELD_MAP);
      const args = entries
        .map(([, m]) => `${m.bind} => ${m.sqlExpr ?? `:${m.bind}`}`)
        .concat(['p_result_code => :p_result_code', 'p_message => :p_message'])
        .join(', ');
      const binds: Record<string, unknown> = {
        p_result_code: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        p_message: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 },
      };
      for (const [field, m] of entries) binds[m.bind] = (dto as any)[field] ?? null;

      const result = await conn.execute(
        `BEGIN ${PKG_CREATE}(${args}); END;`, binds, { autoCommit: true },
      );
      const out = result.outBinds as any;
      if (out.p_result_code !== 0) throw new UnprocessableEntityException(out.p_message);
      return { idNumber: dto.idNumber, message: out.p_message };
    });
  }

  async findById(country: string, idNumber: string) {
    return this.withConn(country, async (conn) => {
      const r = await conn.execute(
        `SELECT * FROM infocent.eo_persona WHERE cedula = :idNumber`,
        { idNumber }, { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      const rows = r.rows as any[];
      if (!rows?.length) throw new NotFoundException(`Employee ${idNumber} not found`);
      return rowToEmployee(rows[0]);
    });
  }

  async findAll(country: string, page: number, size: number) {
    return this.withConn(country, async (conn) => {
      const r = await conn.execute(
        `SELECT * FROM infocent.eo_persona ORDER BY cedula
         OFFSET :off ROWS FETCH NEXT :lim ROWS ONLY`,
        { off: (page - 1) * size, lim: size }, { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      return { page, size, items: (r.rows as any[]).map(rowToEmployee) };
    });
  }

  // PUT/DELETE: si Task 0 encontró procedimientos del PKG, envolverlos igual que create()
  // (estándar FTD: PKG-first). Fallback documentado en el spec: UPDATE controlado / borrado lógico.
  async update(country: string, idNumber: string, dto: UpdateEmployeeDto) {
    return this.withConn(country, async (conn) => {
      const sets: string[] = []; const binds: Record<string, unknown> = { idNumber };
      for (const [field, m] of Object.entries(EMPLOYEE_FIELD_MAP)) {
        if (m.updatable && (dto as any)[field] !== undefined) {
          sets.push(`${m.column} = :${field}`); binds[field] = (dto as any)[field];
        }
      }
      if (!sets.length) throw new UnprocessableEntityException('Nothing to update');
      const r = await conn.execute(
        `UPDATE infocent.eo_persona SET ${sets.join(', ')} WHERE cedula = :idNumber`,
        binds, { autoCommit: true },
      );
      if (!r.rowsAffected) throw new NotFoundException(`Employee ${idNumber} not found`);
      return this.findById(country, idNumber);
    });
  }

  async softDelete(country: string, idNumber: string) {
    return this.withConn(country, async (conn) => {
      const r = await conn.execute(
        `UPDATE infocent.eo_persona SET status = 'I' WHERE cedula = :idNumber`, // columna status: ajustar con Task 0
        { idNumber }, { autoCommit: true },
      );
      if (!r.rowsAffected) throw new NotFoundException(`Employee ${idNumber} not found`);
    });
  }

  private mapOracleError(e: any): Error {
    if (e instanceof ConflictException || e instanceof NotFoundException || e instanceof UnprocessableEntityException) return e;
    if (e?.errorNum === 1) return new ConflictException('Employee already exists');
    if (e?.errorNum >= 20000 && e?.errorNum <= 20999) {
      return new UnprocessableEntityException(String(e.message).replace(/^ORA-\d+:\s*/, ''));
    }
    return new InternalServerErrorException();
  }
}
```

Nota: los nombres de los OUT binds (`p_result_code`/`p_message`) también se ajustan a los reales del PKG en la Task 0 (probablemente `p_codigo_resultado`/`p_mensaje`).

- [ ] **Step 4: Correr** `npx jest src/employees/employees.repository` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/employees/employee-field.map.ts src/employees/employees.repository.ts src/employees/employees.repository.spec.ts
git commit -m "feat: Oracle repository driven by EMPLOYEE_FIELD_MAP with PKG create and error mapping"
```

---

### Task 9: Service + Controller CRUD con e2e

**Files:**
- Create: `src/employees/employees.service.ts`, `src/employees/employees.controller.ts`, `src/employees/employees.module.ts`
- Test: `test/employees.e2e-spec.ts`

- [ ] **Step 1: Service y controller** (el service delega al repositorio; el controller define rutas y códigos):

`src/employees/employees.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { EmployeesRepository } from './employees.repository';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly repo: EmployeesRepository) {}
  create(country: string, dto: CreateEmployeeDto) { return this.repo.create(country, dto); }
  findById(country: string, cedula: string) { return this.repo.findById(country, cedula); }
  findAll(country: string, page: number, size: number) { return this.repo.findAll(country, page, size); }
  update(country: string, cedula: string, dto: UpdateEmployeeDto) { return this.repo.update(country, cedula, dto); }
  remove(country: string, cedula: string) { return this.repo.softDelete(country, cedula); }
}
```

`src/employees/employees.controller.ts`:

```typescript
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { ListEmployeesQuery } from './dto/list-employees.query';
import { EmployeesService } from './employees.service';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly svc: EmployeesService) {}

  @Post() create(@Req() req: any, @Body() dto: CreateEmployeeDto) {
    return this.svc.create(req.countryCode, dto); // Nest responde 201 por defecto en POST
  }
  @Get(':id') findOne(@Req() req: any, @Param('id') id: string) {
    return this.svc.findById(req.countryCode, id);
  }
  @Get() findAll(@Req() req: any, @Query() q: ListEmployeesQuery) {
    return this.svc.findAll(req.countryCode, q.page, q.size);
  }
  @Put(':id') update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.svc.update(req.countryCode, id, dto);
  }
  @Delete(':id') @HttpCode(204) remove(@Req() req: any, @Param('id') id: string) {
    return this.svc.remove(req.countryCode, id);
  }
}
```

`employees.module.ts` declara controller, service y repository. Importar en `AppModule`.

- [ ] **Step 2: Test e2e que falla** — `test/employees.e2e-spec.ts` (repo mockeado, auth y tenancy reales):

```typescript
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/http-exception.filter';
import { EmployeesRepository } from '../src/employees/employees.repository';

describe('Employees e2e', () => {
  let app: INestApplication;
  let token: string;
  const repoMock = {
    create: jest.fn(async (_c, d) => ({ idNumber: d.idNumber, message: 'OK' })),
    findById: jest.fn(async () => ({ idNumber: '12345678' })),
    findAll: jest.fn(async () => ({ page: 1, size: 20, items: [] })),
    update: jest.fn(async () => ({ idNumber: '12345678' })),
    softDelete: jest.fn(async () => undefined),
  };

  beforeAll(async () => {
    // Variables de entorno de test: llaves RSA generadas, cliente de prueba, VE "configurado"
    // (setear process.env.* ANTES de compilar el módulo — ver jest e2e setup)
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmployeesRepository).useValue(repoMock)
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    const res = await request(app.getHttpServer()).post('/ftd-spi-employee/rest/security/token')
      .send({ client_id: 'test-client', client_secret: 'test-secret' });
    token = res.body.access_token;
  });
  afterAll(() => app.close());

  it('sin token → 401', () =>
    request(app.getHttpServer()).get('/ftd-spi-employee/rest/employee/create/1').set('X-Country-Code', 'VE').expect(401));

  it('sin X-Country-Code → 400', () =>
    request(app.getHttpServer()).get('/ftd-spi-employee/rest/employee/create/1')
      .set('Authorization', `Bearer ${token}`).expect(400));

  it('país no habilitado → 422', () =>
    request(app.getHttpServer()).get('/ftd-spi-employee/rest/employee/create/1')
      .set('Authorization', `Bearer ${token}`).set('X-Country-Code', 'AR').expect(422));

  it('POST válido → 201', () =>
    request(app.getHttpServer()).post('/ftd-spi-employee/rest/employee/create')
      .set('Authorization', `Bearer ${token}`).set('X-Country-Code', 'VE')
      .send({ idNumber: '12345678', nationality: 'V', firstName: 'MARIA', lastName: 'PEREZ', birthDate: '1990-05-14', gender: 'F' })
      .expect(201));

  it('POST con body inválido → 400 con errores por campo', async () => {
    const res = await request(app.getHttpServer()).post('/ftd-spi-employee/rest/employee/create')
      .set('Authorization', `Bearer ${token}`).set('X-Country-Code', 'VE')
      .send({ idNumber: '' }).expect(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('DELETE → 204', () =>
    request(app.getHttpServer()).delete('/ftd-spi-employee/rest/employee/create/12345678')
      .set('Authorization', `Bearer ${token}`).set('X-Country-Code', 'VE').expect(204));
});
```

Nota de setup: crear `test/setup-e2e.ts` que genere el par de llaves con `crypto.generateKeyPairSync`, setee `JWT_PRIVATE_KEY_BASE64`, `JWT_PUBLIC_KEY_BASE64`, `API_CLIENTS_JSON` (cliente `test-client`/hash de `test-secret` con `countries:["VE"]`) y `DB_VE_*` dummy; referenciarlo en `test/jest-e2e.json` con `setupFiles`. El `TenantConnectionService` no debe crear pools reales en e2e: sobreescribirlo también con `.overrideProvider(TenantConnectionService).useValue({ getPool: () => ({}) , enabledCountries: () => ['VE'] })` si el mock del repo no basta.

- [ ] **Step 3: Correr y ver fallo**: `npm run test:e2e` → FAIL primero, ajustar hasta que la app compile con los módulos de Tasks 2–8.

- [ ] **Step 4: Correr todo verde**: `npm test && npm run test:e2e` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/employees test/
git commit -m "feat: CRUD de empleados con e2e de auth, tenancy y validación"
```

---

### Task 10: Health checks y Swagger

**Files:**
- Create: `src/health/health.controller.ts`, `src/health/health.controller.spec.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Test que falla**:

```typescript
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('live retorna ok', () => {
    expect(new HealthController({ enabledCountries: () => ['VE'] } as any).live()).toEqual({ status: 'ok' });
  });
  it('ready incluye países con pool', () => {
    expect(new HealthController({ enabledCountries: () => ['VE'] } as any).ready())
      .toEqual({ status: 'ok', countries: ['VE'] });
  });
});
```

- [ ] **Step 2: Implementación** — `src/health/health.controller.ts`:

```typescript
import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { TenantConnectionService } from '../database/tenant-connection.service';

@Controller('health')
export class HealthController {
  constructor(private readonly tenants: TenantConnectionService) {}
  @Public() @Get() live() { return { status: 'ok' }; }
  @Public() @Get('ready') ready() { return { status: 'ok', countries: this.tenants.enabledCountries() }; }
}
```

- [ ] **Step 3: Swagger en `src/main.ts`**:

```typescript
const swaggerCfg = new DocumentBuilder()
  .setTitle('FTD SPI Employee API').setVersion('1.0')
  .addBearerAuth()
  .addGlobalParameters({ name: 'X-Country-Code', in: 'header', required: true, schema: { type: 'string', example: 'VE' } })
  .build();
SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerCfg));
```

- [ ] **Step 4: Correr** `npx jest src/health && npm run build` → PASS. Arrancar local (`npm run start:dev`) y verificar `GET /health` → 200 y `/docs` carga.

- [ ] **Step 5: Commit**

```bash
git add src/health src/main.ts
git commit -m "feat: health checks y documentación Swagger"
```

---

### Task 11: Docker + Cloud Build

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `cloudbuild.yaml`

- [ ] **Step 1: `Dockerfile`** (multi-stage, thin mode de oracledb no necesita Instant Client):

```dockerfile
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 8080
CMD ["node", "dist/main.js"]
```

`.dockerignore`: `node_modules`, `dist`, `.env`, `keys/`, `docs/`, `test/`, `.git`.

- [ ] **Step 2: `cloudbuild.yaml`**:

```yaml
steps:
  - name: node:20
    entrypoint: bash
    args: ['-c', 'npm ci && npm run lint && npm test']
  - name: gcr.io/cloud-builders/docker
    args: ['build', '-t', '${_REGION}-docker.pkg.dev/$PROJECT_ID/apis/ftd-spi-employee:$SHORT_SHA', '.']
  - name: gcr.io/cloud-builders/docker
    args: ['push', '${_REGION}-docker.pkg.dev/$PROJECT_ID/apis/ftd-spi-employee:$SHORT_SHA']
  - name: gcr.io/google.com/cloudsdktool/cloud-sdk
    entrypoint: gcloud
    args:
      - run; deploy; ftd-spi-employee
      - --image=${_REGION}-docker.pkg.dev/$PROJECT_ID/apis/ftd-spi-employee:$SHORT_SHA
      - --region=${_REGION}
      - --vpc-connector=${_VPC_CONNECTOR}
      - --min-instances=1
      - --set-secrets=JWT_PRIVATE_KEY_BASE64=jwt-private-key:latest,JWT_PUBLIC_KEY_BASE64=jwt-public-key:latest,DB_VE_PASSWORD=db-ve-password:latest,API_CLIENTS_JSON=api-clients:latest
      - --set-env-vars=DB_VE_CONNECT_STRING=${_DB_VE_CONNECT_STRING},DB_VE_USER=${_DB_VE_USER}
substitutions:
  _REGION: us-east1
  _VPC_CONNECTOR: spi-connector
  _DB_VE_CONNECT_STRING: ''
  _DB_VE_USER: ''
```

(Nota: en el paso de deploy los `args` van uno por línea — la lista real del YAML usa un item por flag; el `;` de arriba es ilustrativo de items separados `run`, `deploy`, `ftd-spi-employee`.)

- [ ] **Step 3: Verificar build local de la imagen**

```bash
docker build -t ftd-spi-employee:local .
docker run --rm -p 8080:8080 --env-file .env ftd-spi-employee:local
```
Expected: contenedor arranca; `curl http://localhost:8080/health` → `{"status":"ok"}`.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile .dockerignore cloudbuild.yaml
git commit -m "chore: Dockerfile multi-stage y pipeline Cloud Build para Cloud Run"
```

---

### Task 12: Infraestructura GCP y prueba de integración contra BD espejo VE

**Files:**
- Create: `docs/deploy/gcp-setup.md`, `postman/ftd-spi-employee.postman_collection.json`

- [ ] **Step 1: Documentar y ejecutar el setup GCP** en `docs/deploy/gcp-setup.md` (coordinar con infra los valores reales):

```bash
# 1. Artifact Registry
gcloud artifacts repositories create apis --repository-format=docker --location=us-east1

# 2. Secretos
openssl genrsa -out private.pem 2048 && openssl rsa -in private.pem -pubout -out public.pem
base64 -w0 private.pem | gcloud secrets create jwt-private-key --data-file=-
base64 -w0 public.pem  | gcloud secrets create jwt-public-key  --data-file=-
gcloud secrets create db-ve-password --data-file=<(echo -n "$DB_VE_PASSWORD")
gcloud secrets create api-clients    --data-file=api-clients.json  # [{"clientId":"...","secretHash":"sha256(secret)","countries":["VE"]}]

# 3. Serverless VPC Access (prerequisito para alcanzar la BD SPI espejo — validar red/CIDR con el equipo de redes)
gcloud compute networks vpc-access connectors create spi-connector \
  --region=us-east1 --network=default --range=10.8.0.0/28

# 4. Primer deploy
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_DB_VE_CONNECT_STRING="host:1521/SPI",_DB_VE_USER="corsox"
```

- [ ] **Step 2: Crear la colección Postman** con: `POST /auth/token`, y los 5 endpoints CRUD con `Authorization: Bearer {{token}}` y `X-Country-Code: VE`, más casos negativos (sin token → 401, sin header → 400, `X-Country-Code: AR` → 422, body inválido → 400). Guardarla en `postman/`.

- [ ] **Step 3: Prueba de integración contra la BD espejo VE** (local con `.env` apuntando al espejo, o contra el servicio ya desplegado):
  1. `POST /auth/token` → 200 con `expires_in: 43200`.
  2. `POST /employees` con un empleado de prueba → 201 (verificar en BD el registro creado por el PKG).
  3. `GET /employees/{cedula}` → 200 con los datos.
  4. `PUT` y `DELETE` → según lo encontrado en Task 0.
  5. Repetir el POST con la misma cédula → 409/422 según respuesta del PKG.

- [ ] **Step 4: Registrar los resultados** (esto alimenta el Self QA del equipo — usar la skill selfqa-generator con la colección Postman y las evidencias).

- [ ] **Step 5: Commit final**

```bash
git add docs/deploy postman/
git commit -m "docs: setup GCP, colección Postman y evidencias de integración VE"
```

---

## Resumen de verificación final

- [ ] `npm run lint && npm test -- --coverage && npm run test:e2e` — todo verde, cobertura ≥ 80% (quality gate SonarQube) y `coverage/lcov.info` generado.
- [ ] `docker build` OK y `/health` responde en el contenedor.
- [ ] Deploy en Cloud Run responde `/health` y `/docs` públicos, resto exige JWT.
- [ ] Flujo completo Postman contra espejo VE documentado.
- [ ] Cobertura de las 5 premisas: GCP/Cloud Run (T11–12), JWT RS256 12h (T6), X-Country-Code multi-tenant (T4–5), REST/códigos/JSON (T3, T9), PKG y parámetros obligatorios sin consultar ftd_ingresos (T0, T7–8).
