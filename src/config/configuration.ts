const SUPPORTED = ['AR', 'CO', 'VE'] as const;
export type CountryCode = (typeof SUPPORTED)[number];

export interface CountryDbConfig {
  connectString: string;
  user: string;
  password: string;
  poolMin: number;
  poolMax: number;
}

export interface ApiClient {
  clientId: string;
  secretHash: string;
  countries?: string[];
}

export interface OraclePoolTuning {
  poolTimeout: number;
  queueTimeout: number;
  callTimeout: number;
}

export interface AppConfig {
  port: number;
  countries: Partial<Record<CountryCode, CountryDbConfig>>;
  jwt: {
    privateKey: string;
    publicKey: string;
    ttlSeconds: number;
    issuer: string;
  };
  apiClients: ApiClient[];
  payloadEncryptionKey: string;
  requireEncryptedPayload: boolean;
  corsOrigins: string[];
  employeePkg: string;
  pkgSuccessCode: string;
  pkgNoRecordsCode: string;
  /** Unqualified PKG names — resolved in connection schema (people_one). */
  positionPkg: string;
  companyPkg: string;
  maritalStatusPkg: string;
  jobPostPkg: string;
  orgUnitPkg: string;
  /** Un solo paquete Oracle compartido por todos los catálogos de solo lectura. */
  catalogsPkg: string;
  requestTimeoutMs: number;
  oracle: OraclePoolTuning;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  bodyParserLimit: string;
}

let cached: AppConfig | null = null;

export function buildConfig(env: NodeJS.ProcessEnv): AppConfig {
  const countries: AppConfig['countries'] = {};
  for (const cc of SUPPORTED) {
    const connectString = env[`DB_${cc}_CONNECT_STRING`];
    const user = env[`DB_${cc}_USER`];
    const password = env[`DB_${cc}_PASSWORD`];
    if (connectString && user && password) {
      countries[cc] = {
        connectString,
        user,
        password,
        poolMin: Number(env[`DB_${cc}_POOL_MIN`] ?? 1),
        poolMax: Number(env[`DB_${cc}_POOL_MAX`] ?? 5),
      };
    }
  }
  return {
    port: Number(env.PORT ?? 8080),
    countries,
    jwt: {
      privateKey: Buffer.from(
        env.JWT_PRIVATE_KEY_BASE64 ?? '',
        'base64',
      ).toString('utf8'),
      publicKey: Buffer.from(
        env.JWT_PUBLIC_KEY_BASE64 ?? '',
        'base64',
      ).toString('utf8'),
      ttlSeconds: Number(env.JWT_TTL_SECONDS ?? 43200),
      issuer: env.JWT_ISSUER ?? 'ftd-spi-employee',
    },
    apiClients: JSON.parse(env.API_CLIENTS_JSON ?? '[]') as ApiClient[],
    payloadEncryptionKey:
      env.PAYLOAD_ENCRYPTION_KEY ?? env.AES_SECRET_KEY ?? '',
    /** If true, business endpoints reject any request without an encrypted
     * RequestJson body (400) instead of silently allowing plaintext.
     * Defaults to false to preserve the existing "plain requests still work"
     * contract (tested in employees.e2e-spec.ts). */
    requireEncryptedPayload: env.REQUIRE_ENCRYPTED_PAYLOAD === 'true',
    // Defense in depth: even if a dev/staging origin (localhost:*,
    // 127.0.0.1:*) ends up in CORS_ORIGINS for a production deploy — as the
    // pentest found (localhost:3000/4200 whitelisted with
    // access-control-allow-credentials:true in prod) — never honor it once
    // NODE_ENV=production. The real fix is removing it from the deployed
    // CORS_ORIGINS value itself; this just stops it from being exploitable
    // even if that config slips through again.
    corsOrigins: (env.CORS_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean)
      .filter(
        (o) =>
          env.NODE_ENV !== 'production' ||
          !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(o),
      ),
    employeePkg: env.EMPLOYEE_PKG ?? 'pkg_management_employee',
    pkgSuccessCode: env.PKG_SUCCESS_CODE ?? 'FTD-200',
    pkgNoRecordsCode: env.PKG_NORECORDS_CODE ?? 'FTD-201',
    positionPkg: env.POSITION_PKG ?? 'pkg_management_position',
    companyPkg: env.COMPANY_PKG ?? 'pkg_management_company',
    maritalStatusPkg:
      env.MARITAL_STATUS_PKG ?? 'pkg_management_marital_status',
    jobPostPkg: env.JOB_POST_PKG ?? 'pkg_management_job_post',
    orgUnitPkg: env.ORG_UNIT_PKG ?? 'pkg_management_org_unit',
    catalogsPkg: env.CATALOGS_PKG ?? 'pkg_management_catalogs',
    requestTimeoutMs: Number(
      env.REQUEST_TIMEOUT_MS ?? env.REQUEST_TIMEOUT ?? 30_000,
    ),
    oracle: {
      poolTimeout: Number(env.ORACLE_POOL_TIMEOUT ?? env.DB_POOL_TIMEOUT ?? 300),
      queueTimeout: Number(
        env.ORACLE_QUEUE_TIMEOUT ?? env.DB_QUEUE_TIMEOUT ?? 60_000,
      ),
      callTimeout: Number(env.ORACLE_CALL_TIMEOUT ?? 30_000),
    },
    rateLimitWindowMs: Number(env.RATE_LIMIT_WINDOW_MS ?? 60_000),
    rateLimitMax: Number(env.RATE_LIMIT_MAX_REQUESTS ?? 60),
    bodyParserLimit: env.BODY_PARSER_LIMIT ?? '1mb',
  };
}

export function getConfig(): AppConfig {
  if (!cached) cached = buildConfig(process.env);
  return cached;
}

export function resetConfigCache(): void {
  cached = null;
}
