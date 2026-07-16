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
  });

  it('overrides resource PKG names from env', () => {
    const cfg = buildConfig({
      POSITION_PKG: 'x.pkg_pos',
    } as unknown as NodeJS.ProcessEnv);
    expect(cfg.positionPkg).toBe('x.pkg_pos');
  });
});
