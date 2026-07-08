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
  // Shared passphrase for CryptoJS.AES payload encryption (front <-> back). Empty = disabled.
  payloadEncryptionKey: string;
  // Allowed browser origins for CORS (empty = CORS disabled).
  corsOrigins: string[];
  // PKG name (schema.package) and PKG_GLOBAL_CONSTANTS codes — vary per environment.
  employeePkg: string;
  pkgSuccessCode: string;
  pkgNoRecordsCode: string;
}

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
    payloadEncryptionKey: env.PAYLOAD_ENCRYPTION_KEY ?? '',
    corsOrigins: (env.CORS_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    employeePkg: env.EMPLOYEE_PKG ?? 'corsox.pkg_management_employee',
    pkgSuccessCode: env.PKG_SUCCESS_CODE ?? 'FTD-200',
    pkgNoRecordsCode: env.PKG_NORECORDS_CODE ?? 'FTD-201',
  };
}

export default () => buildConfig(process.env);
