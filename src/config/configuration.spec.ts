import { buildConfig } from './configuration';

describe('buildConfig', () => {
  it('detects enabled countries', () => {
    const cfg = buildConfig({
      DB_VE_CONNECT_STRING: 'h:1521/SPI',
      DB_VE_USER: 'u',
      DB_VE_PASSWORD: 'p',
    } as NodeJS.ProcessEnv);
    expect(cfg.countries.VE).toBeDefined();
    expect(cfg.requestTimeoutMs).toBe(30_000);
  });

  it('reads PAYLOAD_ENCRYPTION_KEY or AES_SECRET_KEY', () => {
    expect(
      buildConfig({ PAYLOAD_ENCRYPTION_KEY: 'a' } as NodeJS.ProcessEnv)
        .payloadEncryptionKey,
    ).toBe('a');
    expect(
      buildConfig({ AES_SECRET_KEY: 'b' } as NodeJS.ProcessEnv)
        .payloadEncryptionKey,
    ).toBe('b');
  });

  it('defaults the new resource PKG names (unqualified, people_one schema)', () => {
    const cfg = buildConfig({} as NodeJS.ProcessEnv);
    expect(cfg.positionPkg).toBe('pkg_management_position');
    expect(cfg.companyPkg).toBe('pkg_management_company');
    expect(cfg.maritalStatusPkg).toBe('pkg_management_marital_status');
    expect(cfg.jobPostPkg).toBe('pkg_management_job_post');
    expect(cfg.orgUnitPkg).toBe('pkg_management_org_unit');
    expect(cfg.catalogsPkg).toBe('pkg_management_catalogs');
  });

  it('overrides resource PKG names from env', () => {
    const cfg = buildConfig({
      POSITION_PKG: 'x.pkg_pos',
    } as unknown as NodeJS.ProcessEnv);
    expect(cfg.positionPkg).toBe('x.pkg_pos');
  });

  // Pentest finding #31: CORS_ORIGINS in the deployed prod env included
  // http://localhost:3000/4200 with Access-Control-Allow-Credentials:true.
  // The real fix is removing them from the deployed env var, but this
  // config-level filter is a safety net so they're never honored even if
  // that slips through again.
  describe('corsOrigins localhost filter (pentest #31)', () => {
    it('keeps localhost origins outside production', () => {
      const cfg = buildConfig({
        NODE_ENV: 'development',
        CORS_ORIGINS: 'http://localhost:3000,http://localhost:4200',
      } as NodeJS.ProcessEnv);
      expect(cfg.corsOrigins).toEqual([
        'http://localhost:3000',
        'http://localhost:4200',
      ]);
    });

    it('strips localhost/127.0.0.1 origins when NODE_ENV=production', () => {
      const cfg = buildConfig({
        NODE_ENV: 'production',
        CORS_ORIGINS:
          'http://localhost:3000,http://127.0.0.1:4200,https://aplicaciones-vp-finanzas.uc.r.appspot.com',
      } as NodeJS.ProcessEnv);
      expect(cfg.corsOrigins).toEqual([
        'https://aplicaciones-vp-finanzas.uc.r.appspot.com',
      ]);
    });

    it('keeps legitimate production origins untouched', () => {
      const cfg = buildConfig({
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://aplicaciones-vp-finanzas.uc.r.appspot.com',
      } as NodeJS.ProcessEnv);
      expect(cfg.corsOrigins).toEqual([
        'https://aplicaciones-vp-finanzas.uc.r.appspot.com',
      ]);
    });
  });
});
