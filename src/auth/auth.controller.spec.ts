import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  it('delegates token issuance to the service', () => {
    const svc = {
      issueToken: jest.fn().mockReturnValue({
        access_token: 't',
        token_type: 'Bearer',
        expires_in: 43200,
      }),
    } as unknown as AuthService;
    const res = new AuthController(svc).token({
      client_id: 'a',
      client_secret: 'b',
    });
    expect(svc.issueToken).toHaveBeenCalledWith('a', 'b');
    expect(res.expires_in).toBe(43200);
  });
});
