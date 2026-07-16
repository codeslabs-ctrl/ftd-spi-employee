import * as crypto from 'crypto';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

process.env.FAKE_DB = 'true';
process.env.NODE_ENV = 'development';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_PRIVATE_KEY_BASE64 = Buffer.from(privateKey).toString('base64');
process.env.JWT_PUBLIC_KEY_BASE64 = Buffer.from(publicKey).toString('base64');
process.env.JWT_TTL_SECONDS = '43200';
process.env.JWT_ISSUER = 'ftd-spi-employee';
process.env.API_CLIENTS_JSON = JSON.stringify([
  {
    clientId: 'test-client',
    secretHash: crypto.createHash('sha256').update('test-secret').digest('hex'),
    countries: ['VE'],
  },
  {
    clientId: 'co-client',
    secretHash: crypto.createHash('sha256').update('co-secret').digest('hex'),
    countries: ['CO'],
  },
]);
process.env.DB_VE_CONNECT_STRING = 'dummy:1521/SPI';
process.env.DB_VE_USER = 'dummy';
process.env.DB_VE_PASSWORD = 'dummy';
process.env.DB_CO_CONNECT_STRING = 'dummy:1521/SPI';
process.env.DB_CO_USER = 'dummy';
process.env.DB_CO_PASSWORD = 'dummy';
process.env.PAYLOAD_ENCRYPTION_KEY = 'e2e-shared-key';
process.env.REQUEST_TIMEOUT_MS = '30000';
process.env.RATE_LIMIT_WINDOW_MS = '60000';
process.env.RATE_LIMIT_MAX_REQUESTS = '1000';
