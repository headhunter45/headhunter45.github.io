import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ProjectEntry {
  label: string;
  pagesUrl?: string;
  repoUrl?: string;
  aliases?: string[];
  description?: string;
}

function getExactPagesMountSlug(pagesUrl?: string, siteUrl = "https://headhunter45.github.io"): string | null {
  if (!pagesUrl) return null;
  const normalizedSite = siteUrl.replace(/\/$/, "");
  if (!pagesUrl.toLowerCase().startsWith(normalizedSite.toLowerCase() + "/")) {
    return null;
  }
  const remainder = pagesUrl.slice(normalizedSite.length + 1).replace(/\/+$/, "");
  if (!remainder || remainder.includes("/")) return null;
  return remainder;
}

function createRedirectHtml(targetUrl: string, label: string, alias: string): string {
  const safeTarget = JSON.stringify(targetUrl);
  const escapedTarget = targetUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <title>Redirecting to ${label}…</title>
    <link rel="canonical" href="${escapedTarget}" />
    <meta http-equiv="refresh" content="0; url=${escapedTarget}" />
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0;
        min-height: 100dvh;
        display: grid;
        place-items: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: #090d16;
        color: #f8fafc;
      }
      .card {
        padding: 24px 32px;
        border-radius: 16px;
        background: rgba(30, 41, 59, 0.75);
        border: 1px solid rgba(148, 163, 184, 0.18);
        text-align: center;
        max-width: 440px;
      }
      a { color: #38bdf8; text-decoration: none; font-weight: 600; }
      a:hover { text-decoration: underline; }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        background: rgba(15, 23, 42, 0.8);
        padding: 2px 6px;
        border-radius: 6px;
        color: #a5b4fc;
      }
    </style>
    <script>
      (function () {
        var baseTarget = ${safeTarget};
        var search = window.location.search || "";
        var hash = window.location.hash || "";
        window.location.replace(baseTarget + search + hash);
      })();
    </script>
  </head>
  <body>
    <div class="card">
      <p>Redirecting <code>/${alias}</code> to <strong>${label}</strong>…</p>
      <p><a href="${escapedTarget}">Click here if you are not redirected automatically</a></p>
    </div>
  </body>
</html>
`;
}

function createSmart404Html(projects: ProjectEntry[], username = "headhunter45"): string {
  const serializedProjects = JSON.stringify(
    projects.map((p) => ({
      label: p.label,
      pagesUrl: p.pagesUrl,
      repoUrl: p.repoUrl,
      aliases: p.aliases || [],
      description: p.description || "",
    }))
  );

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <title>Redirecting • ${username}.github.io</title>
    <style>
      :root {
        color-scheme: light dark;
        --bg: #090d16;
        --card: rgba(30, 41, 59, 0.82);
        --border: rgba(148, 163, 184, 0.16);
        --text: #f8fafc;
        --muted: #94a3b8;
        --cyan: #38bdf8;
        --indigo: #6366f1;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100dvh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.15) 0%, transparent 60%), var(--bg);
        color: var(--text);
      }
      .panel {
        width: 100%;
        max-width: 640px;
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 32px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 4px 12px;
        border-radius: 9999px;
        font-size: 12px;
        font-weight: 600;
        background: rgba(56, 189, 248, 0.12);
        color: var(--cyan);
        border: 1px solid rgba(56, 189, 248, 0.3);
      }
      h1 {
        margin: 16px 0 8px;
        font-size: 24px;
        letter-spacing: -0.5px;
      }
      p {
        margin: 0 0 20px;
        color: var(--muted);
        line-height: 1.6;
        font-size: 15px;
      }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        background: rgba(15, 23, 42, 0.85);
        padding: 2px 7px;
        border-radius: 6px;
        color: #a5b4fc;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 12px;
        margin-top: 20px;
      }
      .item {
        display: block;
        padding: 12px 14px;
        border-radius: 12px;
        background: rgba(15, 23, 42, 0.75);
        border: 1px solid var(--border);
        color: var(--text);
        text-decoration: none;
        transition: border-color 0.15s ease, transform 0.15s ease;
      }
      .item:hover {
        border-color: var(--cyan);
        transform: translateY(-1px);
      }
      .item-title {
        font-weight: 700;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .item-tag {
        font-size: 10px;
        text-transform: uppercase;
        padding: 2px 6px;
        border-radius: 999px;
        background: rgba(99, 102, 241, 0.2);
        color: #a5b4fc;
      }
      .actions {
        margin-top: 24px;
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }
      .btn {
        display: inline-flex;
        align-items: center;
        padding: 10px 18px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        text-decoration: none;
        background: linear-gradient(135deg, #0284c7, #6366f1);
        color: white;
      }
      .btn-secondary {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid var(--border);
      }
    </style>
  </head>
  <body>
    <main class="panel" id="panel">
      <span class="badge" id="status-badge">Resolving Path…</span>
      <h1 id="title">Checking project redirects…</h1>
      <p id="message">Looking for a matching GitHub Pages site or repository for <code id="path-code"></code>.</p>
      <div id="fallback-content" style="display: none;">
        <div class="grid" id="project-links"></div>
        <div class="actions">
          <a href="/" class="btn">← Back to Profile Home</a>
          <a href="https://github.com/${username}" class="btn btn-secondary">View @${username} on GitHub</a>
        </div>
      </div>
    </main>
    <script>
      (function () {
        var PROJECTS = ${serializedProjects};
        var USERNAME = ${JSON.stringify(username)};

        function normalizeKey(str) {
          return String(str || "")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");
        }

        function extractRepoName(url) {
          if (!url) return "";
          var m = String(url).match(/github\\.com\\/[^/]+\\/([^/?#]+)/i);
          return m ? m[1].replace(/\\.git$/i, "") : "";
        }

        var pathname = window.location.pathname || "/";
        var segments = pathname.split("/").filter(Boolean);
        var pathCode = document.getElementById("path-code");
        if (pathCode) pathCode.textContent = pathname;

        if (segments.length === 0) {
          window.location.replace("/");
          return;
        }

        var firstSegment = decodeURIComponent(segments[0]);
        var restPath = segments.slice(1).join("/");
        var search = window.location.search || "";
        var hash = window.location.hash || "";

        var exactLower = firstSegment.toLowerCase();
        var compactKey = normalizeKey(firstSegment);

        var matched = null;
        for (var i = 0; i < PROJECTS.length; i++) {
          var p = PROJECTS[i];
          var repoName = extractRepoName(p.repoUrl);
          var candidates = [p.label, repoName].concat(p.aliases || []).filter(Boolean);

          for (var j = 0; j < candidates.length; j++) {
            var c = candidates[j];
            if (c.toLowerCase() === exactLower || normalizeKey(c) === compactKey) {
              matched = p;
              break;
            }
          }
          if (matched) break;
        }

        function performRedirect(targetBase, label, preserveSubpath) {
          if (!targetBase) return;
          var finalUrl = targetBase;
          if (preserveSubpath && restPath) {
            if (!finalUrl.endsWith("/")) finalUrl += "/";
            finalUrl += restPath;
          }
          finalUrl += search + hash;
          var badge = document.getElementById("status-badge");
          var title = document.getElementById("title");
          var msg = document.getElementById("message");
          if (badge) badge.textContent = "Redirecting";
          if (title) title.textContent = "Redirecting to " + label + "…";
          if (msg) msg.innerHTML = 'Taking you to <a href="' + finalUrl + '" style="color:#38bdf8">' + finalUrl + "</a>";
          window.location.replace(finalUrl);
        }

        if (matched) {
          if (matched.pagesUrl) {
            performRedirect(matched.pagesUrl, matched.label, true);
            return;
          }
          if (matched.repoUrl) {
            performRedirect(matched.repoUrl, matched.label + " (GitHub Repository)", false);
            return;
          }
        }

        // Dynamic fallback: query GitHub API in case a repo was added or Pages enabled after deploy
        fetch("https://api.github.com/users/" + USERNAME + "/repos?per_page=100")
          .then(function (r) { return r.ok ? r.json() : []; })
          .then(function (repos) {
            if (Array.isArray(repos)) {
              for (var k = 0; k < repos.length; k++) {
                var repo = repos[k];
                if (!repo || !repo.name) continue;
                if (
                  repo.name.toLowerCase() === exactLower ||
                  normalizeKey(repo.name) === compactKey
                ) {
                  if (repo.has_pages) {
                    var pagesTarget = "https://" + USERNAME + ".github.io/" + repo.name + "/";
                    performRedirect(pagesTarget, repo.name, true);
                    return;
                  } else if (repo.html_url) {
                    performRedirect(repo.html_url, repo.name + " (GitHub)", false);
                    return;
                  }
                }
              }
            }
            showNotFound();
          })
          .catch(function () {
            showNotFound();
          });

        function showNotFound() {
          var badge = document.getElementById("status-badge");
          var title = document.getElementById("title");
          var msg = document.getElementById("message");
          var fallback = document.getElementById("fallback-content");
          var grid = document.getElementById("project-links");
          if (badge) badge.textContent = "404 • Route Not Found";
          if (title) title.textContent = "Project or page not found";
          if (msg) {
            msg.innerHTML =
              "Could not find a project matching <code>" +
              pathname.replace(/</g, "&lt;") +
              "</code>. Here are available projects and pages:";
          }
          if (grid) {
            grid.innerHTML = PROJECTS.map(function (p) {
              var href = p.pagesUrl || p.repoUrl || "#";
              var tag = p.pagesUrl ? "Pages" : "Repo";
              return (
                '<a class="item" href="' +
                href +
                '">' +
                '<div class="item-title"><span>' +
                p.label +
                '</span><span class="item-tag">' +
                tag +
                "</span></div>" +
                "</a>"
              );
            }).join("");
          }
          if (fallback) fallback.style.display = "block";
        }
      })();
    </script>
  </body>
</html>
`;
}

function githubPagesRedirectPlugin(): Plugin {
  return {
    name: "github-pages-redirect-plugin",
    closeBundle() {
      const outDir = path.resolve(__dirname, "dist");
      if (!fs.existsSync(outDir)) return;

      const resolvedPath = path.resolve(__dirname, "src", "generated", "resolvedProjects.json");
      const rawConfigPath = path.resolve(__dirname, "src", "config", "projects.json");
      const sourcePath = fs.existsSync(resolvedPath) ? resolvedPath : rawConfigPath;
      const data = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
      const projects: ProjectEntry[] = data.projects || [];
      const username: string = data.profile?.username || "headhunter45";
      const siteUrl: string = data.profile?.siteUrl || `https://${username}.github.io`;

      // Collect all GitHub Pages mount slugs (case-insensitive) so static folders never shadow a project's live Pages mount;
      // 404.html handles case-variants of active Pages mounts (like /nextclouduploadtool or /OpenTasks) while preserving subpaths.
      const reservedMountsLower = new Set<string>();
      for (const p of projects) {
        const mount = getExactPagesMountSlug(p.pagesUrl, siteUrl);
        if (mount) {
          reservedMountsLower.add(mount.toLowerCase());
        }
      }

      const generatedSlugsLower = new Set<string>();
      let count = 0;

      for (const p of projects) {
        const targetUrl = p.pagesUrl || p.repoUrl;
        if (!targetUrl) continue;

        const candidateSlugs = new Set<string>();
        // Add configured aliases
        for (const alias of p.aliases || []) {
          if (alias && alias.trim()) {
            candidateSlugs.add(alias.trim().toLowerCase());
          }
        }
        // Add lowercase repo name or slug-safe label
        const repoMatch = p.repoUrl?.match(/github\.com\/[^/]+\/([^/?#]+)/i);
        const repoName = repoMatch ? repoMatch[1].replace(/\.git$/i, "") : null;
        if (repoName) {
          candidateSlugs.add(repoName.toLowerCase());
        } else if (p.label && /^[a-z0-9._-]+$/i.test(p.label)) {
          candidateSlugs.add(p.label.toLowerCase());
        }

        for (const slug of candidateSlugs) {
          const lower = slug.toLowerCase();
          if (
            !slug ||
            !/^[a-z0-9._-]+$/i.test(slug) ||
            slug === "." ||
            slug === ".." ||
            lower === "assets" ||
            reservedMountsLower.has(lower) ||
            generatedSlugsLower.has(lower)
          ) {
            continue;
          }

          const slugDir = path.join(outDir, slug);
          fs.mkdirSync(slugDir, { recursive: true });
          fs.writeFileSync(
            path.join(slugDir, "index.html"),
            createRedirectHtml(targetUrl, p.label, slug),
            "utf8"
          );
          generatedSlugsLower.add(lower);
          count++;
        }
      }

      // Write 404.html for dynamic case-insensitive and subpath redirects
      fs.writeFileSync(
        path.join(outDir, "404.html"),
        createSmart404Html(projects, username),
        "utf8"
      );

      // Write .nojekyll so GitHub Pages serves all files and directories cleanly
      fs.writeFileSync(path.join(outDir, ".nojekyll"), "", "utf8");
      console.log(
        `[redirect-plugin] Generated ${count} static redirect routes, 404.html router, and .nojekyll.`
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), githubPagesRedirectPlugin()],
  base: "/",
});
