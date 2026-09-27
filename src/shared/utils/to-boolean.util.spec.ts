import { toBooleanDefaultTrue } from './to-boolean.util';

describe('toBooleanDefaultTrue (paginate flag parsing)', () => {
  it('defaults to true when the flag is omitted (backward compatible for existing clients like PeopleOne)', () => {
    expect(toBooleanDefaultTrue(undefined)).toBe(true);
    expect(toBooleanDefaultTrue(null)).toBe(true);
    expect(toBooleanDefaultTrue('')).toBe(true);
  });

  it('passes through native booleans (JSON body already decrypted)', () => {
    expect(toBooleanDefaultTrue(true)).toBe(true);
    expect(toBooleanDefaultTrue(false)).toBe(false);
  });

  it('parses string "false" as false — the class-transformer @Type(() => Boolean) footgun this avoids', () => {
    expect(toBooleanDefaultTrue('false')).toBe(false);
    expect(toBooleanDefaultTrue('FALSE')).toBe(false);
    expect(toBooleanDefaultTrue('False')).toBe(false);
  });

  it('parses string "true" as true', () => {
    expect(toBooleanDefaultTrue('true')).toBe(true);
    expect(toBooleanDefaultTrue('TRUE')).toBe(true);
  });

  it('treats any other truthy value as true', () => {
    expect(toBooleanDefaultTrue('yes')).toBe(true);
    expect(toBooleanDefaultTrue(1)).toBe(true);
  });
});
