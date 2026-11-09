export interface ProfileConfig {
  name: string;
  username: string;
  githubUrl: string;
  siteUrl: string;
  blogUrl?: string;
  company?: string;
  location?: string;
  avatarUrl: string;
  tagline: string;
  bio: string;
}

export interface ProjectConfig {
  label: string;
  /**
   * Published GitHub Pages URL (or external site URL).
   * Omit this property for repositories that do not have Pages published yet.
   */
  pagesUrl?: string;
  /**
   * Source repository URL on GitHub.
   * Can be omitted in the future for standalone external sites.
   */
  repoUrl?: string;
  /**
   * Short names and alternative route slugs that redirect to this project
   * (in addition to automatic case-insensitive and hyphen-insensitive matching).
   */
  aliases?: string[];
  description?: string;
  language?: string;
  category?: string;
  tags?: string[];
  updatedAt?: string;
  stars?: number;
  hasPages?: boolean;
  autoDiscovered?: boolean;
}

export interface SiteConfig {
  syncedAt?: string;
  profile: ProfileConfig;
  projects: ProjectConfig[];
}

export type ProjectKind = "pages" | "repo" | "external";

