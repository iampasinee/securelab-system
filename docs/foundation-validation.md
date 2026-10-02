# Repository Foundation Validation

Validation performed on 2026-10-02 in `D:/inet1/Pre-Project/System/securelab-system`.

## Repository safety and moves

- Git root: `D:/inet1/Pre-Project/System/securelab-system`.
- Origin remained `https://github.com/iampasinee/securelab-system.git`.
- The initial working tree was clean; no commit or push was performed.
- Moved `src/`, `public/`, `index.html`, `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `.env.example`, `metadata.json`, and the original frontend `README.md` into `frontend/`.
- All 110 tracked frontend files matched a combined SHA-256 before/after the move. After installation, 109 original source/config/test files still matched their original Git contents. The frontend guide's links were updated separately.
- `public/` was empty; it was moved and given a `.gitkeep`.
- Root `node_modules/` and `dist/` were left in place, ignored, and not moved. New dependencies/build output were generated in `frontend/`.
- The old `workflow-architect` repository and its running dev server were not modified.

## Resulting structure and documentation

The repository now contains `frontend/`, `backend/`, `agent/`, `infra/`, `storage/`, `docs/`, root Compose, environment template, `.gitignore`, `README.md`, and `AGENTS.md`.

Root README describes the main repository, intended architecture, current mock/foundation status, directory tree, frontend/backend/Docker commands, migrations, storage, and deferred work. The original detailed frontend guide is retained in `frontend/README.md`.

Root AGENTS remains canonical. All existing frontend/domain rules were preserved with updated repository-relative paths; repository ownership, backend authority, untrusted-file execution boundaries, explicit migrations, environment isolation, and validation rules were added.

## Frontend checks

From `frontend/`, `npm.cmd install`, `npm.cmd run lint`, and `npm.cmd run build` passed. All 16 existing test scripts passed, totaling **198 tests**:

| Script | Tests passed |
| --- | ---: |
| `test:academic` | 26 |
| `test:auth` | 23 |
| `test:courses` | 33 |
| `test:monitoring` | 13 |
| `test:exam-status` | 5 |
| `test:demo-time` | 5 |
| `test:student-demo` | 4 |
| `test:file-preview` | 11 |
| `test:archive-preview` | 9 |
| `test:final-confirmation` | 2 |
| `test:prepared-files` | 3 |
| `test:student-navigation` | 3 |
| `test:exam-wizard` | 16 |
| `test:exam-management` | 12 |
| `test:exam-detail` | 6 |
| `test:rooms` | 27 |

The default port 3000 was occupied by the old repository's Vite server. `npm.cmd run dev -- --port 3001 --strictPort` started from the new location, and HTTP requests returned 200. The existing npm dev script still defaults to port 3000 and exposes Vite on the LAN.

The build emitted a bundle-size warning. npm reported three moderate dependency vulnerabilities; dependencies were not upgraded as part of this reorganization. Browser automation exposed no available browser, so visual role-flow/console checks could not be performed. Source, routes, domain types, mocks, File Preview, demo tooling, localStorage, and IndexedDB behavior were not intentionally changed.

## Backend checks

Created FastAPI startup/health routing, a Pydantic health schema, environment settings, a lazy SQLAlchemy engine, an empty declarative base, package directories, Alembic configuration/environment/template/empty revisions directory, Python dependency definitions, Docker build files, backend guide, and a health test.

Installed `.[test]` into `backend/.venv` and validated locally with Python 3.14:

- `python -m pytest -q`: **1 passed**, proving the health contract without a database connection.
- `python -m pip check`: no broken requirements.
- App import and OpenAPI generation: successful; `/health` present, zero domain tables, zero created engines.
- `python -m alembic history`: successful, no revisions yet.
- `python -m alembic upgrade head --sql` with an example PostgreSQL URL: successful offline configuration; no database connection or domain schema creation.
- `python -m compileall -q app alembic tests`: successful.
- Uvicorn startup: successful. Port 8000 was occupied; live validation used 8001.
- Live `GET http://127.0.0.1:8001/health`: HTTP 200 with `{"status":"ok","service":"securelab-backend"}`.

The TestClient dependency emitted a Starlette deprecation warning for HTTPX; the health test passed. Python dependencies use compatibility ranges rather than a resolved lockfile. The Docker image targets Python 3.12 and was not built in this environment.

## Docker, storage, and Git checks

- `docker compose --env-file .env.example config --quiet`: passed.
- Docker CLI/Compose were available, but the Docker Desktop Linux engine was not running. Container build/start and real PostgreSQL connection/migration tests were not performed.
- Compose prepares PostgreSQL 17 with a named data volume and the backend with host `./storage/data` mounted at `/data/securelab`. Secrets come from environment configuration; examples contain placeholders only.
- `git check-ignore` verified runtime submission paths, frontend dependencies/build output, Python virtual environment, and backend `.env` are ignored. Environment examples and backend source remain visible to Git.
- Working and staged `git diff --check` passed; new files were also checked for trailing whitespace.

No frontend data model, browser schema, persistence migration, or UI behavior was changed. No PostgreSQL domain table or real upload data was added. Authentication/JWT/OAuth, business schema/APIs, uploads/hashing/final lock, Agent/device certificates, face verification, offline isolation, WORM/Object Lock, blockchain, and code judging remain deferred.
