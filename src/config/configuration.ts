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
      issuer: env.JWT_ISSUER ?? 'employee-api-spi',
    },
    apiClients: JSON.parse(env.API_CLIENTS_JSON ?? '[]') as ApiClient[],
  };
}

export default () => buildConfig(process.env);
