import { useEffect, useMemo, useState } from "react";
import resolvedConfigJson from "./generated/resolvedProjects.json";
import type { ProjectConfig, SiteConfig } from "./types";
import {
  extractRepoName,
  fetchAndMergeLiveProjects,
  getAllRouteAliases,
  getProjectKind,
  resolveRedirectFromLocation,
} from "./utils/projects";

const initialConfig = resolvedConfigJson as SiteConfig;

const LANGUAGE_BADGE_COLORS: Record<string, string> = {
  Rust: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  Python: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  TypeScript: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  "C++": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  Java: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  "C#": "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30",
};

function getLanguageBadgeClass(language?: string): string {
  if (!language) {
    return "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30";
  }
  return (
    LANGUAGE_BADGE_COLORS[language] ||
    "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30"
  );
}

export function App() {
  const { profile } = initialConfig;
  const [projects, setProjects] = useState<ProjectConfig[]>(
    () => initialConfig.projects || []
  );
  const [liveSynced, setLiveSynced] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [isFlyoutOpen, setIsFlyoutOpen] = useState<boolean>(false);
  const [redirectingTo, setRedirectingTo] = useState<{
    label: string;
    targetUrl: string;
  } | null>(null);

  // Listen for the ` (Backquote) key below Escape to toggle the bottom flyout panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (!isEditable && (e.key === "`" || e.code === "Backquote")) {
        e.preventDefault();
        setIsFlyoutOpen((prev) => !prev);
      } else if (e.key === "Escape" && isFlyoutOpen && !isEditable) {
        setIsFlyoutOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFlyoutOpen]);

  // Check if current URL path or ?redirect= query matches a project redirect
  useEffect(() => {
    const match = resolveRedirectFromLocation(window.location, projects);
    if (match) {
      setRedirectingTo({
        label: match.project.label,
        targetUrl: match.targetUrl,
      });
      window.location.replace(match.targetUrl);
    }
  }, [projects]);

  // Dynamically check GitHub API for newly published Pages repos & metadata updates
  useEffect(() => {
    let active = true;
    fetchAndMergeLiveProjects(
      initialConfig.projects || [],
      profile.username,
      profile.siteUrl
    ).then(({ projects: updated, liveSynced: synced }) => {
      if (active && synced) {
        setProjects(updated);
        setLiveSynced(true);
      }
    });
    return () => {
      active = false;
    };
  }, [profile.username, profile.siteUrl]);

  const categories = useMemo(() => {
    const set = new Set<string>(["All"]);
    for (const p of projects) {
      if (p.category) set.add(p.category);
    }
    return Array.from(set);
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projects.filter((p) => {
      if (selectedCategory !== "All" && p.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      const aliases = getAllRouteAliases(p);
      return (
        p.label.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.language && p.language.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.tags && p.tags.some((t) => t.toLowerCase().includes(q))) ||
        aliases.some((a) => a.toLowerCase().includes(q))
      );
    });
  }, [projects, searchQuery, selectedCategory]);

  const publishedPagesProjects = useMemo(
    () => filteredProjects.filter((p) => Boolean(p.pagesUrl)),
    [filteredProjects]
  );

  const repoOnlyProjects = useMemo(
    () => filteredProjects.filter((p) => !p.pagesUrl),
    [filteredProjects]
  );

  const totalAliasesCount = useMemo(
    () =>
      projects.reduce((acc, p) => acc + getAllRouteAliases(p).length + 1, 0),
    [projects]
  );

  const handleCopyShortUrl = (slug: string) => {
    const base = profile.siteUrl.replace(/\/$/, "");
    const url = `${base}/${slug}`;
    navigator.clipboard?.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => {
      setCopiedSlug((prev) => (prev === slug ? null : prev));
    }, 1800);
  };

  const renderRedirectsTable = (captionText: string) => (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <caption className="visually-hidden">{captionText}</caption>
          <thead>
            <tr className="bg-slate-100/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400">
              <th scope="col" className="py-3.5 px-5">
                Project
              </th>
              <th scope="col" className="py-3.5 px-5">
                Target Destination
              </th>
              <th scope="col" className="py-3.5 px-5">
                Short Aliases &amp; Case Variants
              </th>
              <th scope="col" className="py-3.5 px-5 text-right">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
            {projects.map((project) => {
              const target = project.pagesUrl || project.repoUrl || "#";
              const aliases = getAllRouteAliases(project);
              const repoName = extractRepoName(project.repoUrl);
              return (
                <tr
                  key={project.label}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                >
                  <td className="py-3.5 px-5 font-semibold text-slate-900 dark:text-white">
                    {project.label}
                  </td>
                  <td className="py-3.5 px-5 font-mono text-xs">
                    <a
                      href={target}
                      className="text-sky-600 dark:text-sky-400 hover:underline break-all"
                    >
                      {target}
                    </a>
                  </td>
                  <td className="py-3.5 px-5">
                    <div className="flex flex-wrap gap-1.5">
                      {aliases.map((alias) => (
                        <button
                          key={alias}
                          type="button"
                          onClick={() => handleCopyShortUrl(alias)}
                          className="px-2 py-0.5 rounded font-mono text-xs bg-slate-100 dark:bg-slate-950 text-indigo-600 dark:text-indigo-300 border border-slate-200 dark:border-slate-800 hover:border-sky-500/50 cursor-pointer"
                        >
                          /{alias}
                          {copiedSlug === alias && (
                            <span className="ml-1 text-emerald-500">✓</span>
                          )}
                        </button>
                      ))}
                      {repoName && (
                        <span className="px-2 py-0.5 rounded font-mono text-xs text-slate-400 dark:text-slate-500">
                          /{repoName.toUpperCase()} (any case)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    {project.pagesUrl ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                        Pages Site
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        Repo Fallback
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (redirectingTo) {
    return (
      <div className="min-h-dvh bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900/90 p-8 text-center shadow-2xl">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30 mb-4">
            <span className="w-2 h-2 rounded-full bg-sky-400 eyebrow-dot" />
            Redirecting…
          </span>
          <h1 className="text-xl font-bold text-white">
            Opening {redirectingTo.label}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Redirecting you to{" "}
            <a
              href={redirectingTo.targetUrl}
              className="text-sky-400 underline break-all"
            >
              {redirectingTo.targetUrl}
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-dvh overflow-hidden bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 selection:bg-sky-500/20 selection:text-sky-400">
      {/* Main Scrollable Viewport Area (nudged up when bottom flyout is open) */}
      <div
        className={`absolute inset-x-0 top-0 overflow-y-auto overscroll-contain scroll-smooth flex flex-col transition-[bottom] duration-200 ${
          isFlyoutOpen ? "bottom-[42dvh]" : "bottom-0"
        }`}
      >
        {/* Sticky Top Header (NextcloudUploadTool + opentasks hybrid) */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-[#090d16]/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <a
            href="#top"
            className="flex items-center gap-3 font-bold text-base tracking-tight text-slate-900 dark:text-white"
          >
            <span
              aria-hidden="true"
              className="w-9 h-9 rounded-lg brand-gradient-bg text-white font-extrabold text-sm flex items-center justify-center shadow-md shadow-indigo-500/25"
            >
              H45
            </span>
            <span>{profile.username}</span>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              {liveSynced ? "Live GitHub Sync" : "GitHub Pages Hub"}
            </span>
          </a>

          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            <a
              href="#published-pages"
              className="hover:text-sky-600 dark:hover:text-sky-400 transition"
            >
              Published Pages ({ projects.filter((p) => p.pagesUrl).length })
            </a>
            <a
              href="#repositories"
              className="hover:text-sky-600 dark:hover:text-sky-400 transition"
            >
              Repositories ({ projects.filter((p) => !p.pagesUrl).length })
            </a>
            <a
              href="#redirects"
              className="hover:text-sky-600 dark:hover:text-sky-400 transition"
            >
              Redirects &amp; Aliases
            </a>
            <a
              href="#config-guide"
              className="hover:text-sky-600 dark:hover:text-sky-400 transition"
            >
              Config Schema
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            {profile.blogUrl && (
              <a
                href={profile.blogUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border border-slate-300 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-900 transition"
              >
                sfcoder.me
              </a>
            )}
            <a
              href={profile.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-sm shadow-sky-600/20 transition"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="w-4 h-4 fill-current"
              >
                <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .31.2.69.82.57A12 12 0 0 0 12 .3Z" />
              </svg>
              <span>@{profile.username}</span>
            </a>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero / Profile Section */}
        <section className="relative overflow-hidden py-14 sm:py-20 border-b border-slate-200 dark:border-slate-800/80 bg-gradient-to-b from-sky-50/70 via-white to-slate-50 dark:from-indigo-950/30 dark:via-[#090d16] dark:to-[#090d16]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              {/* Left Column: Profile Intro */}
              <div className="lg:col-span-8">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25 mb-6">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 eyebrow-dot" />
                  <span>
                    {profile.name} (@{profile.username})
                  </span>
                  {profile.company && (
                    <>
                      <span aria-hidden="true">•</span>
                      <span>{profile.company}</span>
                    </>
                  )}
                  {profile.location && (
                    <>
                      <span aria-hidden="true">•</span>
                      <span>{profile.location}</span>
                    </>
                  )}
                </div>

                <h1 className="hero-headline font-extrabold text-slate-900 dark:text-white">
                  Open-Source Tools,{" "}
                  <span className="brand-gradient-text">
                    Published Web Portals
                  </span>{" "}
                  &amp; Project Directory
                </h1>

                <p className="mt-5 text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                  {profile.bio}
                </p>

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <a
                    href="#published-pages"
                    className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/20 transition"
                  >
                    Explore Published Sites
                  </a>
                  <a
                    href="#repositories"
                    className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Browse Repositories
                  </a>
                  <a
                    href="#redirects"
                    className="px-4 py-2.5 rounded-xl font-medium text-sm text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 transition"
                  >
                    View Short Redirects →
                  </a>
                </div>
              </div>

              {/* Right Column: Profile Card & Quick Stats */}
              <div className="lg:col-span-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/75 p-6 shadow-xl">
                  <div className="flex items-center gap-4">
                    <img
                      src={profile.avatarUrl}
                      alt={`${profile.name} (@${profile.username})`}
                      width={64}
                      height={64}
                      className="w-16 h-16 rounded-2xl border-2 border-sky-500/40 object-cover aspect-square shadow-md"
                    />
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        {profile.name}
                      </h2>
                      <p className="text-sm font-mono text-sky-600 dark:text-sky-400">
                        @{profile.username}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        {profile.company && <span>{profile.company}</span>}
                        {profile.location && <span>• {profile.location}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-2.5 pt-5 border-t border-slate-200 dark:border-slate-800 text-center">
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 p-2.5 border border-slate-200/60 dark:border-slate-800/80">
                      <div className="text-xl font-extrabold text-sky-600 dark:text-sky-400 font-mono">
                        {projects.filter((p) => p.pagesUrl).length}
                      </div>
                      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Pages Sites
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 p-2.5 border border-slate-200/60 dark:border-slate-800/80">
                      <div className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                        {projects.length}
                      </div>
                      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Featured Repos
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 p-2.5 border border-slate-200/60 dark:border-slate-800/80">
                      <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                        {totalAliasesCount}+
                      </div>
                      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Redirect Routes
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Case-insensitive route resolver</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      Active
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Search & Category Filter Bar */}
            <div className="mt-10 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="relative flex-1">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by project name, alias (/nut, /ot, /obb), language, or tag…"
                  aria-label="Filter projects and aliases"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div
                className="flex flex-wrap items-center gap-1.5"
                role="group"
                aria-label="Filter by category"
              >
                {categories.map((cat) => {
                  const active = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        active
                          ? "bg-sky-600 text-white shadow-sm"
                          : "bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Published GitHub Pages Section */}
        <section
          id="published-pages"
          className="py-14 sm:py-16 border-b border-slate-200 dark:border-slate-800/80"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-sky-600 dark:text-sky-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Live Documentation &amp; Web Apps
                </span>
                <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Published GitHub Pages
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Repositories with live web portals or documentation hosted under{" "}
                  <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-sky-600 dark:text-sky-300">
                    headhunter45.github.io
                  </code>
                  . New Pages repos are discovered automatically.
                </p>
              </div>
            </div>

            {publishedPagesProjects.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-8 text-center text-sm text-slate-500">
                No published Pages projects match your current filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {publishedPagesProjects.map((project) => {
                  const aliases = getAllRouteAliases(project);
                  const kind = getProjectKind(project);
                  return (
                    <article
                      key={project.label}
                      className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 hover:border-sky-500/50 dark:hover:border-sky-500/50 p-6 shadow-sm hover:shadow-xl transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              {kind === "external" ? "External Site" : "Published Page"}
                            </span>
                            {project.language && (
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getLanguageBadgeClass(
                                  project.language
                                )}`}
                              >
                                {project.language}
                              </span>
                            )}
                          </div>

                          {project.category && (
                            <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                              {project.category}
                            </span>
                          )}
                        </div>

                        <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition">
                          <a href={project.pagesUrl}>{project.label}</a>
                        </h3>

                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                          {project.description}
                        </p>

                        {project.tags && project.tags.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-1.5">
                            {project.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 rounded-md text-xs font-mono bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
                        {aliases.length > 0 && (
                          <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="text-slate-400 dark:text-slate-500 mr-1">
                              Short redirects:
                            </span>
                            {aliases.map((alias) => (
                              <button
                                key={alias}
                                type="button"
                                onClick={() => handleCopyShortUrl(alias)}
                                title={`Copy https://${profile.username}.github.io/${alias}`}
                                className="px-2 py-0.5 rounded font-mono text-[11px] bg-slate-100 dark:bg-slate-950 text-sky-700 dark:text-sky-300 border border-slate-200 dark:border-slate-800 hover:border-sky-500/50 transition cursor-pointer"
                              >
                                /{alias}
                                {copiedSlug === alias && (
                                  <span className="ml-1 text-emerald-500">✓</span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <a
                            href={project.pagesUrl}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-sm shadow-sky-600/20 transition"
                          >
                            <span>Open Published Page</span>
                            <span aria-hidden="true">→</span>
                          </a>

                          {project.repoUrl && (
                            <a
                              href={project.repoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            >
                              <span>Source Repo</span>
                              <span aria-hidden="true">↗</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Configured Repositories (Pages Not Published Yet) */}
        <section
          id="repositories"
          className="py-14 sm:py-16 border-b border-slate-200 dark:border-slate-800/80 bg-slate-100/50 dark:bg-slate-950/40"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  Open-Source Codebases &amp; Libraries
                </span>
                <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Featured Repositories
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Projects configured in{" "}
                  <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-indigo-600 dark:text-indigo-300">
                    src/config/projects.json
                  </code>{" "}
                  without a published Pages site yet. Once GitHub Pages is enabled on any of these repos, it automatically promotes to Published Pages.
                </p>
              </div>
            </div>

            {repoOnlyProjects.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-8 text-center text-sm text-slate-500">
                No repositories match your current filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {repoOnlyProjects.map((project) => {
                  const aliases = getAllRouteAliases(project);
                  return (
                    <article
                      key={project.label}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-slate-900/65 hover:border-indigo-500/50 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {project.category || "Repository"}
                          </span>
                          {project.language && (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getLanguageBadgeClass(
                                project.language
                              )}`}
                            >
                              {project.language}
                            </span>
                          )}
                        </div>

                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          <a
                            href={project.repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                          >
                            {project.label}
                          </a>
                        </h3>

                        <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                          {project.description}
                        </p>

                        {project.tags && project.tags.length > 0 && (
                          <div className="mt-3.5 flex flex-wrap gap-1.5">
                            {project.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-5 pt-3.5 border-t border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1 overflow-hidden">
                          {aliases.slice(0, 2).map((alias) => (
                            <button
                              key={alias}
                              type="button"
                              onClick={() => handleCopyShortUrl(alias)}
                              title={`Copy redirect https://${profile.username}.github.io/${alias}`}
                              className="px-2 py-0.5 rounded font-mono text-[11px] bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 transition cursor-pointer"
                            >
                              /{alias}
                              {copiedSlug === alias && (
                                <span className="ml-1 text-emerald-500">✓</span>
                              )}
                            </button>
                          ))}
                        </div>

                        {project.repoUrl && (
                          <a
                            href={project.repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
                          >
                            <span>View on GitHub</span>
                            <span aria-hidden="true">↗</span>
                          </a>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Case-Insensitive & Alias Redirects Table */}
        <section
          id="redirects"
          className="py-14 sm:py-16 border-b border-slate-200 dark:border-slate-800/80"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-semibold">
                Smart Path Resolution
              </span>
              <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Case-Insensitive &amp; Short Alias Redirects
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                GitHub Pages paths are case-sensitive by default. This site generates static redirect endpoints for all configured aliases and lowercase slugs, plus a smart{" "}
                <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800">
                  404.html
                </code>{" "}
                router that resolves any casing or hyphen/underscore variation while preserving subpaths and query parameters.
              </p>
            </div>

            {renderRedirectsTable("Case-Insensitive and Short Alias Redirects")}
          </div>
        </section>

        {/* Configuration Schema Guide */}
        <section id="config-guide" className="py-14 sm:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 sm:p-8 shadow-sm">
              <div className="max-w-3xl">
                <span className="text-xs font-mono uppercase tracking-wider text-sky-600 dark:text-sky-400 font-semibold">
                  src/config/projects.json
                </span>
                <h2 className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  Adding Projects, Aliases &amp; External Links
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Edit{" "}
                  <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800">
                    src/config/projects.json
                  </code>{" "}
                  to add repositories, custom short aliases, or external sites. Omit{" "}
                  <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800">
                    pagesUrl
                  </code>{" "}
                  for repositories without published Pages—when Pages is enabled on GitHub, the deploy workflow and live sync automatically populate{" "}
                  <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800">
                    pagesUrl
                  </code>
                  .
                </p>
              </div>

              <pre className="mt-5 rounded-xl bg-slate-950 text-slate-100 p-4 sm:p-5 text-xs sm:text-sm overflow-x-auto border border-slate-800 leading-relaxed">
                <code>{`{
  "projects": [
    {
      "label": "NextcloudUploadTool",
      "pagesUrl": "https://headhunter45.github.io/NextcloudUploadTool/",
      "repoUrl": "https://github.com/headhunter45/NextcloudUploadTool",
      "aliases": ["nut", "nextcloud-upload-tool", "upload"]
    },
    {
      "label": "NodeEditor",
      "repoUrl": "https://github.com/headhunter45/NodeEditor",
      "aliases": ["node-editor", "nodes"]
    }
  ]
}`}</code>
              </pre>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#090d16] py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="w-6 h-6 rounded brand-gradient-bg text-white font-bold text-[11px] flex items-center justify-center"
            >
              H45
            </span>
            <span>
              {profile.name} (@{profile.username}) — Published at{" "}
              <a
                href={profile.siteUrl}
                className="text-sky-600 dark:text-sky-400 hover:underline"
              >
                headhunter45.github.io
              </a>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <a
              href={profile.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-sky-500 transition"
            >
              GitHub Profile
            </a>
            {profile.blogUrl && (
              <a
                href={profile.blogUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-sky-500 transition"
              >
                sfcoder.me
              </a>
            )}
            <a
              href={`${profile.githubUrl}/${profile.username}.github.io`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-sky-500 transition"
            >
              Site Repository
            </a>
          </div>
        </div>
      </footer>
      </div>

      {/* Hidden Bottom Flyout Panel toggled with the ` (Backquote) key */}
      <aside
        aria-label="Quick Redirects & Developer Flyout"
        hidden={!isFlyoutOpen}
        className={`absolute inset-x-0 bottom-0 h-[42dvh] z-50 flex-col border-t-2 border-sky-500/40 bg-white/95 dark:bg-[#0b1120]/95 backdrop-blur-xl shadow-2xl ${
          isFlyoutOpen ? "flex" : "hidden"
        }`}
      >
        <div className="px-4 sm:px-6 lg:px-8 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <kbd className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-900 text-sky-400 border border-slate-700 shadow-inner">
              `
            </kbd>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Redirects &amp; Aliases Flyout
            </h2>
            <span className="hidden sm:inline-block text-xs text-slate-500 dark:text-slate-400">
              Press <code className="font-mono text-xs">`</code> or{" "}
              <code className="font-mono text-xs">Esc</code> to toggle
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsFlyoutOpen(false)}
            aria-label="Close flyout panel"
            className="px-3 py-1 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Close
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            {renderRedirectsTable("Flyout Redirects and Aliases Directory")}
          </div>
        </div>
      </aside>
    </div>
  );
}

export default App;

