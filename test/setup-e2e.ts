import * as crypto from 'crypto';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

process.env.JWT_PRIVATE_KEY_BASE64 = Buffer.from(privateKey).toString('base64');
process.env.JWT_PUBLIC_KEY_BASE64 = Buffer.from(publicKey).toString('base64');
process.env.JWT_TTL_SECONDS = '43200';
process.env.JWT_ISSUER = 'employee-api-spi';
process.env.API_CLIENTS_JSON = JSON.stringify([
  {
    clientId: 'test-client',
    secretHash: crypto.createHash('sha256').update('test-secret').digest('hex'),
    countries: ['VE'],
  },
]);
process.env.DB_VE_CONNECT_STRING = 'dummy:1521/SPI';
process.env.DB_VE_USER = 'dummy';
process.env.DB_VE_PASSWORD = 'dummy';
