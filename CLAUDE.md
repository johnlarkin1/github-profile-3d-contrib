# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GitHub Profile 3D Contrib is a GitHub Action that generates animated 3D contribution calendar visualizations as SVG images. It fetches user contribution data from GitHub's GraphQL API and renders it with multiple visualization styles.

## Common Commands

```bash
# Build (compile TypeScript + bundle with ncc)
npm run build

# Development with auto-reload
npm run dev:watch

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Type checking only
npm run check-types

# Lint and type check
npm run lint

# Auto-fix lint issues and format
npm run lint:fix
```

Pre-commit hooks run `test` and `lint:fix` automatically.

## Architecture

The project follows a pipeline architecture:

```
GitHub GraphQL API → Data Aggregation → Settings Processing → SVG Rendering → File Output
```

### Core Flow

1. **Entry point** (`src/index.ts`): Reads environment variables, determines template settings, orchestrates pipeline
2. **API client** (`src/github-graphql.ts`): Fetches contribution data via GitHub GraphQL API
3. **Aggregation** (`src/aggregate-user-info.ts`): Transforms GraphQL responses into typed `UserInfo` structure
4. **SVG generation** (`src/create-svg.ts`): Orchestrates rendering of all chart components
5. **Output** (`src/file-writer.ts`): Writes SVG files to `profile-3d-contrib/` directory

### Visualization Components

- `src/create-3d-contrib.ts` - 3D isometric bar chart (most complex component)
- `src/create-pie-language.ts` - Programming language pie chart
- `src/create-radar-contrib.ts` - Contribution types radar chart
- `src/create-css-colors.ts` - CSS color generation from settings

### Settings System

Preset templates in `src/settings/`:
- NormalSettings.json, HalloweenSettings.json, NightViewSettings.json
- NorthSeasonSettings.json, SouthSeasonSettings.json
- NightGreenSettings.json, NightRainbowSettings.json, GitBlockSettings.json

Custom JSON settings can be provided via `SETTING_JSON` environment variable.

### Types

All TypeScript types are centralized in `src/type.ts` including `UserInfo`, `ContributionLevel`, `Settings`, and chart-specific types.

## Technology Stack

- TypeScript 4.2.4 (strict mode, ES2019 target, CommonJS)
- D3.js v7 for visualization
- JSDOM for server-side SVG generation
- Jest for testing
- @vercel/ncc for bundling to single file

## Testing

Tests are in `/spec/` directory with `.spec.ts` suffix. Uses `spec/dummy-data.ts` for API response fixtures.

## Environment Variables

- `GITHUB_TOKEN` - Required for API access
- `USERNAME` - GitHub username to generate for
- `MAX_REPOS` - Limit repositories for language stats
- `SETTING_JSON` - Custom settings JSON file path
- `YEAR` - Specific year to render
- `GITHUB_ENDPOINT` - For GitHub Enterprise support
- `EXCLUDED_LANGUAGES` - Comma-separated list of languages to exclude from pie chart (case-insensitive)
- `MAX_LANGUAGES` - Maximum languages in pie chart before "other" (default 5, range 1-20)

### Language Aliases

When excluding languages, related languages are automatically excluded too. The alias mappings are defined in `src/aggregate-user-info.ts`:

- `typescript` → also excludes `tsx`
- `javascript` → also excludes `jsx`
- `python` → also excludes `cython`, `jupyter notebook`
- `c` / `c++` → also excludes `objective-c`, `objective-c++`
- `shell` → also excludes `bash`, `zsh`, `fish`, `powershell`, `batchfile`
- `html` → also excludes `html+erb`, `html+django`, `html+php`
- `css` → also excludes `scss`, `sass`, `less`, `stylus`
