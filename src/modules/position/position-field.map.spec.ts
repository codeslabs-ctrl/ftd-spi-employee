import { toPositionPayload } from './position-field.map';

describe('toPositionPayload', () => {
  it('keeps only known fields', () => {
    expect(
      toPositionPayload({
        companyId: '1',
        id: '2',
        name: 'Cargo',
        extra: 'x',
      }),
    ).toEqual({ companyId: '1', id: '2', name: 'Cargo' });
  });
});
