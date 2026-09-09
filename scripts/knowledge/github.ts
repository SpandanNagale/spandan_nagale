export class RepoNotFoundError extends Error {
  readonly repo: string;
  constructor(repo: string) {
    super(`GitHub repo "${repo}" returned 404 — it may have been renamed, deleted, or made private.`);
    this.name = 'RepoNotFoundError';
    this.repo = repo;
  }
}

export interface RepoMeta {
  description: string | null;
  stars: number;
  pushedAt: string;
  defaultBranch: string;
}

export interface LanguageBreakdown {
  [language: string]: number;
}

export type FetchFn = typeof fetch;

const GITHUB_API = 'https://api.github.com';

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function githubGet(fetchFn: FetchFn, url: string, token: string): Promise<Response> {
  return fetchFn(url, { headers: authHeaders(token) });
}

export async function fetchRepoMeta(fetchFn: FetchFn, repo: string, token: string): Promise<RepoMeta> {
  const res = await githubGet(fetchFn, `${GITHUB_API}/repos/${repo}`, token);
  if (res.status === 404) throw new RepoNotFoundError(repo);
  if (!res.ok) throw new Error(`GitHub API error fetching ${repo}: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as {
    description: string | null;
    stargazers_count: number;
    pushed_at: string;
    default_branch: string;
  };
  return {
    description: data.description,
    stars: data.stargazers_count,
    pushedAt: data.pushed_at,
    defaultBranch: data.default_branch,
  };
}

export async function fetchLanguages(fetchFn: FetchFn, repo: string, token: string): Promise<LanguageBreakdown> {
  const res = await githubGet(fetchFn, `${GITHUB_API}/repos/${repo}/languages`, token);
  if (res.status === 404) throw new RepoNotFoundError(repo);
  if (!res.ok) throw new Error(`GitHub API error fetching languages for ${repo}: ${res.status} ${res.statusText}`);
  return (await res.json()) as LanguageBreakdown;
}

export async function fetchReadme(fetchFn: FetchFn, repo: string, token: string): Promise<string> {
  const res = await githubGet(fetchFn, `${GITHUB_API}/repos/${repo}/readme`, token);
  if (res.status === 404) return '';
  if (!res.ok) throw new Error(`GitHub API error fetching README for ${repo}: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as { content: string; encoding: string };
  if (data.encoding !== 'base64') throw new Error(`Unexpected README encoding for ${repo}: ${data.encoding}`);
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

export async function fetchFileContent(
  fetchFn: FetchFn,
  repo: string,
  path: string,
  token: string,
): Promise<string> {
  const res = await githubGet(fetchFn, `${GITHUB_API}/repos/${repo}/contents/${path}`, token);
  if (res.status === 404) {
    throw new Error(`key_files entry "${path}" not found in ${repo} — update content/projects.yaml`);
  }
  if (!res.ok) throw new Error(`GitHub API error fetching ${path} in ${repo}: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as { content: string; encoding: string };
  if (data.encoding !== 'base64') throw new Error(`Unexpected encoding for ${path} in ${repo}: ${data.encoding}`);
  return Buffer.from(data.content, 'base64').toString('utf-8');
}
