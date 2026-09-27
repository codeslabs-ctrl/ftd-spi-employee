import { FETCH_ALL_BATCH_SIZE, fetchAllPages } from './fetch-all-pages.util';

describe('fetchAllPages (paginate=false support)', () => {
  it('concatenates every page until a short page signals the end', async () => {
    const pages: Record<number, string[]> = {
      1: Array.from({ length: FETCH_ALL_BATCH_SIZE }, (_, i) => `p1-${i}`),
      2: Array.from({ length: FETCH_ALL_BATCH_SIZE }, (_, i) => `p2-${i}`),
      3: ['p3-0', 'p3-1'], // short page → last one
    };
    const fetchPage = jest.fn(async (page: number) => ({
      items: pages[page] ?? [],
    }));

    const result = await fetchAllPages(fetchPage);

    expect(result).toHaveLength(FETCH_ALL_BATCH_SIZE * 2 + 2);
    expect(result[0]).toBe('p1-0');
    expect(result[result.length - 1]).toBe('p3-1');
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 1, FETCH_ALL_BATCH_SIZE);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 2, FETCH_ALL_BATCH_SIZE);
    expect(fetchPage).toHaveBeenNthCalledWith(3, 3, FETCH_ALL_BATCH_SIZE);
  });

  it('stops after a single call when the first page is already short (typical case for small catalogs)', async () => {
    const fetchPage = jest.fn(async () => ({ items: ['a', 'b', 'c'] }));

    const result = await fetchAllPages(fetchPage);

    expect(result).toEqual(['a', 'b', 'c']);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('returns an empty array when there is no data at all', async () => {
    const fetchPage = jest.fn(async () => ({ items: [] as string[] }));

    const result = await fetchAllPages(fetchPage);

    expect(result).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('does not loop forever if a buggy page keeps returning a full page (defensive MAX_PAGES cap)', async () => {
    const fetchPage = jest.fn(async () => ({
      items: Array.from({ length: FETCH_ALL_BATCH_SIZE }, (_, i) => `x-${i}`),
    }));

    const result = await fetchAllPages(fetchPage);

    expect(result).toHaveLength(FETCH_ALL_BATCH_SIZE * 500);
    expect(fetchPage).toHaveBeenCalledTimes(500);
  });
});
