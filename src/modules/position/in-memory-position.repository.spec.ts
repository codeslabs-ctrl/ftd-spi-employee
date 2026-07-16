import { InMemoryPositionsRepository } from './in-memory-position.repository';

describe('InMemoryPositionsRepository', () => {
  const repo = new InMemoryPositionsRepository();

  it('creates, gets, lists and updates a position', async () => {
    await repo.create('VE', {
      companyId: '1',
      id: '9',
      name: 'Cargo test',
    });
    const got = await repo.findById('VE', '1', '9');
    expect(got.name).toBe('Cargo test');

    const list = await repo.findAll('VE', 1, 10, '1');
    expect(list.items.some((i) => i.id === '9')).toBe(true);

    const updated = await repo.update('VE', {
      companyId: '1',
      id: '9',
      name: 'Cargo upd',
    });
    expect(updated.name).toBe('Cargo upd');
  });

  it('rejects duplicate create', async () => {
    await expect(
      repo.create('VE', { companyId: '1', id: '9', name: 'Dup' }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
