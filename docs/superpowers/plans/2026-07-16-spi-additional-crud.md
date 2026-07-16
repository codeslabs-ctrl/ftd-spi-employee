# SPI Additional CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five SPI resources (position, company, marital-status, job-post, org-unit) reusing the exact `employees/` module pattern (PKG-first, multi-tenant, P2C crypto, English contract, Sonar ≥80%).

**Architecture:** Each resource is a self-contained NestJS module mirroring `src/employees/`: DTOs + (for writes) a declarative field map + an Oracle repository calling a configurable PKG via `callPkg` (`I_JSON CLOB → O_JSON/O_COD/O_MESSAGE`) + an in-memory repository for `FAKE_DB` + service + controller + module. Global guards (`JwtAuthGuard`→`CountryGuard`) and `PayloadCryptoInterceptor` already apply to every new controller — no changes to auth/crypto/tenancy.

**Tech Stack:** NestJS 10, Node 20, TypeScript, oracledb (thin), class-validator, Jest.

**Conventions (match employees exactly):**
- Repositories are self-contained (each has its own `withConn`/`readLob`/`callPkg`/`assertPkgSuccess`), just like `EmployeesRepository`. We intentionally do NOT introduce a shared base class — the user asked to keep it identical to how employees was built.
- All PKG defaults are unqualified package names (resolved in the connection schema `people_one`, where the employee PKG also lives).
- Every module uses the `FAKE_DB` factory from `employees.module.ts`.
- Run tests from the project root: `cd C:/Users/cerodriguez/Desktop/DOCUMENTACIONES/PERSONALES/ftd-spi-employee`.

---

## Task 1: Configuration — five PKG names

**Files:**
- Modify: `src/config/configuration.ts`
- Modify: `src/config/configuration.spec.ts`
- Modify: `.env.example`

- [ ] **Step 1: Write the failing test**

Add to `src/config/configuration.spec.ts` (inside the existing top-level `describe`):

```ts
it('defaults the new resource PKG names (unqualified, people_one schema)', () => {
  const cfg = buildConfig({} as NodeJS.ProcessEnv);
  expect(cfg.positionPkg).toBe('pkg_management_position');
  expect(cfg.companyPkg).toBe('pkg_management_company');
  expect(cfg.maritalStatusPkg).toBe('pkg_management_marital_status');
  expect(cfg.jobPostPkg).toBe('pkg_management_job_post');
  expect(cfg.orgUnitPkg).toBe('pkg_management_org_unit');
});

it('overrides resource PKG names from env', () => {
  const cfg = buildConfig({ POSITION_PKG: 'x.pkg_pos' } as unknown as NodeJS.ProcessEnv);
  expect(cfg.positionPkg).toBe('x.pkg_pos');
});
```

If `buildConfig` is not already imported in that spec, add: `import { buildConfig } from './configuration';`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- configuration.spec`
Expected: FAIL — `cfg.positionPkg` is `undefined`.

- [ ] **Step 3: Add the fields to the AppConfig interface**

In `src/config/configuration.ts`, extend the `AppConfig` interface after `pkgNoRecordsCode: string;`:

```ts
  // Per-resource PKG names (unqualified — resolved in the people_one schema).
  positionPkg: string;
  companyPkg: string;
  maritalStatusPkg: string;
  jobPostPkg: string;
  orgUnitPkg: string;
```

- [ ] **Step 4: Populate them in buildConfig**

In the returned object of `buildConfig`, after `pkgNoRecordsCode: env.PKG_NORECORDS_CODE ?? 'FTD-201',` add:

```ts
    positionPkg: env.POSITION_PKG ?? 'pkg_management_position',
    companyPkg: env.COMPANY_PKG ?? 'pkg_management_company',
    maritalStatusPkg: env.MARITAL_STATUS_PKG ?? 'pkg_management_marital_status',
    jobPostPkg: env.JOB_POST_PKG ?? 'pkg_management_job_post',
    orgUnitPkg: env.ORG_UNIT_PKG ?? 'pkg_management_org_unit',
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- configuration.spec`
Expected: PASS.

- [ ] **Step 6: Document the vars in .env.example**

In `.env.example`, right after the `PKG_NORECORDS_CODE=FTD-201` line, add:

```dotenv

# Per-resource PKG names. Se despliegan en el mismo esquema que el de Employee
# (people_one), por eso van sin prefijo de esquema. Un paquete por dominio.
POSITION_PKG=pkg_management_position
COMPANY_PKG=pkg_management_company
MARITAL_STATUS_PKG=pkg_management_marital_status
JOB_POST_PKG=pkg_management_job_post
ORG_UNIT_PKG=pkg_management_org_unit
```

- [ ] **Step 7: Commit**

```bash
git add src/config/configuration.ts src/config/configuration.spec.ts .env.example
git commit -m "feat(config): add per-resource PKG names for new SPI CRUD"
```

---

## Task 2: position resource (create / update / get / list)

`position` is the only new resource with writes. It is the template; the read-only resources in later tasks are trimmed copies of this repository.

**Files:**
- Create: `src/positions/position-field.map.ts`
- Create: `src/positions/dto/create-position.dto.ts`
- Create: `src/positions/dto/update-position.dto.ts`
- Create: `src/positions/dto/get-position.dto.ts`
- Create: `src/positions/dto/list-positions.query.ts`
- Create: `src/positions/positions.repository.ts`
- Create: `src/positions/in-memory-positions.repository.ts`
- Create: `src/positions/positions.service.ts`
- Create: `src/positions/positions.controller.ts`
- Create: `src/positions/positions.module.ts`
- Create tests: `*.spec.ts` alongside each
- Modify: `src/app.module.ts` (register `PositionsModule`)

- [ ] **Step 1: Field map**

Create `src/positions/position-field.map.ts`:

```ts
// API fields exchanged with the position PKG as JSON (I_JSON / O_JSON).
// Adding an attribute = one entry here + one DTO field + the matching JSON key in the PKG.
// Key columns: ID_EMPRESA (companyId) + ID (id).
export const POSITION_JSON_FIELDS = [
  'companyId', // ID_EMPRESA
  'id', // ID
  'name', // NOMBRE
  'classificationId', // ID_CLASIFICA
  'parentPositionId', // ID_CARGO_SUP
  'description', // DESCRIP
  'functions', // FUNCION
  'purpose', // PROPOSITO
  'risk', // RIESGO
] as const;

export type PositionJsonField = (typeof POSITION_JSON_FIELDS)[number];

export function toPositionPayload(dto: object): Record<string, unknown> {
  const source = dto as Record<string, unknown>;
  const payload: Record<string, unknown> = {};
  for (const field of POSITION_JSON_FIELDS) {
    if (source[field] !== undefined) payload[field] = source[field];
  }
  return payload;
}
```

- [ ] **Step 2: DTOs**

Create `src/positions/dto/create-position.dto.ts`:

```ts
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// Field lengths match the cargos table (see db/pkg_management_position_api.sql).
export class CreatePositionDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9A-Za-z-]{1,4}$/)
  companyId: string; // ID_EMPRESA

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  id: string; // ID

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string; // NOMBRE

  @IsOptional()
  @IsString()
  @MaxLength(10)
  classificationId?: string; // ID_CLASIFICA

  @IsOptional()
  @IsString()
  @MaxLength(10)
  parentPositionId?: string; // ID_CARGO_SUP

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  description?: string; // DESCRIP

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  functions?: string; // FUNCION

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  purpose?: string; // PROPOSITO

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  risk?: string; // RIESGO
}
```

Create `src/positions/dto/update-position.dto.ts` (same construction as `UpdateEmployeeDto` — `@nestjs/swagger` helpers, NOT `@nestjs/mapped-types`, which is not a dependency). companyId + id form the key and stay required; everything else optional:

```ts
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger';
import { CreatePositionDto } from './create-position.dto';

// Body for position/update: composite key (companyId + id) required, the rest optional.
export class UpdatePositionDto extends IntersectionType(
  PickType(CreatePositionDto, ['companyId', 'id'] as const),
  PartialType(OmitType(CreatePositionDto, ['companyId', 'id'] as const)),
) {}
```

Create `src/positions/dto/get-position.dto.ts`:

```ts
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

// Body for position/get — composite key in the body, never in the URL.
export class GetPositionDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9A-Za-z-]{1,4}$/)
  companyId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  id: string;
}
```

Create `src/positions/dto/list-positions.query.ts`:

```ts
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Matches, Max, Min } from 'class-validator';

// Positions are always listed within a company.
export class ListPositionsQuery {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9A-Za-z-]{1,4}$/)
  companyId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size = 20;
}
```

- [ ] **Step 3: Repository (write the failing test first)**

Create `src/positions/positions.repository.spec.ts`:

```ts
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PositionsRepository } from './positions.repository';

// A fake connection whose execute() returns queued PKG outBinds in order.
function fakeConn(outputs: Array<Record<string, unknown>>) {
  let i = 0;
  return {
    execute: jest.fn(async () => ({ outBinds: outputs[i++] })),
    close: jest.fn(async () => undefined),
  };
}

function repoWith(conn: unknown) {
  const tenants = { getPool: () => ({ getConnection: async () => conn }) } as any;
  const config = {
    get: (k: string) =>
      ({
        positionPkg: 'pkg_management_position',
        pkgSuccessCode: 'FTD-200',
        pkgNoRecordsCode: 'FTD-201',
      })[k],
  } as unknown as ConfigService;
  return new PositionsRepository(tenants, config);
}

describe('PositionsRepository', () => {
  it('findByKey returns the first position on success', async () => {
    const conn = fakeConn([
      {
        o_json: JSON.stringify({ positions: [{ companyId: '1', id: 'C1', name: 'DEV' }] }),
        o_cod: 'FTD-200',
        o_message: 'OK',
      },
    ]);
    const repo = repoWith(conn);
    const res = await repo.findByKey('VE', '1', 'C1');
    expect(res).toMatchObject({ id: 'C1', name: 'DEV' });
  });

  it('findByKey throws 404 when the PKG reports no records', async () => {
    const conn = fakeConn([{ o_json: null, o_cod: 'FTD-201', o_message: 'no data' }]);
    const repo = repoWith(conn);
    await expect(repo.findByKey('VE', '1', 'zzz')).rejects.toThrow(NotFoundException);
  });

  it('findAll returns an empty list on the no-records code', async () => {
    const conn = fakeConn([{ o_json: null, o_cod: 'FTD-201', o_message: 'no data' }]);
    const repo = repoWith(conn);
    const res = await repo.findAll('VE', '1', 1, 20);
    expect(res).toEqual({ companyId: '1', page: 1, size: 20, items: [] });
  });

  it('create returns the key and the PKG message', async () => {
    const conn = fakeConn([{ o_cod: 'FTD-200', o_message: 'TRANSACCION EXITOSA' }]);
    const repo = repoWith(conn);
    const res = await repo.create('VE', { companyId: '1', id: 'C1', name: 'DEV' } as any);
    expect(res).toEqual({ companyId: '1', id: 'C1', message: 'TRANSACCION EXITOSA' });
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test -- positions.repository.spec`
Expected: FAIL — cannot find module `./positions.repository`.

- [ ] **Step 5: Implement the repository**

Create `src/positions/positions.repository.ts`:

```ts
import {
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as oracledb from 'oracledb';
import { TenantConnectionService } from '../database/tenant-connection.service';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { toPositionPayload } from './position-field.map';

interface PkgResult {
  json: string | null;
  cod: string;
  message: string;
}

@Injectable()
export class PositionsRepository {
  private readonly logger = new Logger(PositionsRepository.name);
  private readonly pkg: string;
  private readonly successCode: string;
  private readonly noRecordsCode: string;

  constructor(
    private readonly tenants: TenantConnectionService,
    private readonly config: ConfigService,
  ) {
    this.pkg = this.config.get<string>('positionPkg') ?? 'pkg_management_position';
    this.successCode = this.config.get<string>('pkgSuccessCode') ?? 'FTD-200';
    this.noRecordsCode = this.config.get<string>('pkgNoRecordsCode') ?? 'FTD-201';
  }

  private async withConn<T>(
    country: string,
    fn: (conn: oracledb.Connection) => Promise<T>,
  ): Promise<T> {
    const conn = await this.tenants.getPool(country).getConnection();
    try {
      return await fn(conn);
    } catch (e) {
      throw this.mapOracleError(e);
    } finally {
      await conn.close();
    }
  }

  private async readLob(value: unknown): Promise<string | null> {
    if (value == null) return null;
    if (typeof value === 'string') return value;
    return (value as oracledb.Lob).getData() as Promise<string>;
  }

  private async callPkg(
    conn: oracledb.Connection,
    procedure: string,
    inJson: Record<string, unknown>,
    withOutJson: boolean,
  ): Promise<PkgResult> {
    const outJsonArg = withOutJson ? 'o_json => :o_json, ' : '';
    const binds: oracledb.BindParameters = {
      i_json: JSON.stringify(inJson),
      o_cod: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 100 },
      o_message: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 },
      ...(withOutJson
        ? { o_json: { dir: oracledb.BIND_OUT, type: oracledb.CLOB } }
        : {}),
    };
    const result = await conn.execute(
      `BEGIN ${this.pkg}.${procedure}(i_json => :i_json, ${outJsonArg}o_cod => :o_cod, o_message => :o_message); END;`,
      binds,
      { autoCommit: true },
    );
    const out = result.outBinds as {
      o_json?: unknown;
      o_cod: string;
      o_message: string;
    };
    return {
      json: withOutJson ? await this.readLob(out.o_json) : null,
      cod: String(out.o_cod),
      message: out.o_message,
    };
  }

  private static readonly DATA_ERROR_CODES = new Set([
    -1, -1400, -2290, -2291, -2292, -12899,
  ]);

  private assertPkgSuccess(res: PkgResult, notFoundOnNoRecords = false): void {
    if (res.cod === this.successCode) return;
    this.logger.warn(`PKG ${res.cod}: ${res.message}`);
    if (res.cod === this.noRecordsCode) {
      if (notFoundOnNoRecords) throw new NotFoundException(res.message);
      throw new UnprocessableEntityException(res.message);
    }
    if (res.cod.startsWith('ORA-')) {
      const sqlcode = Number(res.cod.replace(/^ORA-/, ''));
      if (
        (sqlcode <= -20000 && sqlcode >= -20999) ||
        PositionsRepository.DATA_ERROR_CODES.has(sqlcode)
      ) {
        throw new UnprocessableEntityException(
          String(res.message ?? '').replace(/^[A-Z_]+ - /, ''),
        );
      }
      throw new InternalServerErrorException();
    }
    throw new UnprocessableEntityException(res.message);
  }

  private parseItems(json: string | null): Record<string, unknown>[] {
    if (!json) return [];
    return (JSON.parse(json).positions ?? []) as Record<string, unknown>[];
  }

  async create(country: string, dto: CreatePositionDto) {
    return this.withConn(country, async (conn) => {
      const res = await this.callPkg(
        conn,
        'prc_merge_position',
        { positions: [toPositionPayload(dto)] },
        false,
      );
      this.assertPkgSuccess(res);
      return { companyId: dto.companyId, id: dto.id, message: res.message };
    });
  }

  async findByKey(country: string, companyId: string, id: string) {
    return this.withConn(country, async (conn) => {
      const res = await this.callPkg(conn, 'prc_get_position', { companyId, id }, true);
      this.assertPkgSuccess(res, true);
      const items = this.parseItems(res.json);
      if (!items.length) throw new NotFoundException(`Position ${id} not found`);
      return items[0];
    });
  }

  async findAll(country: string, companyId: string, page: number, size: number) {
    return this.withConn(country, async (conn) => {
      const res = await this.callPkg(
        conn,
        'prc_get_position',
        { companyId, page, size },
        true,
      );
      if (res.cod === this.noRecordsCode)
        return { companyId, page, size, items: [] };
      this.assertPkgSuccess(res);
      return { companyId, page, size, items: this.parseItems(res.json) };
    });
  }

  async update(country: string, dto: UpdatePositionDto) {
    return this.withConn(country, async (conn) => {
      const existing = await this.callPkg(
        conn,
        'prc_get_position',
        { companyId: dto.companyId, id: dto.id },
        true,
      );
      this.assertPkgSuccess(existing, true);
      if (!this.parseItems(existing.json).length)
        throw new NotFoundException(`Position ${dto.id} not found`);
      const res = await this.callPkg(
        conn,
        'prc_merge_position',
        { positions: [toPositionPayload(dto)] },
        false,
      );
      this.assertPkgSuccess(res);
      const updated = await this.callPkg(
        conn,
        'prc_get_position',
        { companyId: dto.companyId, id: dto.id },
        true,
      );
      this.assertPkgSuccess(updated, true);
      return this.parseItems(updated.json)[0];
    });
  }

  private mapOracleError(e: unknown): Error {
    if (e instanceof HttpException) return e;
    const ora = e as { errorNum?: number; message?: string };
    if (ora?.errorNum === 1)
      return new ConflictException('Position already exists');
    if (ora?.errorNum && ora.errorNum >= 20000 && ora.errorNum <= 20999) {
      return new UnprocessableEntityException(
        String(ora.message ?? '').replace(/^ORA-\d+:\s*/, ''),
      );
    }
    return new InternalServerErrorException();
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- positions.repository.spec`
Expected: PASS (4 tests).

- [ ] **Step 7: In-memory repository + its test**

Create `src/positions/in-memory-positions.repository.spec.ts`:

```ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import { InMemoryPositionsRepository } from './in-memory-positions.repository';

const dto = { companyId: '1', id: 'C1', name: 'DEV' } as any;

describe('InMemoryPositionsRepository', () => {
  let repo: InMemoryPositionsRepository;
  beforeEach(() => (repo = new InMemoryPositionsRepository()));

  it('creates and retrieves by composite key', async () => {
    await repo.create('VE', dto);
    expect(await repo.findByKey('VE', '1', 'C1')).toMatchObject({ name: 'DEV' });
  });

  it('rejects duplicates with 409', async () => {
    await repo.create('VE', dto);
    await expect(repo.create('VE', dto)).rejects.toThrow(ConflictException);
  });

  it('findByKey of unknown id → 404', async () => {
    await expect(repo.findByKey('VE', '1', 'zzz')).rejects.toThrow(NotFoundException);
  });

  it('lists within a company', async () => {
    await repo.create('VE', dto);
    const res = await repo.findAll('VE', '1', 1, 20);
    expect(res.items).toHaveLength(1);
  });

  it('updates an existing position', async () => {
    await repo.create('VE', dto);
    const updated = await repo.update('VE', { companyId: '1', id: 'C1', name: 'LEAD' } as any);
    expect(updated).toMatchObject({ name: 'LEAD' });
  });
});
```

Create `src/positions/in-memory-positions.repository.ts`:

```ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { toPositionPayload } from './position-field.map';

// Dev/demo-only stub. Activated when FAKE_DB=true.
@Injectable()
export class InMemoryPositionsRepository {
  private readonly store = new Map<string, Record<string, unknown>>();

  private key(country: string, companyId: string, id: string) {
    return `${country}:${companyId}:${id}`;
  }

  async create(country: string, dto: CreatePositionDto) {
    const k = this.key(country, dto.companyId, dto.id);
    if (this.store.has(k)) throw new ConflictException('Position already exists');
    this.store.set(k, toPositionPayload(dto));
    return { companyId: dto.companyId, id: dto.id, message: 'TRANSACCION EXITOSA' };
  }

  async findByKey(country: string, companyId: string, id: string) {
    const item = this.store.get(this.key(country, companyId, id));
    if (!item) throw new NotFoundException(`Position ${id} not found`);
    return item;
  }

  async findAll(country: string, companyId: string, page: number, size: number) {
    const prefix = `${country}:${companyId}:`;
    const items = [...this.store.entries()]
      .filter(([k]) => k.startsWith(prefix))
      .map(([, v]) => v);
    const start = (page - 1) * size;
    return { companyId, page, size, items: items.slice(start, start + size) };
  }

  async update(country: string, dto: UpdatePositionDto) {
    const existing = await this.findByKey(country, dto.companyId, dto.id);
    const merged = { ...existing, ...toPositionPayload(dto) };
    this.store.set(this.key(country, dto.companyId, dto.id), merged);
    return merged;
  }
}
```

- [ ] **Step 8: Run the in-memory test**

Run: `npm test -- in-memory-positions.repository.spec`
Expected: PASS (5 tests).

- [ ] **Step 9: Service + controller + their tests**

Create `src/positions/positions.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { PositionsRepository } from './positions.repository';

@Injectable()
export class PositionsService {
  constructor(private readonly repo: PositionsRepository) {}

  create(country: string, dto: CreatePositionDto) {
    return this.repo.create(country, dto);
  }

  findByKey(country: string, companyId: string, id: string) {
    return this.repo.findByKey(country, companyId, id);
  }

  findAll(country: string, companyId: string, page: number, size: number) {
    return this.repo.findAll(country, companyId, page, size);
  }

  update(country: string, dto: UpdatePositionDto) {
    return this.repo.update(country, dto);
  }
}
```

Create `src/positions/positions.controller.ts`:

```ts
import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CreatePositionDto } from './dto/create-position.dto';
import { GetPositionDto } from './dto/get-position.dto';
import { ListPositionsQuery } from './dto/list-positions.query';
import { UpdatePositionDto } from './dto/update-position.dto';
import { PositionsService } from './positions.service';

interface TenantRequest {
  countryCode: string;
}

@ApiBearerAuth()
@Controller('position')
export class PositionsController {
  constructor(private readonly svc: PositionsService) {}

  @Post('create')
  create(@Req() req: TenantRequest, @Body() dto: CreatePositionDto) {
    return this.svc.create(req.countryCode, dto);
  }

  @Post('get')
  @HttpCode(200)
  get(@Req() req: TenantRequest, @Body() dto: GetPositionDto) {
    return this.svc.findByKey(req.countryCode, dto.companyId, dto.id);
  }

  @Post('list')
  @HttpCode(200)
  list(@Req() req: TenantRequest, @Body() dto: ListPositionsQuery) {
    return this.svc.findAll(req.countryCode, dto.companyId, dto.page, dto.size);
  }

  @Post('update')
  @HttpCode(200)
  update(@Req() req: TenantRequest, @Body() dto: UpdatePositionDto) {
    return this.svc.update(req.countryCode, dto);
  }
}
```

Create `src/positions/positions.controller.spec.ts`:

```ts
import { PositionsController } from './positions.controller';
import { PositionsService } from './positions.service';

describe('PositionsController', () => {
  const svc = {
    create: jest.fn(),
    findByKey: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
  } as unknown as PositionsService;
  const controller = new PositionsController(svc);
  const req = { countryCode: 'VE' };

  it('create passes tenant and body', () => {
    const dto = { companyId: '1', id: 'C1', name: 'DEV' } as any;
    controller.create(req, dto);
    expect(svc.create).toHaveBeenCalledWith('VE', dto);
  });

  it('get takes the composite key from the body', () => {
    controller.get(req, { companyId: '1', id: 'C1' } as any);
    expect(svc.findByKey).toHaveBeenCalledWith('VE', '1', 'C1');
  });

  it('list passes company + pagination', () => {
    controller.list(req, { companyId: '1', page: 2, size: 10 } as any);
    expect(svc.findAll).toHaveBeenCalledWith('VE', '1', 2, 10);
  });

  it('update passes the body', () => {
    const dto = { companyId: '1', id: 'C1', name: 'LEAD' } as any;
    controller.update(req, dto);
    expect(svc.update).toHaveBeenCalledWith('VE', dto);
  });
});
```

- [ ] **Step 10: Module + app wiring**

Create `src/positions/positions.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantConnectionService } from '../database/tenant-connection.service';
import { InMemoryPositionsRepository } from './in-memory-positions.repository';
import { PositionsController } from './positions.controller';
import { PositionsRepository } from './positions.repository';
import { PositionsService } from './positions.service';

@Module({
  controllers: [PositionsController],
  providers: [
    PositionsService,
    {
      provide: PositionsRepository,
      useFactory: (tenants: TenantConnectionService, config: ConfigService) =>
        process.env.FAKE_DB === 'true'
          ? (new InMemoryPositionsRepository() as unknown as PositionsRepository)
          : new PositionsRepository(tenants, config),
      inject: [TenantConnectionService, ConfigService],
    },
  ],
})
export class PositionsModule {}
```

In `src/app.module.ts`: add `import { PositionsModule } from './positions/positions.module';` with the other imports, and add `PositionsModule` to the `imports` array after `EmployeesModule`.

- [ ] **Step 11: Run the full suite**

Run: `npm test -- positions`
Expected: PASS (repository 4 + in-memory 5 + controller 4).

- [ ] **Step 12: Commit**

```bash
git add src/positions src/app.module.ts
git commit -m "feat(position): add cargos CRUD (create/update/get/list)"
```

---

## Task 3: company resource (get / list, read-only)

**Files:**
- Create: `src/companies/dto/get-company.dto.ts`
- Create: `src/companies/dto/list-companies.query.ts`
- Create: `src/companies/companies.repository.ts`
- Create: `src/companies/in-memory-companies.repository.ts`
- Create: `src/companies/companies.service.ts`
- Create: `src/companies/companies.controller.ts`
- Create: `src/companies/companies.module.ts`
- Create tests alongside
- Modify: `src/app.module.ts`

Read-only resources have no field map (the API returns the PKG's JSON verbatim; no outgoing transform).

- [ ] **Step 1: DTOs**

Create `src/companies/dto/get-company.dto.ts`:

```ts
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class GetCompanyDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9A-Za-z-]{1,4}$/)
  id: string; // EO_EMPRESA.ID
}
```

Create `src/companies/dto/list-companies.query.ts`:

```ts
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListCompaniesQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size = 20;
}
```

- [ ] **Step 2: Repository test (write first)**

Create `src/companies/companies.repository.spec.ts`:

```ts
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompaniesRepository } from './companies.repository';

function fakeConn(outputs: Array<Record<string, unknown>>) {
  let i = 0;
  return {
    execute: jest.fn(async () => ({ outBinds: outputs[i++] })),
    close: jest.fn(async () => undefined),
  };
}
function repoWith(conn: unknown) {
  const tenants = { getPool: () => ({ getConnection: async () => conn }) } as any;
  const config = {
    get: (k: string) =>
      ({
        companyPkg: 'pkg_management_company',
        pkgSuccessCode: 'FTD-200',
        pkgNoRecordsCode: 'FTD-201',
      })[k],
  } as unknown as ConfigService;
  return new CompaniesRepository(tenants, config);
}

describe('CompaniesRepository', () => {
  it('findById returns the company', async () => {
    const conn = fakeConn([
      {
        o_json: JSON.stringify({ companies: [{ id: '1', name: 'FARMATODO' }] }),
        o_cod: 'FTD-200',
        o_message: 'OK',
      },
    ]);
    const res = await repoWith(conn).findById('VE', '1');
    expect(res).toMatchObject({ id: '1', name: 'FARMATODO' });
  });

  it('findById → 404 on no records', async () => {
    const conn = fakeConn([{ o_json: null, o_cod: 'FTD-201', o_message: 'no data' }]);
    await expect(repoWith(conn).findById('VE', 'x')).rejects.toThrow(NotFoundException);
  });

  it('findAll returns empty list on no records', async () => {
    const conn = fakeConn([{ o_json: null, o_cod: 'FTD-201', o_message: 'no data' }]);
    const res = await repoWith(conn).findAll('VE', 1, 20);
    expect(res).toEqual({ page: 1, size: 20, items: [] });
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- companies.repository.spec`
Expected: FAIL — cannot find module `./companies.repository`.

- [ ] **Step 4: Implement the repository**

Create `src/companies/companies.repository.ts`:

```ts
import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as oracledb from 'oracledb';
import { TenantConnectionService } from '../database/tenant-connection.service';

interface PkgResult {
  json: string | null;
  cod: string;
  message: string;
}

@Injectable()
export class CompaniesRepository {
  private readonly logger = new Logger(CompaniesRepository.name);
  private readonly pkg: string;
  private readonly successCode: string;
  private readonly noRecordsCode: string;

  constructor(
    private readonly tenants: TenantConnectionService,
    private readonly config: ConfigService,
  ) {
    this.pkg = this.config.get<string>('companyPkg') ?? 'pkg_management_company';
    this.successCode = this.config.get<string>('pkgSuccessCode') ?? 'FTD-200';
    this.noRecordsCode = this.config.get<string>('pkgNoRecordsCode') ?? 'FTD-201';
  }

  private async withConn<T>(
    country: string,
    fn: (conn: oracledb.Connection) => Promise<T>,
  ): Promise<T> {
    const conn = await this.tenants.getPool(country).getConnection();
    try {
      return await fn(conn);
    } catch (e) {
      throw this.mapOracleError(e);
    } finally {
      await conn.close();
    }
  }

  private async readLob(value: unknown): Promise<string | null> {
    if (value == null) return null;
    if (typeof value === 'string') return value;
    return (value as oracledb.Lob).getData() as Promise<string>;
  }

  private async callPkg(
    conn: oracledb.Connection,
    procedure: string,
    inJson: Record<string, unknown>,
  ): Promise<PkgResult> {
    const binds: oracledb.BindParameters = {
      i_json: JSON.stringify(inJson),
      o_json: { dir: oracledb.BIND_OUT, type: oracledb.CLOB },
      o_cod: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 100 },
      o_message: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 },
    };
    const result = await conn.execute(
      `BEGIN ${this.pkg}.${procedure}(i_json => :i_json, o_json => :o_json, o_cod => :o_cod, o_message => :o_message); END;`,
      binds,
      { autoCommit: false },
    );
    const out = result.outBinds as {
      o_json?: unknown;
      o_cod: string;
      o_message: string;
    };
    return {
      json: await this.readLob(out.o_json),
      cod: String(out.o_cod),
      message: out.o_message,
    };
  }

  private assertPkgSuccess(res: PkgResult, notFoundOnNoRecords = false): void {
    if (res.cod === this.successCode) return;
    this.logger.warn(`PKG ${res.cod}: ${res.message}`);
    if (res.cod === this.noRecordsCode) {
      if (notFoundOnNoRecords) throw new NotFoundException(res.message);
      throw new UnprocessableEntityException(res.message);
    }
    if (res.cod.startsWith('ORA-')) throw new InternalServerErrorException();
    throw new UnprocessableEntityException(res.message);
  }

  private parseItems(json: string | null): Record<string, unknown>[] {
    if (!json) return [];
    return (JSON.parse(json).companies ?? []) as Record<string, unknown>[];
  }

  async findById(country: string, id: string) {
    return this.withConn(country, async (conn) => {
      const res = await this.callPkg(conn, 'prc_get_company', { id });
      this.assertPkgSuccess(res, true);
      const items = this.parseItems(res.json);
      if (!items.length) throw new NotFoundException(`Company ${id} not found`);
      return items[0];
    });
  }

  async findAll(country: string, page: number, size: number) {
    return this.withConn(country, async (conn) => {
      const res = await this.callPkg(conn, 'prc_get_company', { page, size });
      if (res.cod === this.noRecordsCode) return { page, size, items: [] };
      this.assertPkgSuccess(res);
      return { page, size, items: this.parseItems(res.json) };
    });
  }

  private mapOracleError(e: unknown): Error {
    if (e instanceof HttpException) return e;
    return new InternalServerErrorException();
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- companies.repository.spec`
Expected: PASS (3 tests).

- [ ] **Step 6: In-memory repository (seeded) + test**

Create `src/companies/in-memory-companies.repository.spec.ts`:

```ts
import { NotFoundException } from '@nestjs/common';
import { InMemoryCompaniesRepository } from './in-memory-companies.repository';

describe('InMemoryCompaniesRepository', () => {
  const repo = new InMemoryCompaniesRepository();

  it('lists seeded companies', async () => {
    const res = await repo.findAll('VE', 1, 20);
    expect(res.items.length).toBeGreaterThan(0);
  });

  it('gets a seeded company by id', async () => {
    const res = await repo.findById('VE', '1');
    expect(res).toMatchObject({ id: '1' });
  });

  it('unknown id → 404', async () => {
    await expect(repo.findById('VE', 'zzz')).rejects.toThrow(NotFoundException);
  });
});
```

Create `src/companies/in-memory-companies.repository.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';

// Dev/demo-only stub for FAKE_DB. Catalogs are read-only, so a small seed is baked in.
@Injectable()
export class InMemoryCompaniesRepository {
  private readonly seed: Record<string, Record<string, unknown>> = {
    '1': { id: '1', name: 'FARMATODO C.A.', shortName: 'FTD', isPublic: '0' },
    '2': { id: '2', name: 'FARMATODO COLOMBIA S.A.S', shortName: 'FTDCO', isPublic: '0' },
  };

  async findById(_country: string, id: string) {
    const item = this.seed[id];
    if (!item) throw new NotFoundException(`Company ${id} not found`);
    return item;
  }

  async findAll(_country: string, page: number, size: number) {
    const items = Object.values(this.seed);
    const start = (page - 1) * size;
    return { page, size, items: items.slice(start, start + size) };
  }
}
```

- [ ] **Step 7: Run the in-memory test**

Run: `npm test -- in-memory-companies.repository.spec`
Expected: PASS (3 tests).

- [ ] **Step 8: Service + controller + test**

Create `src/companies/companies.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { CompaniesRepository } from './companies.repository';

@Injectable()
export class CompaniesService {
  constructor(private readonly repo: CompaniesRepository) {}

  findById(country: string, id: string) {
    return this.repo.findById(country, id);
  }

  findAll(country: string, page: number, size: number) {
    return this.repo.findAll(country, page, size);
  }
}
```

Create `src/companies/companies.controller.ts`:

```ts
import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { GetCompanyDto } from './dto/get-company.dto';
import { ListCompaniesQuery } from './dto/list-companies.query';

interface TenantRequest {
  countryCode: string;
}

@ApiBearerAuth()
@Controller('company')
export class CompaniesController {
  constructor(private readonly svc: CompaniesService) {}

  @Post('get')
  @HttpCode(200)
  get(@Req() req: TenantRequest, @Body() dto: GetCompanyDto) {
    return this.svc.findById(req.countryCode, dto.id);
  }

  @Post('list')
  @HttpCode(200)
  list(@Req() req: TenantRequest, @Body() dto: ListCompaniesQuery) {
    return this.svc.findAll(req.countryCode, dto.page, dto.size);
  }
}
```

Create `src/companies/companies.controller.spec.ts`:

```ts
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';

describe('CompaniesController', () => {
  const svc = { findById: jest.fn(), findAll: jest.fn() } as unknown as CompaniesService;
  const controller = new CompaniesController(svc);
  const req = { countryCode: 'CO' };

  it('get takes id from the body', () => {
    controller.get(req, { id: '1' } as any);
    expect(svc.findById).toHaveBeenCalledWith('CO', '1');
  });

  it('list passes pagination', () => {
    controller.list(req, { page: 1, size: 20 } as any);
    expect(svc.findAll).toHaveBeenCalledWith('CO', 1, 20);
  });
});
```

- [ ] **Step 9: Module + app wiring**

Create `src/companies/companies.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantConnectionService } from '../database/tenant-connection.service';
import { CompaniesController } from './companies.controller';
import { CompaniesRepository } from './companies.repository';
import { CompaniesService } from './companies.service';
import { InMemoryCompaniesRepository } from './in-memory-companies.repository';

@Module({
  controllers: [CompaniesController],
  providers: [
    CompaniesService,
    {
      provide: CompaniesRepository,
      useFactory: (tenants: TenantConnectionService, config: ConfigService) =>
        process.env.FAKE_DB === 'true'
          ? (new InMemoryCompaniesRepository() as unknown as CompaniesRepository)
          : new CompaniesRepository(tenants, config),
      inject: [TenantConnectionService, ConfigService],
    },
  ],
})
export class CompaniesModule {}
```

In `src/app.module.ts`: add the import and register `CompaniesModule` in `imports`.

- [ ] **Step 10: Run + commit**

Run: `npm test -- companies`
Expected: PASS (repository 3 + in-memory 3 + controller 2).

```bash
git add src/companies src/app.module.ts
git commit -m "feat(company): add empresas read-only API (get/list)"
```

---

## Task 4: marital-status resource (list only, read-only)

**Files:**
- Create: `src/marital-status/dto/list-marital-status.query.ts`
- Create: `src/marital-status/marital-status.repository.ts`
- Create: `src/marital-status/in-memory-marital-status.repository.ts`
- Create: `src/marital-status/marital-status.service.ts`
- Create: `src/marital-status/marital-status.controller.ts`
- Create: `src/marital-status/marital-status.module.ts`
- Create tests alongside
- Modify: `src/app.module.ts`

- [ ] **Step 1: DTO**

Create `src/marital-status/dto/list-marital-status.query.ts`:

```ts
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListMaritalStatusQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size = 50;
}
```

- [ ] **Step 2: Repository test (write first)**

Create `src/marital-status/marital-status.repository.spec.ts`:

```ts
import { ConfigService } from '@nestjs/config';
import { MaritalStatusRepository } from './marital-status.repository';

function fakeConn(outputs: Array<Record<string, unknown>>) {
  let i = 0;
  return {
    execute: jest.fn(async () => ({ outBinds: outputs[i++] })),
    close: jest.fn(async () => undefined),
  };
}
function repoWith(conn: unknown) {
  const tenants = { getPool: () => ({ getConnection: async () => conn }) } as any;
  const config = {
    get: (k: string) =>
      ({
        maritalStatusPkg: 'pkg_management_marital_status',
        pkgSuccessCode: 'FTD-200',
        pkgNoRecordsCode: 'FTD-201',
      })[k],
  } as unknown as ConfigService;
  return new MaritalStatusRepository(tenants, config);
}

describe('MaritalStatusRepository', () => {
  it('findAll returns the catalog', async () => {
    const conn = fakeConn([
      {
        o_json: JSON.stringify({ maritalStatuses: [{ id: 'S', name: 'SOLTERO' }] }),
        o_cod: 'FTD-200',
        o_message: 'OK',
      },
    ]);
    const res = await repoWith(conn).findAll('VE', 1, 50);
    expect(res.items).toEqual([{ id: 'S', name: 'SOLTERO' }]);
  });

  it('findAll returns empty list on no records', async () => {
    const conn = fakeConn([{ o_json: null, o_cod: 'FTD-201', o_message: 'no data' }]);
    const res = await repoWith(conn).findAll('VE', 1, 50);
    expect(res).toEqual({ page: 1, size: 50, items: [] });
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- marital-status.repository.spec`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the repository**

Create `src/marital-status/marital-status.repository.ts`:

```ts
import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as oracledb from 'oracledb';
import { TenantConnectionService } from '../database/tenant-connection.service';

interface PkgResult {
  json: string | null;
  cod: string;
  message: string;
}

@Injectable()
export class MaritalStatusRepository {
  private readonly logger = new Logger(MaritalStatusRepository.name);
  private readonly pkg: string;
  private readonly successCode: string;
  private readonly noRecordsCode: string;

  constructor(
    private readonly tenants: TenantConnectionService,
    private readonly config: ConfigService,
  ) {
    this.pkg = this.config.get<string>('maritalStatusPkg') ?? 'pkg_management_marital_status';
    this.successCode = this.config.get<string>('pkgSuccessCode') ?? 'FTD-200';
    this.noRecordsCode = this.config.get<string>('pkgNoRecordsCode') ?? 'FTD-201';
  }

  private async withConn<T>(
    country: string,
    fn: (conn: oracledb.Connection) => Promise<T>,
  ): Promise<T> {
    const conn = await this.tenants.getPool(country).getConnection();
    try {
      return await fn(conn);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new InternalServerErrorException();
    } finally {
      await conn.close();
    }
  }

  private async readLob(value: unknown): Promise<string | null> {
    if (value == null) return null;
    if (typeof value === 'string') return value;
    return (value as oracledb.Lob).getData() as Promise<string>;
  }

  private async callPkg(
    conn: oracledb.Connection,
    procedure: string,
    inJson: Record<string, unknown>,
  ): Promise<PkgResult> {
    const binds: oracledb.BindParameters = {
      i_json: JSON.stringify(inJson),
      o_json: { dir: oracledb.BIND_OUT, type: oracledb.CLOB },
      o_cod: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 100 },
      o_message: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 },
    };
    const result = await conn.execute(
      `BEGIN ${this.pkg}.${procedure}(i_json => :i_json, o_json => :o_json, o_cod => :o_cod, o_message => :o_message); END;`,
      binds,
      { autoCommit: false },
    );
    const out = result.outBinds as {
      o_json?: unknown;
      o_cod: string;
      o_message: string;
    };
    return {
      json: await this.readLob(out.o_json),
      cod: String(out.o_cod),
      message: out.o_message,
    };
  }

  private parseItems(json: string | null): Record<string, unknown>[] {
    if (!json) return [];
    return (JSON.parse(json).maritalStatuses ?? []) as Record<string, unknown>[];
  }

  async findAll(country: string, page: number, size: number) {
    return this.withConn(country, async (conn) => {
      const res = await this.callPkg(conn, 'prc_get_marital_status', { page, size });
      if (res.cod === this.noRecordsCode) return { page, size, items: [] };
      if (res.cod !== this.successCode) {
        this.logger.warn(`PKG ${res.cod}: ${res.message}`);
        throw new UnprocessableEntityException(res.message);
      }
      return { page, size, items: this.parseItems(res.json) };
    });
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- marital-status.repository.spec`
Expected: PASS (2 tests).

- [ ] **Step 6: In-memory (seeded) + test**

Create `src/marital-status/in-memory-marital-status.repository.spec.ts`:

```ts
import { InMemoryMaritalStatusRepository } from './in-memory-marital-status.repository';

describe('InMemoryMaritalStatusRepository', () => {
  it('lists the seeded catalog', async () => {
    const res = await new InMemoryMaritalStatusRepository().findAll('VE', 1, 50);
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items[0]).toHaveProperty('id');
  });
});
```

Create `src/marital-status/in-memory-marital-status.repository.ts`:

```ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class InMemoryMaritalStatusRepository {
  private readonly seed = [
    { id: 'S', name: 'SOLTERO', legalCode: '1' },
    { id: 'C', name: 'CASADO', legalCode: '2' },
    { id: 'D', name: 'DIVORCIADO', legalCode: '3' },
    { id: 'V', name: 'VIUDO', legalCode: '4' },
  ];

  async findAll(_country: string, page: number, size: number) {
    const start = (page - 1) * size;
    return { page, size, items: this.seed.slice(start, start + size) };
  }
}
```

- [ ] **Step 7: Run the in-memory test**

Run: `npm test -- in-memory-marital-status.repository.spec`
Expected: PASS.

- [ ] **Step 8: Service + controller + test**

Create `src/marital-status/marital-status.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { MaritalStatusRepository } from './marital-status.repository';

@Injectable()
export class MaritalStatusService {
  constructor(private readonly repo: MaritalStatusRepository) {}

  findAll(country: string, page: number, size: number) {
    return this.repo.findAll(country, page, size);
  }
}
```

Create `src/marital-status/marital-status.controller.ts`:

```ts
import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ListMaritalStatusQuery } from './dto/list-marital-status.query';
import { MaritalStatusService } from './marital-status.service';

interface TenantRequest {
  countryCode: string;
}

@ApiBearerAuth()
@Controller('marital-status')
export class MaritalStatusController {
  constructor(private readonly svc: MaritalStatusService) {}

  @Post('list')
  @HttpCode(200)
  list(@Req() req: TenantRequest, @Body() dto: ListMaritalStatusQuery) {
    return this.svc.findAll(req.countryCode, dto.page, dto.size);
  }
}
```

Create `src/marital-status/marital-status.controller.spec.ts`:

```ts
import { MaritalStatusController } from './marital-status.controller';
import { MaritalStatusService } from './marital-status.service';

describe('MaritalStatusController', () => {
  const svc = { findAll: jest.fn() } as unknown as MaritalStatusService;
  const controller = new MaritalStatusController(svc);

  it('list passes tenant + pagination', () => {
    controller.list({ countryCode: 'VE' }, { page: 1, size: 50 } as any);
    expect(svc.findAll).toHaveBeenCalledWith('VE', 1, 50);
  });
});
```

- [ ] **Step 9: Module + app wiring**

Create `src/marital-status/marital-status.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantConnectionService } from '../database/tenant-connection.service';
import { InMemoryMaritalStatusRepository } from './in-memory-marital-status.repository';
import { MaritalStatusController } from './marital-status.controller';
import { MaritalStatusRepository } from './marital-status.repository';
import { MaritalStatusService } from './marital-status.service';

@Module({
  controllers: [MaritalStatusController],
  providers: [
    MaritalStatusService,
    {
      provide: MaritalStatusRepository,
      useFactory: (tenants: TenantConnectionService, config: ConfigService) =>
        process.env.FAKE_DB === 'true'
          ? (new InMemoryMaritalStatusRepository() as unknown as MaritalStatusRepository)
          : new MaritalStatusRepository(tenants, config),
      inject: [TenantConnectionService, ConfigService],
    },
  ],
})
export class MaritalStatusModule {}
```

In `src/app.module.ts`: add the import and register `MaritalStatusModule`.

- [ ] **Step 10: Run + commit**

Run: `npm test -- marital-status`
Expected: PASS (repository 2 + in-memory 1 + controller 1).

```bash
git add src/marital-status src/app.module.ts
git commit -m "feat(marital-status): add estado civil catalog API (list)"
```

---

## Task 5: job-post resource (list by company+unit+position / get, read-only)

**Files:**
- Create: `src/job-posts/dto/get-job-post.dto.ts`
- Create: `src/job-posts/dto/list-job-posts.query.ts`
- Create: `src/job-posts/job-posts.repository.ts`
- Create: `src/job-posts/in-memory-job-posts.repository.ts`
- Create: `src/job-posts/job-posts.service.ts`
- Create: `src/job-posts/job-posts.controller.ts`
- Create: `src/job-posts/job-posts.module.ts`
- Create tests alongside
- Modify: `src/app.module.ts`

- [ ] **Step 1: DTOs**

Create `src/job-posts/dto/get-job-post.dto.ts`:

```ts
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class GetJobPostDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9A-Za-z-]{1,4}$/)
  companyId: string; // ID_EMPRESA

  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  unitId: string; // ID_UNIDAD

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  id: string; // ID
}
```

Create `src/job-posts/dto/list-job-posts.query.ts`:

```ts
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

// The spec requires company + unit + position (cargo) to search job posts.
export class ListJobPostsQuery {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9A-Za-z-]{1,4}$/)
  companyId: string; // ID_EMPRESA

  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  unitId: string; // ID_UNIDAD

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  positionId: string; // ID_CARGO

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size = 20;
}
```

- [ ] **Step 2: Repository test (write first)**

Create `src/job-posts/job-posts.repository.spec.ts`:

```ts
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobPostsRepository } from './job-posts.repository';

function fakeConn(outputs: Array<Record<string, unknown>>) {
  let i = 0;
  return {
    execute: jest.fn(async () => ({ outBinds: outputs[i++] })),
    close: jest.fn(async () => undefined),
  };
}
function repoWith(conn: unknown) {
  const tenants = { getPool: () => ({ getConnection: async () => conn }) } as any;
  const config = {
    get: (k: string) =>
      ({
        jobPostPkg: 'pkg_management_job_post',
        pkgSuccessCode: 'FTD-200',
        pkgNoRecordsCode: 'FTD-201',
      })[k],
  } as unknown as ConfigService;
  return new JobPostsRepository(tenants, config);
}

describe('JobPostsRepository', () => {
  it('findAll returns job posts for the filter', async () => {
    const conn = fakeConn([
      {
        o_json: JSON.stringify({ jobPosts: [{ id: '10', name: 'CAJERO' }] }),
        o_cod: 'FTD-200',
        o_message: 'OK',
      },
    ]);
    const res = await repoWith(conn).findAll('VE', { companyId: '1', unitId: 'U1', positionId: 'C1' }, 1, 20);
    expect(res.items).toEqual([{ id: '10', name: 'CAJERO' }]);
  });

  it('findByKey → 404 on no records', async () => {
    const conn = fakeConn([{ o_json: null, o_cod: 'FTD-201', o_message: 'no data' }]);
    await expect(
      repoWith(conn).findByKey('VE', { companyId: '1', unitId: 'U1', id: '10' }),
    ).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- job-posts.repository.spec`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the repository**

Create `src/job-posts/job-posts.repository.ts`:

```ts
import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as oracledb from 'oracledb';
import { TenantConnectionService } from '../database/tenant-connection.service';

interface PkgResult {
  json: string | null;
  cod: string;
  message: string;
}

export interface JobPostFilter {
  companyId: string;
  unitId: string;
  positionId: string;
}

export interface JobPostKey {
  companyId: string;
  unitId: string;
  id: string;
}

@Injectable()
export class JobPostsRepository {
  private readonly logger = new Logger(JobPostsRepository.name);
  private readonly pkg: string;
  private readonly successCode: string;
  private readonly noRecordsCode: string;

  constructor(
    private readonly tenants: TenantConnectionService,
    private readonly config: ConfigService,
  ) {
    this.pkg = this.config.get<string>('jobPostPkg') ?? 'pkg_management_job_post';
    this.successCode = this.config.get<string>('pkgSuccessCode') ?? 'FTD-200';
    this.noRecordsCode = this.config.get<string>('pkgNoRecordsCode') ?? 'FTD-201';
  }

  private async withConn<T>(
    country: string,
    fn: (conn: oracledb.Connection) => Promise<T>,
  ): Promise<T> {
    const conn = await this.tenants.getPool(country).getConnection();
    try {
      return await fn(conn);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new InternalServerErrorException();
    } finally {
      await conn.close();
    }
  }

  private async readLob(value: unknown): Promise<string | null> {
    if (value == null) return null;
    if (typeof value === 'string') return value;
    return (value as oracledb.Lob).getData() as Promise<string>;
  }

  private async callPkg(
    conn: oracledb.Connection,
    procedure: string,
    inJson: Record<string, unknown>,
  ): Promise<PkgResult> {
    const binds: oracledb.BindParameters = {
      i_json: JSON.stringify(inJson),
      o_json: { dir: oracledb.BIND_OUT, type: oracledb.CLOB },
      o_cod: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 100 },
      o_message: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 },
    };
    const result = await conn.execute(
      `BEGIN ${this.pkg}.${procedure}(i_json => :i_json, o_json => :o_json, o_cod => :o_cod, o_message => :o_message); END;`,
      binds,
      { autoCommit: false },
    );
    const out = result.outBinds as {
      o_json?: unknown;
      o_cod: string;
      o_message: string;
    };
    return {
      json: await this.readLob(out.o_json),
      cod: String(out.o_cod),
      message: out.o_message,
    };
  }

  private parseItems(json: string | null): Record<string, unknown>[] {
    if (!json) return [];
    return (JSON.parse(json).jobPosts ?? []) as Record<string, unknown>[];
  }

  async findAll(country: string, filter: JobPostFilter, page: number, size: number) {
    return this.withConn(country, async (conn) => {
      const res = await this.callPkg(conn, 'prc_get_job_post', { ...filter, page, size });
      if (res.cod === this.noRecordsCode) return { ...filter, page, size, items: [] };
      if (res.cod !== this.successCode) {
        this.logger.warn(`PKG ${res.cod}: ${res.message}`);
        throw new UnprocessableEntityException(res.message);
      }
      return { ...filter, page, size, items: this.parseItems(res.json) };
    });
  }

  async findByKey(country: string, key: JobPostKey) {
    return this.withConn(country, async (conn) => {
      const res = await this.callPkg(conn, 'prc_get_job_post', { ...key });
      if (res.cod === this.noRecordsCode || res.cod !== this.successCode) {
        this.logger.warn(`PKG ${res.cod}: ${res.message}`);
        throw new NotFoundException(`Job post ${key.id} not found`);
      }
      const items = this.parseItems(res.json);
      if (!items.length) throw new NotFoundException(`Job post ${key.id} not found`);
      return items[0];
    });
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- job-posts.repository.spec`
Expected: PASS (2 tests).

- [ ] **Step 6: In-memory (seeded) + test**

Create `src/job-posts/in-memory-job-posts.repository.spec.ts`:

```ts
import { NotFoundException } from '@nestjs/common';
import { InMemoryJobPostsRepository } from './in-memory-job-posts.repository';

describe('InMemoryJobPostsRepository', () => {
  const repo = new InMemoryJobPostsRepository();

  it('lists seeded posts for the filter', async () => {
    const res = await repo.findAll('VE', { companyId: '1', unitId: 'U1', positionId: 'C1' }, 1, 20);
    expect(res.items.length).toBeGreaterThan(0);
  });

  it('gets a seeded post by key', async () => {
    const res = await repo.findByKey('VE', { companyId: '1', unitId: 'U1', id: '10' });
    expect(res).toMatchObject({ id: '10' });
  });

  it('unknown key → 404', async () => {
    await expect(
      repo.findByKey('VE', { companyId: '1', unitId: 'U1', id: '999' }),
    ).rejects.toThrow(NotFoundException);
  });
});
```

Create `src/job-posts/in-memory-job-posts.repository.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { JobPostFilter, JobPostKey } from './job-posts.repository';

@Injectable()
export class InMemoryJobPostsRepository {
  private readonly seed = [
    { companyId: '1', unitId: 'U1', id: '10', name: 'CAJERO', positionId: 'C1' },
    { companyId: '1', unitId: 'U1', id: '11', name: 'SUPERVISOR', positionId: 'C1' },
  ];

  async findAll(_country: string, filter: JobPostFilter, page: number, size: number) {
    const items = this.seed.filter(
      (p) =>
        p.companyId === filter.companyId &&
        p.unitId === filter.unitId &&
        p.positionId === filter.positionId,
    );
    const start = (page - 1) * size;
    return { ...filter, page, size, items: items.slice(start, start + size) };
  }

  async findByKey(_country: string, key: JobPostKey) {
    const item = this.seed.find(
      (p) => p.companyId === key.companyId && p.unitId === key.unitId && p.id === key.id,
    );
    if (!item) throw new NotFoundException(`Job post ${key.id} not found`);
    return item;
  }
}
```

- [ ] **Step 7: Run the in-memory test**

Run: `npm test -- in-memory-job-posts.repository.spec`
Expected: PASS (3 tests).

- [ ] **Step 8: Service + controller + test**

Create `src/job-posts/job-posts.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { JobPostFilter, JobPostKey, JobPostsRepository } from './job-posts.repository';

@Injectable()
export class JobPostsService {
  constructor(private readonly repo: JobPostsRepository) {}

  findAll(country: string, filter: JobPostFilter, page: number, size: number) {
    return this.repo.findAll(country, filter, page, size);
  }

  findByKey(country: string, key: JobPostKey) {
    return this.repo.findByKey(country, key);
  }
}
```

Create `src/job-posts/job-posts.controller.ts`:

```ts
import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { GetJobPostDto } from './dto/get-job-post.dto';
import { ListJobPostsQuery } from './dto/list-job-posts.query';
import { JobPostsService } from './job-posts.service';

interface TenantRequest {
  countryCode: string;
}

@ApiBearerAuth()
@Controller('job-post')
export class JobPostsController {
  constructor(private readonly svc: JobPostsService) {}

  @Post('list')
  @HttpCode(200)
  list(@Req() req: TenantRequest, @Body() dto: ListJobPostsQuery) {
    const { companyId, unitId, positionId, page, size } = dto;
    return this.svc.findAll(req.countryCode, { companyId, unitId, positionId }, page, size);
  }

  @Post('get')
  @HttpCode(200)
  get(@Req() req: TenantRequest, @Body() dto: GetJobPostDto) {
    const { companyId, unitId, id } = dto;
    return this.svc.findByKey(req.countryCode, { companyId, unitId, id });
  }
}
```

Create `src/job-posts/job-posts.controller.spec.ts`:

```ts
import { JobPostsController } from './job-posts.controller';
import { JobPostsService } from './job-posts.service';

describe('JobPostsController', () => {
  const svc = { findAll: jest.fn(), findByKey: jest.fn() } as unknown as JobPostsService;
  const controller = new JobPostsController(svc);
  const req = { countryCode: 'VE' };

  it('list passes the company+unit+position filter', () => {
    controller.list(req, { companyId: '1', unitId: 'U1', positionId: 'C1', page: 1, size: 20 } as any);
    expect(svc.findAll).toHaveBeenCalledWith('VE', { companyId: '1', unitId: 'U1', positionId: 'C1' }, 1, 20);
  });

  it('get passes the composite key', () => {
    controller.get(req, { companyId: '1', unitId: 'U1', id: '10' } as any);
    expect(svc.findByKey).toHaveBeenCalledWith('VE', { companyId: '1', unitId: 'U1', id: '10' });
  });
});
```

- [ ] **Step 9: Module + app wiring**

Create `src/job-posts/job-posts.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantConnectionService } from '../database/tenant-connection.service';
import { InMemoryJobPostsRepository } from './in-memory-job-posts.repository';
import { JobPostsController } from './job-posts.controller';
import { JobPostsRepository } from './job-posts.repository';
import { JobPostsService } from './job-posts.service';

@Module({
  controllers: [JobPostsController],
  providers: [
    JobPostsService,
    {
      provide: JobPostsRepository,
      useFactory: (tenants: TenantConnectionService, config: ConfigService) =>
        process.env.FAKE_DB === 'true'
          ? (new InMemoryJobPostsRepository() as unknown as JobPostsRepository)
          : new JobPostsRepository(tenants, config),
      inject: [TenantConnectionService, ConfigService],
    },
  ],
})
export class JobPostsModule {}
```

In `src/app.module.ts`: add the import and register `JobPostsModule`.

- [ ] **Step 10: Run + commit**

Run: `npm test -- job-posts`
Expected: PASS (repository 2 + in-memory 3 + controller 2).

```bash
git add src/job-posts src/app.module.ts
git commit -m "feat(job-post): add puestos read-only API (list/get)"
```

---

## Task 6: org-unit resource (get / list, read-only)

**Files:**
- Create: `src/org-units/dto/get-org-unit.dto.ts`
- Create: `src/org-units/dto/list-org-units.query.ts`
- Create: `src/org-units/org-units.repository.ts`
- Create: `src/org-units/in-memory-org-units.repository.ts`
- Create: `src/org-units/org-units.service.ts`
- Create: `src/org-units/org-units.controller.ts`
- Create: `src/org-units/org-units.module.ts`
- Create tests alongside
- Modify: `src/app.module.ts`

- [ ] **Step 1: DTOs**

Create `src/org-units/dto/get-org-unit.dto.ts`:

```ts
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class GetOrgUnitDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9A-Za-z-]{1,4}$/)
  companyId: string; // ID_EMPRESA

  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  id: string; // ID
}
```

Create `src/org-units/dto/list-org-units.query.ts`:

```ts
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Matches, Max, Min } from 'class-validator';

export class ListOrgUnitsQuery {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9A-Za-z-]{1,4}$/)
  companyId: string; // ID_EMPRESA

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size = 20;
}
```

- [ ] **Step 2: Repository test (write first)**

Create `src/org-units/org-units.repository.spec.ts`:

```ts
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrgUnitsRepository } from './org-units.repository';

function fakeConn(outputs: Array<Record<string, unknown>>) {
  let i = 0;
  return {
    execute: jest.fn(async () => ({ outBinds: outputs[i++] })),
    close: jest.fn(async () => undefined),
  };
}
function repoWith(conn: unknown) {
  const tenants = { getPool: () => ({ getConnection: async () => conn }) } as any;
  const config = {
    get: (k: string) =>
      ({
        orgUnitPkg: 'pkg_management_org_unit',
        pkgSuccessCode: 'FTD-200',
        pkgNoRecordsCode: 'FTD-201',
      })[k],
  } as unknown as ConfigService;
  return new OrgUnitsRepository(tenants, config);
}

describe('OrgUnitsRepository', () => {
  it('findByKey returns the unit', async () => {
    const conn = fakeConn([
      {
        o_json: JSON.stringify({ orgUnits: [{ companyId: '1', id: 'U1', name: 'TIENDA 1' }] }),
        o_cod: 'FTD-200',
        o_message: 'OK',
      },
    ]);
    const res = await repoWith(conn).findByKey('VE', '1', 'U1');
    expect(res).toMatchObject({ id: 'U1', name: 'TIENDA 1' });
  });

  it('findByKey → 404 on no records', async () => {
    const conn = fakeConn([{ o_json: null, o_cod: 'FTD-201', o_message: 'no data' }]);
    await expect(repoWith(conn).findByKey('VE', '1', 'zzz')).rejects.toThrow(NotFoundException);
  });

  it('findAll returns empty list on no records', async () => {
    const conn = fakeConn([{ o_json: null, o_cod: 'FTD-201', o_message: 'no data' }]);
    const res = await repoWith(conn).findAll('VE', '1', 1, 20);
    expect(res).toEqual({ companyId: '1', page: 1, size: 20, items: [] });
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- org-units.repository.spec`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the repository**

Create `src/org-units/org-units.repository.ts`:

```ts
import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as oracledb from 'oracledb';
import { TenantConnectionService } from '../database/tenant-connection.service';

interface PkgResult {
  json: string | null;
  cod: string;
  message: string;
}

@Injectable()
export class OrgUnitsRepository {
  private readonly logger = new Logger(OrgUnitsRepository.name);
  private readonly pkg: string;
  private readonly successCode: string;
  private readonly noRecordsCode: string;

  constructor(
    private readonly tenants: TenantConnectionService,
    private readonly config: ConfigService,
  ) {
    this.pkg = this.config.get<string>('orgUnitPkg') ?? 'pkg_management_org_unit';
    this.successCode = this.config.get<string>('pkgSuccessCode') ?? 'FTD-200';
    this.noRecordsCode = this.config.get<string>('pkgNoRecordsCode') ?? 'FTD-201';
  }

  private async withConn<T>(
    country: string,
    fn: (conn: oracledb.Connection) => Promise<T>,
  ): Promise<T> {
    const conn = await this.tenants.getPool(country).getConnection();
    try {
      return await fn(conn);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new InternalServerErrorException();
    } finally {
      await conn.close();
    }
  }

  private async readLob(value: unknown): Promise<string | null> {
    if (value == null) return null;
    if (typeof value === 'string') return value;
    return (value as oracledb.Lob).getData() as Promise<string>;
  }

  private async callPkg(
    conn: oracledb.Connection,
    procedure: string,
    inJson: Record<string, unknown>,
  ): Promise<PkgResult> {
    const binds: oracledb.BindParameters = {
      i_json: JSON.stringify(inJson),
      o_json: { dir: oracledb.BIND_OUT, type: oracledb.CLOB },
      o_cod: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 100 },
      o_message: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 },
    };
    const result = await conn.execute(
      `BEGIN ${this.pkg}.${procedure}(i_json => :i_json, o_json => :o_json, o_cod => :o_cod, o_message => :o_message); END;`,
      binds,
      { autoCommit: false },
    );
    const out = result.outBinds as {
      o_json?: unknown;
      o_cod: string;
      o_message: string;
    };
    return {
      json: await this.readLob(out.o_json),
      cod: String(out.o_cod),
      message: out.o_message,
    };
  }

  private parseItems(json: string | null): Record<string, unknown>[] {
    if (!json) return [];
    return (JSON.parse(json).orgUnits ?? []) as Record<string, unknown>[];
  }

  async findByKey(country: string, companyId: string, id: string) {
    return this.withConn(country, async (conn) => {
      const res = await this.callPkg(conn, 'prc_get_org_unit', { companyId, id });
      if (res.cod === this.noRecordsCode) throw new NotFoundException(res.message);
      if (res.cod !== this.successCode) {
        this.logger.warn(`PKG ${res.cod}: ${res.message}`);
        throw new UnprocessableEntityException(res.message);
      }
      const items = this.parseItems(res.json);
      if (!items.length) throw new NotFoundException(`Org unit ${id} not found`);
      return items[0];
    });
  }

  async findAll(country: string, companyId: string, page: number, size: number) {
    return this.withConn(country, async (conn) => {
      const res = await this.callPkg(conn, 'prc_get_org_unit', { companyId, page, size });
      if (res.cod === this.noRecordsCode) return { companyId, page, size, items: [] };
      if (res.cod !== this.successCode) {
        this.logger.warn(`PKG ${res.cod}: ${res.message}`);
        throw new UnprocessableEntityException(res.message);
      }
      return { companyId, page, size, items: this.parseItems(res.json) };
    });
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- org-units.repository.spec`
Expected: PASS (3 tests).

- [ ] **Step 6: In-memory (seeded) + test**

Create `src/org-units/in-memory-org-units.repository.spec.ts`:

```ts
import { NotFoundException } from '@nestjs/common';
import { InMemoryOrgUnitsRepository } from './in-memory-org-units.repository';

describe('InMemoryOrgUnitsRepository', () => {
  const repo = new InMemoryOrgUnitsRepository();

  it('lists seeded units within a company', async () => {
    const res = await repo.findAll('VE', '1', 1, 20);
    expect(res.items.length).toBeGreaterThan(0);
  });

  it('gets a seeded unit by key', async () => {
    const res = await repo.findByKey('VE', '1', 'U1');
    expect(res).toMatchObject({ id: 'U1' });
  });

  it('unknown key → 404', async () => {
    await expect(repo.findByKey('VE', '1', 'zzz')).rejects.toThrow(NotFoundException);
  });
});
```

Create `src/org-units/in-memory-org-units.repository.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class InMemoryOrgUnitsRepository {
  private readonly seed = [
    { companyId: '1', id: 'U1', name: 'TIENDA 1', parentUnitId: null },
    { companyId: '1', id: 'U2', name: 'TIENDA 2', parentUnitId: null },
  ];

  async findByKey(_country: string, companyId: string, id: string) {
    const item = this.seed.find((u) => u.companyId === companyId && u.id === id);
    if (!item) throw new NotFoundException(`Org unit ${id} not found`);
    return item;
  }

  async findAll(_country: string, companyId: string, page: number, size: number) {
    const items = this.seed.filter((u) => u.companyId === companyId);
    const start = (page - 1) * size;
    return { companyId, page, size, items: items.slice(start, start + size) };
  }
}
```

- [ ] **Step 7: Run the in-memory test**

Run: `npm test -- in-memory-org-units.repository.spec`
Expected: PASS (3 tests).

- [ ] **Step 8: Service + controller + test**

Create `src/org-units/org-units.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { OrgUnitsRepository } from './org-units.repository';

@Injectable()
export class OrgUnitsService {
  constructor(private readonly repo: OrgUnitsRepository) {}

  findByKey(country: string, companyId: string, id: string) {
    return this.repo.findByKey(country, companyId, id);
  }

  findAll(country: string, companyId: string, page: number, size: number) {
    return this.repo.findAll(country, companyId, page, size);
  }
}
```

Create `src/org-units/org-units.controller.ts`:

```ts
import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { GetOrgUnitDto } from './dto/get-org-unit.dto';
import { ListOrgUnitsQuery } from './dto/list-org-units.query';
import { OrgUnitsService } from './org-units.service';

interface TenantRequest {
  countryCode: string;
}

@ApiBearerAuth()
@Controller('org-unit')
export class OrgUnitsController {
  constructor(private readonly svc: OrgUnitsService) {}

  @Post('get')
  @HttpCode(200)
  get(@Req() req: TenantRequest, @Body() dto: GetOrgUnitDto) {
    return this.svc.findByKey(req.countryCode, dto.companyId, dto.id);
  }

  @Post('list')
  @HttpCode(200)
  list(@Req() req: TenantRequest, @Body() dto: ListOrgUnitsQuery) {
    return this.svc.findAll(req.countryCode, dto.companyId, dto.page, dto.size);
  }
}
```

Create `src/org-units/org-units.controller.spec.ts`:

```ts
import { OrgUnitsController } from './org-units.controller';
import { OrgUnitsService } from './org-units.service';

describe('OrgUnitsController', () => {
  const svc = { findByKey: jest.fn(), findAll: jest.fn() } as unknown as OrgUnitsService;
  const controller = new OrgUnitsController(svc);
  const req = { countryCode: 'CO' };

  it('get takes the composite key from the body', () => {
    controller.get(req, { companyId: '1', id: 'U1' } as any);
    expect(svc.findByKey).toHaveBeenCalledWith('CO', '1', 'U1');
  });

  it('list passes company + pagination', () => {
    controller.list(req, { companyId: '1', page: 1, size: 20 } as any);
    expect(svc.findAll).toHaveBeenCalledWith('CO', '1', 1, 20);
  });
});
```

- [ ] **Step 9: Module + app wiring**

Create `src/org-units/org-units.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantConnectionService } from '../database/tenant-connection.service';
import { InMemoryOrgUnitsRepository } from './in-memory-org-units.repository';
import { OrgUnitsController } from './org-units.controller';
import { OrgUnitsRepository } from './org-units.repository';
import { OrgUnitsService } from './org-units.service';

@Module({
  controllers: [OrgUnitsController],
  providers: [
    OrgUnitsService,
    {
      provide: OrgUnitsRepository,
      useFactory: (tenants: TenantConnectionService, config: ConfigService) =>
        process.env.FAKE_DB === 'true'
          ? (new InMemoryOrgUnitsRepository() as unknown as OrgUnitsRepository)
          : new OrgUnitsRepository(tenants, config),
      inject: [TenantConnectionService, ConfigService],
    },
  ],
})
export class OrgUnitsModule {}
```

In `src/app.module.ts`: add the import and register `OrgUnitsModule`.

- [ ] **Step 10: Run + commit**

Run: `npm test -- org-units`
Expected: PASS (repository 3 + in-memory 3 + controller 2).

```bash
git add src/org-units src/app.module.ts
git commit -m "feat(org-unit): add unidad read-only API (get/list)"
```

---

## Task 7: PKG SQL scripts (proposal for the DBA)

Oracle 12.1 packages built like `db/pkg_management_employee_api.sql` (manual JSON via
`FN_JSON_*` + `DBMS_LOB`, `JSON_TABLE` for input, `OFFSET/FETCH` for pagination), created
in the `people_one` schema. These are a **proposal**; the DBA confirms the real procedure
names (as with Employee Task 0/12).

**Files:**
- Create: `db/pkg_management_position_api.sql`
- Create: `db/pkg_management_company_api.sql`
- Create: `db/pkg_management_marital_status_api.sql`
- Create: `db/pkg_management_job_post_api.sql`
- Create: `db/pkg_management_org_unit_api.sql`

- [ ] **Step 1: Read the reference PKG**

Read `db/pkg_management_employee_api.sql` in full to reuse its helper functions
(`FN_JSON_ESCAPE`, `FN_JSON_PAIR`), the `O_JSON/O_COD/O_MESSAGE` signature, the
`PKG_GLOBAL_CONSTANTS` success/no-records codes, and the `WHEN OTHERS` handler that sets
`O_COD := 'ORA-' || SQLCODE`.

- [ ] **Step 2: Write `db/pkg_management_position_api.sql`**

Package `pkg_management_position` with:
- `prc_merge_position(i_json, o_cod, o_message)` — parse `positions[]` via `JSON_TABLE`
  mapping companyId→ID_EMPRESA, id→ID, name→NOMBRE, classificationId→ID_CLASIFICA,
  parentPositionId→ID_CARGO_SUP, description→DESCRIP, functions→FUNCION, purpose→PROPOSITO,
  risk→RIESGO; UPDATE by (ID_EMPRESA, ID) then INSERT if no rows; set USRCRE/FECCRE on
  insert and USRACT/FECACT on update. Return success/`ORA-<code>`.
- `prc_get_position(i_json, o_json, o_cod, o_message)` — if `id` present return the single
  row by (companyId,id); else page rows for `companyId` using `page`/`size` with
  `OFFSET (page-1)*size ROWS FETCH NEXT size ROWS ONLY`. Build `{"positions":[...]}` with
  the same key names. No rows → `o_cod := PKG_GLOBAL_CONSTANTS` no-records code.

- [ ] **Step 3: Write `db/pkg_management_company_api.sql`**

Package `pkg_management_company` with `prc_get_company(i_json, o_json, o_cod, o_message)`:
single row by `id`, or page all when only `page`/`size`. Emit `{"companies":[...]}` with
keys id, name, shortName(NOMBRE_ABREV), sector(SECTOR_EMP), isPublic(PUBLICA), taxId1(RIF1),
taxId2(RIF2), address(DIRECCION), city(CIUDAD), postalCode(COD_POSTAL), phone1(TELEFONO1),
phone2(TELEFONO2), webPage(PAGINA_WEB), email(E_MAIL) from `EO_EMPRESA`.

- [ ] **Step 4: Write `db/pkg_management_marital_status_api.sql`**

Package `pkg_management_marital_status` with `prc_get_marital_status(i_json, o_json, o_cod,
o_message)`: page all rows of `eo_estado_civil`. Emit `{"maritalStatuses":[...]}` with keys
id(ID), name(NOMBRE), legalCode(CODIGO_LEY).

- [ ] **Step 5: Write `db/pkg_management_job_post_api.sql`**

Package `pkg_management_job_post` with `prc_get_job_post(i_json, o_json, o_cod, o_message)`:
if `id` present return the row by (companyId,unitId,id); else filter by
companyId(ID_EMPRESA)+unitId(ID_UNIDAD)+positionId(ID_CARGO) with paging. Emit
`{"jobPosts":[...]}` with keys companyId, unitId, id, name(NOMBRE), positionId(ID_CARGO),
description(DESCRIP), functions(FUNCION), startDate(FECHA_INI), endDate(FECHA_FIN),
risk(RIESGO).

- [ ] **Step 6: Write `db/pkg_management_org_unit_api.sql`**

Package `pkg_management_org_unit` with `prc_get_org_unit(i_json, o_json, o_cod, o_message)`:
single row by (companyId,id) or page by companyId. Emit `{"orgUnits":[...]}` with keys
companyId, id, name(NOMBRE), functions(FUNCIONES), adminLocation(UBICA_ADMIN),
startDate(FECHA_INI), endDate(FECHA_FIN), parentUnitId(ID_UNIDAD_SUP), maxPosts(MAX_PUESTO).

- [ ] **Step 7: Commit**

```bash
git add db/pkg_management_position_api.sql db/pkg_management_company_api.sql db/pkg_management_marital_status_api.sql db/pkg_management_job_post_api.sql db/pkg_management_org_unit_api.sql
git commit -m "feat(db): proposed PKG scripts for the new SPI resources (people_one schema)"
```

---

## Task 8: Docs, Postman, full verification

**Files:**
- Modify: `README.md`
- Modify: `postman/ftd-spi-employee.postman_collection.json`

- [ ] **Step 1: Extend the README endpoints table**

In `README.md`, under the Endpoints table, add the new rows after the employee rows:

```markdown
| POST | `/ftd-spi-employee/rest/position/create` · `/update` · `/get` · `/list` | Cargos (create/update/get/list) |
| POST | `/ftd-spi-employee/rest/company/get` · `/list` | Empresas (consulta) |
| POST | `/ftd-spi-employee/rest/marital-status/list` | Estado civil (catálogo) |
| POST | `/ftd-spi-employee/rest/job-post/list` · `/get` | Puestos (por empresa+unidad+cargo) |
| POST | `/ftd-spi-employee/rest/org-unit/get` · `/list` | Unidades organizativas |
```

- [ ] **Step 2: Add Postman folders**

In `postman/ftd-spi-employee.postman_collection.json`, add one folder per resource
(`position`, `company`, `marital-status`, `job-post`, `org-unit`) mirroring the existing
`employee` folder: each request is a `POST {{baseUrl}}/ftd-spi-employee/rest/{resource}/{verb}`
with headers `Authorization: Bearer {{token}}`, `X-Country-Code: {{country}}`,
`Content-Type: application/json`. Reuse the collection's existing pre-request script that
encrypts the body into `RequestJson` with `{{payloadKey}}` (copy it from an employee request).
Include for each resource one encrypted happy-path request plus one negative (e.g.
`position/get` with a non-existent key → 404). Keep the raw body examples:
- position/create: `{ "companyId": "1", "id": "C1", "name": "DEV" }`
- position/get: `{ "companyId": "1", "id": "C1" }`
- position/list: `{ "companyId": "1", "page": 1, "size": 20 }`
- company/get: `{ "id": "1" }`
- company/list: `{ "page": 1, "size": 20 }`
- marital-status/list: `{ "page": 1, "size": 50 }`
- job-post/list: `{ "companyId": "1", "unitId": "U1", "positionId": "C1", "page": 1, "size": 20 }`
- job-post/get: `{ "companyId": "1", "unitId": "U1", "id": "10" }`
- org-unit/get: `{ "companyId": "1", "id": "U1" }`
- org-unit/list: `{ "companyId": "1", "page": 1, "size": 20 }`

- [ ] **Step 3: Full lint + coverage gate**

Run: `npm run lint && npm test -- --coverage`
Expected: lint clean; all suites PASS; coverage ≥80% (Sonar gate).

- [ ] **Step 4: Boot check in FAKE_DB and hit one new route per resource**

Run (PowerShell), then smoke-test with the Postman collection or curl once the server is up:

```powershell
$env:FAKE_DB="true"; $env:PAYLOAD_ENCRYPTION_KEY="portal-shared-key-2026"; npm run build; node dist/main.js
```

Expected: server starts; `POST /ftd-spi-employee/rest/marital-status/list` returns the
seeded catalog; `POST /ftd-spi-employee/rest/company/list` returns the seeded companies;
`POST /ftd-spi-employee/rest/position/create` then `/position/get` round-trips.

- [ ] **Step 5: Commit**

```bash
git add README.md postman/ftd-spi-employee.postman_collection.json
git commit -m "docs: document new SPI resources in README and Postman collection"
```

---

## Self-Review notes

- **Spec coverage:** position (Task 2) = Cargos create/update/consultar ✓; company (Task 3) = Empresas consulta ✓; marital-status (Task 4) = Estado Civil consulta ✓; job-post (Task 5) = Puestos por empresa+unidad+cargo ✓; org-unit (Task 6) = Unidad consulta ✓; PKG scripts (Task 7) ✓; config/env (Task 1) ✓; README+Postman (Task 8) ✓.
- **Type consistency:** `findByKey(country, companyId, id)` (position/org-unit) and `findByKey(country, key)` (job-post) are used identically in each resource's service/controller/tests. `JobPostFilter`/`JobPostKey` are defined in `job-posts.repository.ts` and imported by the service and in-memory repo.
- **No delete** on any new resource (matches the spec/YAGNI).
- The read-only repositories intentionally omit `create`/`update`/`toPayload` and the `-1`(unique) 409 mapping, since they never write.
```
