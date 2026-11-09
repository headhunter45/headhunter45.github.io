import type { ProjectConfig, ProjectKind } from "../types";

export function normalizeSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function extractRepoName(repoUrl?: string): string | null {
  if (!repoUrl) return null;
  const match = repoUrl.match(/github\.com\/[^/]+\/([^/?#]+)/i);
  return match ? match[1].replace(/\.git$/i, "") : null;
}

export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

export function getProjectKind(project: ProjectConfig): ProjectKind {
  if (project.pagesUrl && !project.repoUrl) {
    return "external";
  }
  if (project.pagesUrl) {
    return "pages";
  }
  return "repo";
}

export function getAllRouteAliases(project: ProjectConfig): string[] {
  const set = new Set<string>();
  const repoName = extractRepoName(project.repoUrl);

  for (const a of project.aliases || []) {
    if (a.trim()) set.add(a.trim());
  }
  const kebab = toKebabCase(repoName || project.label);
  if (kebab && kebab !== project.label.toLowerCase()) {
    set.add(kebab);
  }
  if (project.label.toLowerCase() !== project.label) {
    set.add(project.label.toLowerCase());
  }
  return Array.from(set);
}

export interface RedirectResolution {
  project: ProjectConfig;
  targetUrl: string;
  matchedSegment: string;
}

export function resolveRedirectFromLocation(
  location: Location,
  projects: ProjectConfig[]
): RedirectResolution | null {
  const params = new URLSearchParams(location.search);
  const queryRedirect = params.get("redirect") || params.get("go") || params.get("repo");

  const rawPath = queryRedirect
    ? queryRedirect
    : location.pathname.replace(/^\/+|\/+$/g, "");

  if (!rawPath) return null;

  const segments = rawPath.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const firstSegment = decodeURIComponent(segments[0]);
  const restPath = segments.slice(1).join("/");
  const lowerFirst = firstSegment.toLowerCase();
  const compactFirst = normalizeSlug(firstSegment);

  for (const project of projects) {
    const repoName = extractRepoName(project.repoUrl);
    const candidates = [
      project.label,
      repoName || "",
      ...(project.aliases || []),
    ].filter(Boolean);

    const isMatch = candidates.some(
      (c) => c.toLowerCase() === lowerFirst || normalizeSlug(c) === compactFirst
    );

    if (isMatch) {
      const baseTarget = project.pagesUrl || project.repoUrl;
      if (!baseTarget) continue;

      let targetUrl = baseTarget;
      if (project.pagesUrl && restPath) {
        if (!targetUrl.endsWith("/")) targetUrl += "/";
        targetUrl += restPath;
      }
      if (!queryRedirect && location.search) {
        targetUrl += location.search;
      }
      if (location.hash) {
        targetUrl += location.hash;
      }

      return {
        project,
        targetUrl,
        matchedSegment: firstSegment,
      };
    }
  }

  return null;
}

interface GithubApiRepo {
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  has_pages: boolean;
  archived: boolean;
  fork: boolean;
  stargazers_count: number;
  language: string | null;
  updated_at: string;
}

const CACHE_KEY = "hh45_gh_repos_cache_v1";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function fetchAndMergeLiveProjects(
  initialProjects: ProjectConfig[],
  username: string,
  siteUrl: string
): Promise<{ projects: ProjectConfig[]; liveSynced: boolean }> {
  const normalizedSite = siteUrl.replace(/\/$/, "");
  const selfRepo = `${username}.github.io`.toLowerCase();

  let ghRepos: GithubApiRepo[] | null = null;

  try {
    const cachedRaw = sessionStorage.getItem(CACHE_KEY);
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw);
      if (parsed && Date.now() - parsed.timestamp < CACHE_TTL_MS && Array.isArray(parsed.data)) {
        ghRepos = parsed.data;
      }
    }
  } catch {
    // Ignore sessionStorage errors
  }

  if (!ghRepos) {
    try {
      const response = await fetch(
        `https://api.github.com/users/${username}/repos?per_page=100&sort=updated`,
        {
          headers: { Accept: "application/vnd.github+json" },
        }
      );
      if (!response.ok) {
        return { projects: initialProjects, liveSynced: false };
      }
      ghRepos = (await response.json()) as GithubApiRepo[];
      try {
        sessionStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ timestamp: Date.now(), data: ghRepos })
        );
      } catch {
        // Ignore quota errors
      }
    } catch {
      return { projects: initialProjects, liveSynced: false };
    }
  }

  if (!Array.isArray(ghRepos)) {
    return { projects: initialProjects, liveSynced: false };
  }

  const repoByName = new Map<string, GithubApiRepo>();
  for (const r of ghRepos) {
    if (r && r.name) {
      repoByName.set(r.name.toLowerCase(), r);
    }
  }

  const seenNames = new Set<string>();

  const merged: ProjectConfig[] = initialProjects.map((project) => {
    const repoName = extractRepoName(project.repoUrl) || project.label;
    const key = repoName.toLowerCase();
    seenNames.add(key);

    const gh = repoByName.get(key);
    if (!gh) return project;

    let pagesUrl = project.pagesUrl;
    if (!pagesUrl && gh.has_pages && key !== selfRepo) {
      pagesUrl =
        gh.homepage && gh.homepage.startsWith("http")
          ? gh.homepage
          : `${normalizedSite}/${gh.name}/`;
    }

    return {
      ...project,
      ...(pagesUrl ? { pagesUrl } : {}),
      repoUrl: project.repoUrl || gh.html_url,
      description:
        project.description ||
        gh.description ||
        "Source code repository and project documentation on GitHub.",
      language: project.language || gh.language || undefined,
      updatedAt: gh.updated_at || project.updatedAt,
      stars: typeof gh.stargazers_count === "number" ? gh.stargazers_count : project.stars,
      hasPages: Boolean(pagesUrl),
    };
  });

  // Also dynamically append any public repo with has_pages: true that isn't in projects.json yet
  for (const gh of ghRepos) {
    const key = gh.name.toLowerCase();
    if (key === selfRepo || seenNames.has(key) || gh.archived) {
      continue;
    }
    if (gh.has_pages) {
      const pagesUrl =
        gh.homepage && gh.homepage.startsWith("http")
          ? gh.homepage
          : `${normalizedSite}/${gh.name}/`;
      const kebab = toKebabCase(gh.name);
      merged.push({
        label: gh.name,
        pagesUrl,
        repoUrl: gh.html_url,
        aliases: kebab && kebab !== key ? [kebab] : [],
        description:
          gh.description || `Published GitHub Pages site and repository for ${gh.name}.`,
        language: gh.language || undefined,
        category: "Published Pages",
        tags: [gh.language, "GitHub Pages"].filter((x): x is string => Boolean(x)),
        updatedAt: gh.updated_at,
        stars: gh.stargazers_count || 0,
        hasPages: true,
        autoDiscovered: true,
      });
      seenNames.add(key);
    }
  }

  return { projects: merged, liveSynced: true };
}

