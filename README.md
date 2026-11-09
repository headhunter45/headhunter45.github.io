# headhunter45.github.io

Personal developer profile, GitHub Pages portal directory, and case-insensitive / short-alias route redirect hub for **Tom ([@headhunter45](https://github.com/headhunter45))**, published at **[https://headhunter45.github.io](https://headhunter45.github.io)**.

---

## Features

- **Vite + React 19 + Tailwind CSS v4**: Styled consistently with [`opentasks`](https://github.com/headhunter45/opentasks) and [`NextcloudUploadTool`](https://github.com/headhunter45/NextcloudUploadTool).
- **Dynamic GitHub Pages Discovery**:
  - **Deploy-Time Sync (`scripts/sync-pages.mjs`)**: Queries the GitHub REST API during build/deploy to automatically detect all repositories with `has_pages: true` and enrich repository metadata.
  - **Live Browser Sync (`src/utils/projects.ts`)**: Fetches live repository metadata in the browser (with `sessionStorage` caching) so newly published Pages sites appear immediately.
- **Simple Configuration (`src/config/projects.json`)**:
  - Add repositories with or without `pagesUrl` (omit `pagesUrl` for repos that don't have GitHub Pages published yet) and define custom `aliases`.
- **Case-Insensitive & Alias Redirects**:
  - Generates static redirect endpoints (`dist/<alias>/index.html`) for all configured aliases and lowercase/kebab-case variants (e.g., `/nut` → `NextcloudUploadTool`, `/ot` → `opentasks`, `/obb` → `OldBearBattles`).
  - Generates a smart `dist/404.html` fallback router that resolves any casing variation (e.g., `/nextclouduploadtool`, `/OpenTasks`, `/MONSTERCARDS`) and preserves subpaths, query strings, and hashes.

---

## Configuring Projects & Aliases

Edit [`src/config/projects.json`](src/config/projects.json):

```json
{
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
}
```

- **Projects with Published Pages**: Include `pagesUrl` (or let `scripts/sync-pages.mjs` / live sync populate it automatically when GitHub Pages is enabled on the repo).
- **Repositories without Pages yet**: Omit `pagesUrl`. Short aliases and case-insensitive paths will redirect to `repoUrl` until Pages is enabled.
- **External Sites**: Provide `pagesUrl` pointing to the external URL and omit `repoUrl` (or include both).

---

## Development & Build

```bash
# Install dependencies
npm install

# Sync GitHub Pages & repository metadata into src/generated/resolvedProjects.json
npm run sync

# Start local dev server
npm run dev

# Build production bundle + static redirect pages + 404.html
npm run build
```

