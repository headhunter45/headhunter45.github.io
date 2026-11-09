import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT_DIR, "src", "config", "projects.json");
const OUTPUT_DIR = path.join(ROOT_DIR, "src", "generated");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "resolvedProjects.json");

function extractRepoName(repoUrl) {
  if (!repoUrl) return null;
  try {
    const url = new URL(repoUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.length >= 2 ? parts[1].replace(/\.git$/, "") : null;
  } catch {
    return null;
  }
}

function toKebabCase(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

async function fetchGithubRepos(username) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": `${username}-github-io-sync`,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch(
      `https://api.github.com/users/${username}/repos?per_page=100&sort=updated`,
      { headers }
    );
    if (res.ok) {
      return await res.json();
    }
    console.warn(`[sync-pages] GitHub API returned ${res.status}, trying gh CLI fallback...`);
  } catch (err) {
    console.warn(`[sync-pages] Direct fetch failed (${err.message}), trying gh CLI fallback...`);
  }

  try {
    const stdout = execSync(
      `gh api "users/${username}/repos?per_page=100&sort=updated" --paginate`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );
    return JSON.parse(stdout);
  } catch {
    console.warn("[sync-pages] Offline or gh CLI unavailable; using static projects.json configuration.");
    return null;
  }
}

async function main() {
  const rawConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const username = rawConfig.profile?.username || "headhunter45";
  const siteUrl = (rawConfig.profile?.siteUrl || `https://${username}.github.io`).replace(/\/$/, "");
  const selfRepoName = `${username}.github.io`.toLowerCase();

  const ghRepos = await fetchGithubRepos(username);
  const repoMap = new Map();

  if (Array.isArray(ghRepos)) {
    for (const repo of ghRepos) {
      if (repo && repo.name) {
        repoMap.set(repo.name.toLowerCase(), repo);
      }
    }
    console.log(`[sync-pages] Loaded ${repoMap.size} repositories from GitHub for @${username}.`);
  }

  const seenRepoNames = new Set();
  const resolvedProjects = [];

  for (const item of rawConfig.projects || []) {
    const repoNameFromUrl = extractRepoName(item.repoUrl);
    const lookupKey = (repoNameFromUrl || item.label || "").toLowerCase();
    const ghRepo = repoMap.get(lookupKey);

    if (lookupKey) {
      seenRepoNames.add(lookupKey);
    }

    let pagesUrl = item.pagesUrl || undefined;
    if (!pagesUrl && ghRepo?.has_pages && lookupKey !== selfRepoName) {
      pagesUrl =
        ghRepo.homepage && ghRepo.homepage.startsWith("http")
          ? ghRepo.homepage
          : `${siteUrl}/${ghRepo.name}/`;
    }

    const repoUrl = item.repoUrl || ghRepo?.html_url || undefined;
    const canonicalRepoName = ghRepo?.name || repoNameFromUrl || item.label;

    // Build deduplicated alias list (preserving user aliases + helpful kebab-case slug)
    const aliasSet = new Set();
    for (const a of item.aliases || []) {
      if (a && a.trim()) aliasSet.add(a.trim());
    }
    const kebab = toKebabCase(canonicalRepoName);
    if (kebab && kebab !== canonicalRepoName.toLowerCase()) {
      aliasSet.add(kebab);
    }

    resolvedProjects.push({
      ...item,
      label: item.label || canonicalRepoName,
      ...(pagesUrl ? { pagesUrl } : {}),
      ...(repoUrl ? { repoUrl } : {}),
      aliases: Array.from(aliasSet),
      description:
        item.description ||
        ghRepo?.description ||
        "Source code repository and project documentation on GitHub.",
      language: item.language || ghRepo?.language || undefined,
      updatedAt: item.updatedAt || ghRepo?.updated_at || undefined,
      stars: typeof item.stars === "number" ? item.stars : ghRepo?.stargazers_count || 0,
      hasPages: Boolean(pagesUrl),
    });
  }

  // Dynamically discover any additional GitHub repos with has_pages: true not yet in config
  if (Array.isArray(ghRepos)) {
    for (const ghRepo of ghRepos) {
      const lowerName = ghRepo.name.toLowerCase();
      if (lowerName === selfRepoName || seenRepoNames.has(lowerName) || ghRepo.archived) {
        continue;
      }
      if (ghRepo.has_pages) {
        const pagesUrl =
          ghRepo.homepage && ghRepo.homepage.startsWith("http")
            ? ghRepo.homepage
            : `${siteUrl}/${ghRepo.name}/`;
        const aliasSet = new Set();
        const kebab = toKebabCase(ghRepo.name);
        if (kebab && kebab !== lowerName) {
          aliasSet.add(kebab);
        }
        resolvedProjects.push({
          label: ghRepo.name,
          pagesUrl,
          repoUrl: ghRepo.html_url,
          aliases: Array.from(aliasSet),
          description:
            ghRepo.description ||
            `Published GitHub Pages site and repository for ${ghRepo.name}.`,
          language: ghRepo.language || undefined,
          category: "Published Pages",
          tags: [ghRepo.language, "GitHub Pages"].filter(Boolean),
          updatedAt: ghRepo.updated_at,
          stars: ghRepo.stargazers_count || 0,
          hasPages: true,
          autoDiscovered: true,
        });
        seenRepoNames.add(lowerName);
        console.log(`[sync-pages] Dynamically added Pages repo: ${ghRepo.name} -> ${pagesUrl}`);
      }
    }
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const payload = {
    syncedAt: new Date().toISOString(),
    profile: rawConfig.profile,
    projects: resolvedProjects,
  };
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(
    `[sync-pages] Wrote ${resolvedProjects.length} projects (${
      resolvedProjects.filter((p) => p.pagesUrl).length
    } with Pages) to src/generated/resolvedProjects.json`
  );
}

main().catch((err) => {
  console.error("[sync-pages] Fatal error:", err);
  process.exit(1);
});

