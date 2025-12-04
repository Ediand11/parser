# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a NestJS web scraper application designed to parse and extract article content from two Russian websites:
- `https://finuslugi.ru/navigator` - Financial services navigator
- `https://t-j.ru/` - Financial/investment news site

The scraper collects data into a CSV file with the structure: main URL, section URL, article URL, title, and full content.

## Development Commands

**Package Manager**: Use `pnpm` for all package operations.

```bash
# Install dependencies
pnpm install

# Development
pnpm run start:dev          # Run with watch mode (most commonly used)
pnpm run start:debug        # Run with debugger attached

# Testing
pnpm run test               # Run unit tests
pnpm run test:watch         # Run unit tests in watch mode
pnpm run test:cov           # Generate test coverage report
pnpm run test:e2e           # Run end-to-end tests

# Code Quality
pnpm run lint               # Run ESLint and auto-fix issues
pnpm run format             # Format code with Prettier

# Build & Production
pnpm run build              # Compile TypeScript to /dist
pnpm run start:prod         # Run production build
```

## Architecture & Structure

### NestJS Patterns

This project follows NestJS architecture with dependency injection as the core pattern:

- **Modules** (`@Module()`): Organize features and group related components
- **Services** (`@Injectable()`): Contain business logic, injected via constructor
- **Controllers** (`@Controller()`): Handle HTTP routing and request/response

### Planned Module Structure

The application is scaffolded to implement this structure (from todo.md):

```
/src
  /common
    http-client.service.ts      # Axios wrapper with custom headers and retry logic
    extract-text.util.ts        # Utilities for extracting text from HTML
  /parsers
    finuslugi-parser.service.ts # Parser for finuslugi.ru/navigator
    tj-parser.service.ts        # Parser for t-j.ru
  /export
    csv-export.service.ts       # CSV generation service
  scraper.service.ts            # Main orchestration service
```

When creating new services, always:
1. Decorate with `@Injectable()` for dependency injection
2. Use constructor injection for dependencies
3. Register providers in the appropriate module's `providers` array
4. Export services that other modules need to use

### Testing Strategy

- **Unit tests** (`.spec.ts`): Colocated with source files in `/src`
- **E2E tests** (`.e2e-spec.ts`): Located in `/test` directory
- Use `@nestjs/testing` module's `Test.createTestingModule()` for unit tests
- E2E tests use `INestApplication` for full integration testing with supertest

## Scraper Requirements & Constraints

### robots.txt Compliance

**finuslugi.ru**:
- ✅ ALLOWED: `/navigator` and nested pages `/navigator/...`
- ❌ FORBIDDEN: `/banki/*`, `/ipoteka/*`, `/arhiv_*`, URLs with `yclid=` or `gclid=` parameters

**t-j.ru**:
- ✅ ALLOWED: All public pages and articles
- ❌ FORBIDDEN: `/api/*`, `/login/`, `/exam/`, `/recommendations/`, `/look/`
- NOTE: Sitemap available at `https://t-j.ru/sitemap.xml` for direct article discovery

### Rate Limiting & Ethical Scraping

- **Rate limit**: 1 request per second (strictly enforced)
- **Parallelism**: Max 2-3 concurrent requests using p-limit
- **User-Agent**: Must NOT be Yandex/Twitterbot. Use custom UA like:
  ```
  Mozilla/5.0 (compatible; LevScraper/1.0; +https://example.com/bot-info)
  ```

### URL Filtering Logic

**finuslugi.ru** filter:
```ts
if (url.includes('/banki/') || url.includes('/ipoteka/') || url.includes('/arhiv_')) return false;
if (url.includes('yclid=') || url.includes('gclid=')) return false;
return url.includes('/navigator/');
```

**t-j.ru** filter:
```ts
if (url.includes('/api/') || url.includes('/login/') || url.includes('/exam/') ||
    url.includes('/recommendations/') || url.includes('/look/')) return false;
return true;
```

### CSV Output Structure

The CSV must have exactly these columns:
- `mainUrl` - Base URL (https://finuslugi.ru/navigator or https://t-j.ru/)
- `sectionUrl` - URL of the section/category page
- `articleUrl` - URL of the individual article
- `title` - Article title (typically from `<h1>`)
- `content` - Full article text from main content container

## TypeScript Configuration Notes

- Target: ES2023 with Node.js module system (`nodenext`)
- Decorators enabled (required for NestJS)
- `noImplicitAny: false` - implicit any types are allowed
- `strictBindCallApply: false` - relaxed function binding checks
- Source maps enabled for debugging

## Code Style

- Single quotes for strings (enforced by Prettier)
- Trailing commas everywhere (enforced by Prettier)
- ESLint allows `any` types and treats some TypeScript warnings as warnings rather than errors
