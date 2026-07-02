import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';

function mockHost(path = '/api/v1/employees') {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: path }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  it('maps HttpException to the standard error shape', () => {
    const { host, status, json } = mockHost();
    new AllExceptionsFilter().catch(
      new BadRequestException(['idNumber must not be empty']),
      host,
    );
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'Bad Request',
        errors: ['idNumber must not be empty'],
        path: '/api/v1/employees',
        timestamp: expect.any(String),
      }),
    );
  });

  it('maps HttpException with string body', () => {
    const { host, status, json } = mockHost();
    new AllExceptionsFilter().catch(
      new (class extends BadRequestException {
        getResponse() {
          return 'plain message';
        }
      })(),
      host,
    );
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'plain message' }),
    );
  });

  it('maps HttpException with non-array message and no error field', () => {
    const { host, json } = mockHost();
    new AllExceptionsFilter().catch(
      new (class extends BadRequestException {
        getResponse() {
          return { message: 'single message' };
        }
      })(),
      host,
    );
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'single message', errors: [] }),
    );
  });

  it('maps unhandled errors to 500 without leaking internals', () => {
    const { host, status, json } = mockHost();
    new AllExceptionsFilter().catch(
      new Error('ORA-00942: table or view does not exist'),
      host,
    );
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
      }),
    );
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('ORA-00942');
  });
});
