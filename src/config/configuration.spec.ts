import { buildConfig } from './configuration';

describe('buildConfig', () => {
  it('detects enabled countries by presence of DB_<CC>_* variables', () => {
    const cfg = buildConfig({
      DB_VE_CONNECT_STRING: 'h:1521/SPI',
      DB_VE_USER: 'u',
      DB_VE_PASSWORD: 'p',
      JWT_TTL_SECONDS: '43200',
    } as NodeJS.ProcessEnv);
    expect(cfg.countries).toEqual({
      VE: { connectString: 'h:1521/SPI', user: 'u', password: 'p', poolMin: 1, poolMax: 5 },
    });
    expect(cfg.jwt.ttlSeconds).toBe(43200);
  });

  it('ignores countries with incomplete configuration', () => {
    const cfg = buildConfig({ DB_AR_USER: 'u' } as NodeJS.ProcessEnv);
    expect(cfg.countries.AR).toBeUndefined();
  });

  it('decodes base64 JWT keys and parses API clients', () => {
    const cfg = buildConfig({
      JWT_PRIVATE_KEY_BASE64: Buffer.from('PRIV').toString('base64'),
      JWT_PUBLIC_KEY_BASE64: Buffer.from('PUB').toString('base64'),
      API_CLIENTS_JSON: '[{"clientId":"a","secretHash":"h","countries":["VE"]}]',
    } as NodeJS.ProcessEnv);
    expect(cfg.jwt.privateKey).toBe('PRIV');
    expect(cfg.jwt.publicKey).toBe('PUB');
    expect(cfg.apiClients).toEqual([{ clientId: 'a', secretHash: 'h', countries: ['VE'] }]);
  });
});
