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

function normalizeTagVariants(tag: string): string[] {
  const clean = tag.trim().toLowerCase();
  if (!clean) return [];
  const variants = [clean];
  if (clean.endsWith("s") && clean.length > 2) {
    variants.push(clean.slice(0, -1));
  } else {
    variants.push(`${clean}s`);
  }
  return variants;
}

export function getProjectTags(project: ProjectConfig): string[] {
  const list: string[] = [];
  const seen = new Set<string>();
  for (const t of project.tags || []) {
    const trimmed = t.trim();
    if (trimmed && !seen.has(trimmed.toLowerCase())) {
      seen.add(trimmed.toLowerCase());
      list.push(trimmed);
    }
  }
  if (project.language && !seen.has(project.language.toLowerCase())) {
    seen.add(project.language.toLowerCase());
    list.push(project.language);
  }
  return list;
}

/**
 * Checks whether a project has a tag matching `targetTag` (case-insensitive,
 * handling singular/plural variants like `app` <-> `apps` and word tokens inside multi-word tags).
 */
export function projectHasTag(project: ProjectConfig, targetTag: string): boolean {
  const targetVariants = normalizeTagVariants(targetTag);
  if (targetVariants.length === 0) return false;

  const projectTags = getProjectTags(project).map((t) => t.toLowerCase());
  return projectTags.some((pt) => {
    if (targetVariants.includes(pt)) return true;
    const words = pt.split(/[\s/+-]+/).filter(Boolean);
    return words.some((w) => targetVariants.includes(w));
  });
}

/**
 * Formats a tag for the search input: uses `"tag:name with spaces"` when the tag contains spaces,
 * or `tag:name` otherwise.
 */
export function formatTagQueryToken(tag: string): string {
  const clean = tag.trim().toLowerCase();
  return clean.includes(" ") ? `"tag:${clean}"` : `tag:${clean}`;
}

/**
 * Projects tagged with "app" (or "apps") OR projects that have published repo pages
 * belong in the Apps section.
 */
export function isAppProject(project: ProjectConfig): boolean {
  if (Boolean(project.pagesUrl)) return true;
  const tags = getProjectTags(project).map((t) => t.toLowerCase());
  return tags.includes("app") || tags.includes("apps");
}

/**
 * Projects tagged with "extension" or "plugin" belong in the Extensions section.
 */
export function isExtensionProject(project: ProjectConfig): boolean {
  const tags = getProjectTags(project).map((t) => t.toLowerCase());
  return (
    tags.includes("extension") ||
    tags.includes("extensions") ||
    tags.includes("plugin") ||
    tags.includes("plugins")
  );
}

/**
 * Sorts projects by repository popularity (stars descending), falling back to
 * most recently updated (updatedAt descending) and then alphabetical label.
 */
export function sortProjectsByPopularity(projects: ProjectConfig[]): ProjectConfig[] {
  return [...projects].sort((a, b) => {
    const starsDiff = (b.stars || 0) - (a.stars || 0);
    if (starsDiff !== 0) return starsDiff;

    const timeA = a.updatedAt ? Date.parse(a.updatedAt) : 0;
    const timeB = b.updatedAt ? Date.parse(b.updatedAt) : 0;
    if (timeB !== timeA) return timeB - timeA;

    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });
}

export interface ParsedSearchQuery {
  explicitTags: string[];
  freeTerms: string[];
}

/**
 * Parses a search query supporting:
 * - `"tag:blah blah"` or `tag:"blah blah"` for multi-word tags
 * - `tag:apps` for single-word tags
 * - Quoted phrases `"blah blah"` and unquoted tokens
 */
export function parseSearchQuery(rawQuery: string): ParsedSearchQuery {
  const explicitTags: string[] = [];

  const tagRegex = /"tag:([^"]+)"|tag:"([^"]+)"|tag:([^\s"]+)/gi;
  const remainder = rawQuery
    .replace(tagRegex, (_match, q1, q2, q3) => {
      const val = (q1 || q2 || q3 || "").trim().toLowerCase();
      if (val) explicitTags.push(val);
      return " ";
    })
    .trim();

  const freeTerms: string[] = [];
  if (remainder) {
    const tokenRegex = /"([^"]+)"|(\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = tokenRegex.exec(remainder)) !== null) {
      const term = (m[1] || m[2] || "").trim().toLowerCase();
      if (term) freeTerms.push(term);
    }
  }

  return {
    explicitTags,
    freeTerms,
  };
}

/**
 * Filters projects case-insensitively by repo name and tags:
 * - Explicit `tag:apps` and `"tag:blah blah"` force a tag filter.
 * - If a search substring matches a known tag name, it is treated as a tag filter
 *   while any remaining text is searched against repo names (and tags).
 */
export function filterProjectsByQuery(
  projects: ProjectConfig[],
  rawQuery: string
): ProjectConfig[] {
  if (!rawQuery.trim()) return projects;

  const { explicitTags, freeTerms } = parseSearchQuery(rawQuery);

  // Collect all known tag names (sorted longest first so multi-word tags match first)
  const knownTagsSet = new Set<string>();
  for (const p of projects) {
    for (const t of getProjectTags(p)) {
      for (const v of normalizeTagVariants(t)) {
        knownTagsSet.add(v);
      }
    }
  }
  const knownMultiWordTags = Array.from(knownTagsSet)
    .filter((t) => t.includes(" "))
    .sort((a, b) => b.length - a.length);

  // Reconstruct free text to detect unquoted multi-word tag substrings
  let remainingFreeText = freeTerms.join(" ").toLowerCase();
  const inferredMultiWordTags: string[] = [];

  for (const mwTag of knownMultiWordTags) {
    if (remainingFreeText.includes(mwTag)) {
      inferredMultiWordTags.push(mwTag);
      remainingFreeText = remainingFreeText.replace(mwTag, " ").trim();
    }
  }

  const remainingTokens = remainingFreeText
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return projects.filter((project) => {
    // 1. Every explicit `tag:...` filter must match a tag on the project
    for (const requiredTag of explicitTags) {
      if (!projectHasTag(project, requiredTag)) {
        return false;
      }
    }

    // 2. Any matched multi-word tag substring must match the project's tags or name
    const repoName = (extractRepoName(project.repoUrl) || "").toLowerCase();
    const labelLower = project.label.toLowerCase();

    for (const mwTag of inferredMultiWordTags) {
      if (
        !projectHasTag(project, mwTag) &&
        !labelLower.includes(mwTag) &&
        !repoName.includes(mwTag)
      ) {
        return false;
      }
    }

    // 3. Every remaining token: if it matches a known tag name, treat it as a tag (or name) match;
    //    otherwise text-search against the repo name (and partial tag names).
    for (const token of remainingTokens) {
      const matchesName =
        labelLower.includes(token) || repoName.includes(token);
      const matchesTag =
        projectHasTag(project, token) ||
        getProjectTags(project).some((t) => t.toLowerCase().includes(token));

      if (!matchesName && !matchesTag) {
        return false;
      }
    }

    return true;
  });
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
  if (!segments.length) return null;

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
