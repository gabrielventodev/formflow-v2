# FormFlow

Sistema de preonboarding: los administradores crean formularios, las personas los completan desde un enlace y el equipo revisa y aprueba cada envío.

## Arquitectura

| Pieza | Tecnología | Carpeta |
|---|---|---|
| API | Go (chi, pgx, goose) | `api/` |
| Base de datos | PostgreSQL 17 nativo | migraciones en `api/migrations/` |
| Frontend | Next.js + TypeScript + Tailwind | `web/` |
| Archivos | Almacenamiento compatible con S3 (MinIO en local) | — |

La API aplica las migraciones al arrancar. Postgres es la única base de datos: esquemas de formularios y respuestas viven en columnas JSONB, y los estados, comentarios y auditoría en tablas relacionales.

## Empezar

Todo con Docker:

```sh
cp .env.example .env
make up
```

- Web: http://localhost:3000
- API: http://localhost:8080/api/v1/health
- Consola de MinIO: http://localhost:9001

Desarrollo local sin contenedores para la API y la web:

```sh
make db     # Postgres en Docker
make api    # API en :8080
make web    # Next.js en :3000
```

Requisitos: Go 1.24+, Node 22+, Docker.

### Desde VS Code

En **Run and Debug** elige **FormFlow: API + Web** y pulsa F5. Levanta Postgres con Docker, arranca la API en Go con el depurador (breakpoints incluidos) y Next.js en modo desarrollo, y abre el navegador al estar lista. También puedes lanzar **API (Go)** o **Web (Next.js)** por separado. Necesitas la extensión de Go (`golang.go`) con Delve; VS Code la sugiere al abrir el repo.

## Modelo de datos

`organizations`, `users`, `memberships` (roles owner/admin/reviewer), `sessions`, `forms`, `form_versions` (versiones publicadas e inmutables), `form_links`, `submissions` (estado + respuestas JSONB), `submission_files`, `review_comments` y `audit_events` (solo inserción).

Estados de un envío: `draft → submitted → in_review → (changes_requested ↔ submitted) → approved | rejected`.

## Hoja de ruta

1. Constructor de formularios
2. Portal de llenado
3. Panel administrativo
4. Fase 2: extracción con IA, aprobaciones multinivel, marca propia
