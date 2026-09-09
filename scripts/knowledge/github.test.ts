import { describe, expect, it, vi } from 'vitest';
import {
  RepoNotFoundError,
  fetchRepoMeta,
  fetchLanguages,
  fetchReadme,
  fetchTree,
  fetchFileContent,
  type FetchFn,
} from './github';

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText: status === 404 ? 'Not Found' : 'OK',
    json: async () => body,
  } as unknown as Response;
}

describe('fetchRepoMeta', () => {
  it('returns parsed repo metadata on success', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse(200, {
        description: 'A test repo',
        stargazers_count: 12,
        pushed_at: '2026-01-01T00:00:00Z',
        default_branch: 'main',
      }),
    ) as unknown as FetchFn;
    const meta = await fetchRepoMeta(fetchFn, 'owner/repo', 'token');
    expect(meta).toEqual({
      description: 'A test repo',
      stars: 12,
      pushedAt: '2026-01-01T00:00:00Z',
      defaultBranch: 'main',
    });
  });

  it('throws RepoNotFoundError on 404', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(404, {})) as unknown as FetchFn;
    await expect(fetchRepoMeta(fetchFn, 'owner/missing', 'token')).rejects.toThrow(RepoNotFoundError);
  });

  it('sends an authorization header with the token', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse(200, {
        description: null,
        stargazers_count: 0,
        pushed_at: '2026-01-01T00:00:00Z',
        default_branch: 'main',
      }),
    );
    await fetchRepoMeta(fetchFn as unknown as FetchFn, 'owner/repo', 'secret-token');
    const [, init] = fetchFn.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer secret-token' });
  });
});

describe('fetchLanguages', () => {
  it('returns the language byte-count map', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, { Python: 5000, HTML: 200 })) as unknown as FetchFn;
    expect(await fetchLanguages(fetchFn, 'owner/repo', 'token')).toEqual({ Python: 5000, HTML: 200 });
  });

  it('throws RepoNotFoundError on 404', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(404, {})) as unknown as FetchFn;
    await expect(fetchLanguages(fetchFn, 'owner/missing', 'token')).rejects.toThrow(RepoNotFoundError);
  });
});

describe('fetchReadme', () => {
  it('decodes base64 README content', async () => {
    const encoded = Buffer.from('# Hello').toString('base64');
    const fetchFn = vi.fn(async () => jsonResponse(200, { content: encoded, encoding: 'base64' })) as unknown as FetchFn;
    expect(await fetchReadme(fetchFn, 'owner/repo', 'token')).toBe('# Hello');
  });

  it('returns an empty string when there is no README, without throwing', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(404, {})) as unknown as FetchFn;
    expect(await fetchReadme(fetchFn, 'owner/repo', 'token')).toBe('');
  });
});

describe('fetchTree', () => {
  it('filters to two levels deep and caps at 200 entries', async () => {
    const shallowEntries = Array.from({ length: 250 }, (_, i) => ({ path: `src/file${i}.ts`, type: 'blob' }));
    const tooDeep = { path: 'src/nested/too/deep.ts', type: 'blob' };
    const fetchFn = vi.fn(async () => jsonResponse(200, { tree: [...shallowEntries, tooDeep] })) as unknown as FetchFn;
    const tree = await fetchTree(fetchFn, 'owner/repo', 'main', 'token');
    expect(tree.length).toBe(200);
    expect(tree.every((entry) => entry.path.split('/').length <= 2)).toBe(true);
  });

  it('throws RepoNotFoundError on 404', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(404, {})) as unknown as FetchFn;
    await expect(fetchTree(fetchFn, 'owner/missing', 'main', 'token')).rejects.toThrow(RepoNotFoundError);
  });
});

describe('fetchFileContent', () => {
  it('decodes base64 file content', async () => {
    const encoded = Buffer.from('print("hi")').toString('base64');
    const fetchFn = vi.fn(async () => jsonResponse(200, { content: encoded, encoding: 'base64' })) as unknown as FetchFn;
    expect(await fetchFileContent(fetchFn, 'owner/repo', 'src/main.py', 'token')).toBe('print("hi")');
  });

  it('throws a descriptive error when the key_files path does not exist', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(404, {})) as unknown as FetchFn;
    await expect(fetchFileContent(fetchFn, 'owner/repo', 'missing.py', 'token')).rejects.toThrow(/missing\.py/);
  });
});
