import { useEffect, useMemo, useState } from 'react';
import resolvedConfigJson from './generated/resolvedProjects.json';
import type { ProjectConfig, SiteConfig } from './types';
import {
  extractRepoName,
  filterProjectsByQuery,
  formatTagQueryToken,
  getAllRouteAliases,
  getProjectKind,
  getProjectTags,
  isAppProject,
  isComponentProject,
  isExtensionProject,
  resolveRedirectFromLocation,
  sortProjectsByPopularity,
} from './utils/projects';

const initialConfig = resolvedConfigJson as SiteConfig;

const LANGUAGE_BADGE_COLORS: Record<string, string> = {
  Rust: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  Python: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  TypeScript:
    'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
  'C++':
    'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  Java: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  'C#': 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30',
};

function getLanguageBadgeClass(language?: string): string {
  if (!language) {
    return 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30';
  }
  return (
    LANGUAGE_BADGE_COLORS[language] ||
    'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30'
  );
}

export function App() {
  const { profile } = initialConfig;
  const projects = useMemo(
    () => sortProjectsByPopularity(initialConfig.projects || []),
    [],
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
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
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (!isEditable && (e.key === '`' || e.code === 'Backquote')) {
        e.preventDefault();
        setIsFlyoutOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isFlyoutOpen && !isEditable) {
        setIsFlyoutOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

  const appProjects = useMemo(
    () => projects.filter((p) => isAppProject(p)),
    [projects],
  );

  const extensionProjects = useMemo(
    () => projects.filter((p) => isExtensionProject(p)),
    [projects],
  );

  const componentProjects = useMemo(
    () => projects.filter((p) => isComponentProject(p)),
    [projects],
  );

  const filteredAllProjects = useMemo(
    () => filterProjectsByQuery(projects, searchQuery),
    [projects, searchQuery],
  );

  const availableTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of projects) {
      for (const t of getProjectTags(p)) {
        const lower = t.toLowerCase();
        counts.set(lower, (counts.get(lower) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag]) => tag);
  }, [projects]);

  const handleTagClick = (tag: string, scrollToAll = false) => {
    const token = formatTagQueryToken(tag);
    setSearchQuery((prev) => {
      const trimmed = prev.trim();
      if (trimmed.toLowerCase() === token.toLowerCase()) {
        return '';
      }
      return token;
    });
    if (scrollToAll) {
      document.getElementById('all')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCopyShortUrl = (slug: string) => {
    const base = profile.siteUrl.replace(/\/$/, '');
    const url = `${base}/${slug}`;
    navigator.clipboard?.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => {
      setCopiedSlug((prev) => (prev === slug ? null : prev));
    }, 1800);
  };

  const renderProjectCard = (
    project: ProjectConfig,
    scrollToAllOnTagClick = true,
  ) => {
    const kind = getProjectKind(project);
    const primaryHref = project.pagesUrl || project.repoUrl || '#';
    const isExternalOnly = kind === 'external';
    const hasPages = Boolean(project.pagesUrl);
    const tags = getProjectTags(project);

    return (
      <article
        key={project.label}
        className="group rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-slate-900/75 hover:border-sky-500/50 dark:hover:border-sky-500/50 p-6 shadow-sm hover:shadow-xl transition flex flex-col justify-between"
      >
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              {hasPages ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {isExternalOnly ? 'Web Site' : 'Published Page'}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  Repository
                </span>
              )}

              {project.language && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getLanguageBadgeClass(
                    project.language,
                  )}`}
                >
                  {project.language}
                </span>
              )}
            </div>

            {typeof project.stars === 'number' && project.stars > 0 && (
              <span
                className="inline-flex items-center gap-1 text-xs font-mono text-amber-600 dark:text-amber-400"
                aria-label={`${project.stars} GitHub stars`}
              >
                <span aria-hidden="true">★</span>
                <span>{project.stars}</span>
              </span>
            )}
          </div>

          <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition">
            <a
              href={primaryHref}
              target={hasPages ? undefined : '_blank'}
              rel={hasPages ? undefined : 'noopener noreferrer'}
            >
              {project.label}
            </a>
          </h3>

          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {project.description}
          </p>

          {tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagClick(tag, scrollToAllOnTagClick)}
                  className="px-2 py-0.5 rounded-md text-xs font-mono bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-sky-500/15 hover:text-sky-600 dark:hover:text-sky-300 transition cursor-pointer"
                >
                  #{tag.toLowerCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          {project.pagesUrl ? (
            <>
              <a
                href={project.pagesUrl}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-sm shadow-sky-600/20 transition"
              >
                <span>Open Site</span>
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
            </>
          ) : (
            project.repoUrl && (
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-900 dark:bg-slate-800 hover:bg-sky-600 dark:hover:bg-sky-600 text-white transition"
              >
                <span>View on GitHub</span>
                <span aria-hidden="true">↗</span>
              </a>
            )
          )}
        </div>
      </article>
    );
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
              const target = project.pagesUrl || project.repoUrl || '#';
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
            Redirecting you to{' '}
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
          isFlyoutOpen ? 'bottom-[42dvh]' : 'bottom-0'
        }`}
      >
        {/* Sticky Top Header */}
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
            </a>

            <nav
              aria-label="Primary Navigation"
              className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
            >
              <a
                href="#apps"
                className="hover:text-sky-600 dark:hover:text-sky-400 transition"
              >
                Apps
              </a>
              <a
                href="#extensions"
                className="hover:text-sky-600 dark:hover:text-sky-400 transition"
              >
                Extensions / Plugins
              </a>
              <a
                href="#components"
                className="hover:text-sky-600 dark:hover:text-sky-400 transition"
              >
                Components
              </a>
              <a
                href="#all"
                className="hover:text-sky-600 dark:hover:text-sky-400 transition"
              >
                Everything
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
                  TomHicks.bio
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
          <section className="relative overflow-hidden py-4 sm:py-8 border-b border-slate-200 dark:border-slate-800/80 bg-gradient-to-b from-sky-50/70 via-white to-slate-50 dark:from-indigo-950/30 dark:via-[#090d16] dark:to-[#090d16]">
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
                    Open-Source{' '}
                    <span className="brand-gradient-text">
                      Apps, Extensions
                    </span>{' '}
                    &amp; Developer Tools
                  </h1>

                  <p className="mt-5 text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                    {profile.bio}
                  </p>

                  <div className="mt-7 flex flex-wrap items-center gap-3">
                    <a
                      href="#apps"
                      className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-white dark:bg-slate-900 hover:bg-sky-500 text-white shadow-md shadow-sky-600/20 border border-slate-300 dark:border-slate-700 transition"
                    >
                      Apps
                    </a>
                    <a
                      href="#extensions"
                      className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-white dark:bg-slate-900 hover:bg-sky-500 text-white shadow-md shadow-sky-600/20 border border-slate-300 dark:border-slate-700 transition"
                    >
                      Extensions / Plugins
                    </a>
                    <a
                      href="#components"
                      className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-white dark:bg-slate-900 hover:bg-sky-500 text-white shadow-md shadow-sky-600/20 border border-slate-300 dark:border-slate-700 transition"
                    >
                      Components
                    </a>
                    <a
                      href="#all"
                      className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-white dark:bg-slate-900 hover:bg-sky-500 text-white shadow-md shadow-sky-600/20 border border-slate-300 dark:border-slate-700 transition"
                    >
                      Everything
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
                          {profile.location && (
                            <span>• {profile.location}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-2.5 pt-5 border-t border-slate-200 dark:border-slate-800 text-center">
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 p-2.5 border border-slate-200/60 dark:border-slate-800/80">
                        <div className="text-xl font-extrabold text-sky-600 dark:text-sky-400 font-mono">
                          {appProjects.length}
                        </div>
                        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          Apps
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 p-2.5 border border-slate-200/60 dark:border-slate-800/80">
                        <div className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                          {extensionProjects.length}
                        </div>
                        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          Extensions
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 p-2.5 border border-slate-200/60 dark:border-slate-800/80">
                        <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                          {projects.length}
                        </div>
                        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          All Projects
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Apps Section */}
          <section
            id="apps"
            className="py-4 sm:py-6 border-b border-slate-200 dark:border-slate-800/80"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-8">
                <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-sky-600 dark:text-sky-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Applications &amp; Published Portals
                </span>
                <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Apps
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Interactive web applications, desktop utilities, CLI tools,
                  and projects with published GitHub Pages sites.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {appProjects.map((project) => renderProjectCard(project, true))}
              </div>
            </div>
          </section>

          {/* Extensions Section */}
          <section
            id="extensions"
            className="py-14 sm:py-16 border-b border-slate-200 dark:border-slate-800/80 bg-slate-100/50 dark:bg-slate-950/40"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-8">
                <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  Plugins &amp; Add-ons
                </span>
                <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Extensions
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Server plugins, companion modules, and platform extensions.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {extensionProjects.map((project) =>
                  renderProjectCard(project, true),
                )}
              </div>
            </div>
          </section>

          {/* Components Section */}
          <section
            id="components"
            className="py-14 sm:py-16 border-b border-slate-200 dark:border-slate-800/80"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-8">
                <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-violet-600 dark:text-violet-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-violet-400" />
                  UI Modules &amp; Templates
                </span>
                <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Components
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Reusable visual editors, UI components, and modular workspace templates.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {componentProjects.map((project) =>
                  renderProjectCard(project, true),
                )}
              </div>
            </div>
          </section>

          {/* All Projects Section with Search & Tag Filter */}
          <section id="all" className="py-14 sm:py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-6">
                <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-semibold">
                  Complete Catalog
                </span>
                <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  All Projects
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Search case-insensitively by repository name or tags. Use{' '}
                  <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800">
                    tag:apps
                  </code>{' '}
                  or{' '}
                  <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800">
                    &quot;tag:unit testing&quot;
                  </code>{' '}
                  to force a tag filter.
                </p>
              </div>

              {/* Search & Tag Filter Panel */}
              <div className="mb-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 sm:p-5 shadow-sm">
                <div className="relative">
                  <label
                    htmlFor="all-projects-search"
                    className="visually-hidden"
                  >
                    Search projects by repository name or tags
                  </label>
                  <input
                    id="all-projects-search"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder='Search by repo name or tag (e.g. tag:apps, "tag:unit testing", rust)…'
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500 mr-1">
                    Tags:
                  </span>
                  {availableTags.map((tag) => {
                    const token = formatTagQueryToken(tag);
                    const isSelected =
                      searchQuery.trim().toLowerCase() === token.toLowerCase();
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleTagClick(tag, false)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
                          isSelected
                            ? 'bg-sky-600 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        #{tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {filteredAllProjects.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-8 text-center text-sm text-slate-500">
                  No projects match{' '}
                  <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800">
                    {searchQuery}
                  </code>
                  .
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredAllProjects.map((project) =>
                    renderProjectCard(project, false),
                  )}
                </div>
              )}
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
                {profile.name} (@{profile.username}) — Published at{' '}
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
          isFlyoutOpen ? 'flex' : 'hidden'
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
              Press <code className="font-mono text-xs">`</code> or{' '}
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
            {renderRedirectsTable('Flyout Redirects and Aliases Directory')}
          </div>
        </div>
      </aside>
    </div>
  );
}

export default App;
