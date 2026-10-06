# FormFlow

Sistema de preonboarding: los administradores crean formularios, las personas los completan desde un enlace y el equipo revisa y aprueba cada envío.

## Arquitectura

| Pieza | Tecnología | Carpeta |
|---|---|---|
| API | Go (chi, pgx, goose) | `api/` (submódulo de [formsis-backend](https://github.com/gabrielventodev/formsis-backend)) |
| Base de datos | PostgreSQL 17 nativo | migraciones en `api/migrations/` |
| Frontend | Next.js + TypeScript + Tailwind | `web/` |
| Archivos | Almacenamiento compatible con S3 (MinIO en local) | — |

La API aplica las migraciones al arrancar. Postgres es la única base de datos: esquemas de formularios y respuestas viven en columnas JSONB, y los estados, comentarios y auditoría en tablas relacionales.

## Empezar

La API vive en su propio repositorio, [formsis-backend](https://github.com/gabrielventodev/formsis-backend), y aquí entra como submódulo en `api/`. Clona con los submódulos:

```sh
git clone --recurse-submodules https://github.com/gabrielventodev/formflow-v2.git
```

Si ya lo tenías clonado, trae la carpeta `api/` con:

```sh
git submodule update --init
```

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

Requisitos: Go 1.26+, Node 22+, Docker.

### Desde VS Code

En **Run and Debug** elige **FormFlow: API + Web** y pulsa F5. Levanta Postgres con Docker, arranca la API en Go con el depurador (breakpoints incluidos) y Next.js en modo desarrollo, y abre el navegador al estar lista. También puedes lanzar **API (Go)** o **Web (Next.js)** por separado. Necesitas la extensión de Go (`golang.go`) con Delve; VS Code la sugiere al abrir el repo. Si la API no arranca, actualiza Go a 1.26 y ejecuta **Go: Install/Update Tools** para que Delve quede compilado con esa versión.

### Trabajar en la API (submódulo)

Los cambios del backend se hacen y se suben dentro de `api/`, que es un checkout de formsis-backend:

```sh
cd api
git switch main
git commit -am "..." && git push
cd ..
git add api && git commit -m "Actualiza la API"   # fija en formflow-v2 la nueva versión de la API
```

Para traer lo último de formsis-backend: `git submodule update --remote api` y luego `git add api` y commit. Al hacer `git pull` en formflow-v2, corre `git submodule update` para que `api/` quede en la versión fijada (o configura una vez `git config submodule.recurse true` y se hace solo).

## Constructor de formularios

En http://localhost:3000/admin/forms se crean, editan, duplican y archivan formularios.

- Cada sección es un paso del formulario. Los campos se agregan desde el panel izquierdo y se reordenan arrastrando (también entre secciones).
- Tipos de campo (26), agrupados en el panel:
  - Texto y contacto: texto corto y largo, email, teléfono, sitio web y dirección (calle, ciudad, región, código postal y país).
  - Números y fechas: número, monto con moneda (CLP, UF, PEN, USD…), fecha, hora, fecha y hora, y escala (p. ej. 1 a 5).
  - Opciones: sí/no, opción única con botones, lista desplegable, selección múltiple, casilla y país.
  - Identidad y documentos: RUT/DNI con validación, archivo y firma dibujada (se guarda como trazo vectorial, sin imagen).
  - Estructura: grupo repetible (p. ej. socios).
  - Diseño: título con subtítulo, separador (línea con texto opcional), espacio y texto informativo. No se llenan, no son obligatorios y no aparecen en la revisión del panel ni en el CSV.
- Por campo: etiqueta, ayuda, obligatorio, mínimo/máximo, expresión regular, tipos y tamaño de archivo, y una condición para mostrarlo según otro campo anterior.
- Los cambios se guardan solos en un borrador. **Publicar** congela una versión inmutable (v1, v2…); los envíos quedan atados a la versión con la que se llenaron. Editar un formulario publicado solo cambia el borrador hasta volver a publicar.
- La pestaña **Vista previa** muestra el formulario como lo verá el solicitante, con condiciones y validaciones.

El esquema está definido en `api/internal/schema` (Go, valida al publicar) y en `web/src/lib/form-schema.ts` (TypeScript).

API (`/api/v1/admin/forms`): `GET /`, `POST /`, `GET|PATCH|DELETE /{id}`, `POST /{id}/publish`, `POST /{id}/duplicate`, `POST /{id}/archive`, `POST /{id}/restore`, `GET /{id}/validate`, `GET /{id}/versions`, `GET /{id}/versions/{n}`.

Todas las rutas `/api/v1/admin/*` exigen sesión de administrador (ver abajo).

## Panel administrativo

Entra en http://localhost:3000/admin con la cuenta inicial: `ADMIN_EMAIL` / `ADMIN_PASSWORD` (por defecto `admin@formflow.local` / `cambiame123`; la API la crea al arrancar si no existe). Para ver el panel con datos sin pasar por el portal: `make seed-envios`.

- **Bandeja de envíos** con pestañas (por revisar, asignados a mí, observados, aprobados, rechazados, todos), búsqueda por nombre, email o ID, filtros por formulario, revisor y fechas, y exportación a CSV con los mismos filtros (una columna por campo al filtrar por un formulario).
- **Detalle** con las respuestas mostradas según la versión del formulario con que se llenaron, documentos para ver o descargar, comentarios generales y por campo, e historial de auditoría.
- **Estados**: tomar para revisión, pedir correcciones (con observaciones por campo), aprobar o rechazar (con motivo). Owners y admins pueden reabrir una decisión. Tomar un envío lo asigna a quien lo toma si no tenía revisor.
- **Sesiones** propias en Go: contraseñas con argon2id, sesión en Postgres y cookie httpOnly. El navegador habla con la API a través de `/api/v1` en el mismo dominio de Next.js, así la cookie es de primera parte. Activa `COOKIE_SECURE=true` detrás de HTTPS.

API (`/api/v1`): `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`; y en `/admin/submissions`: `GET /`, `GET /facets`, `GET /export.csv`, `GET /{id}`, `POST /{id}/transition`, `POST /{id}/comments`, `POST /{id}/comments/{commentId}/resolve`, `PUT /{id}/assignee`, `GET /{id}/files/{fileId}`.

Los documentos se leen del mismo almacenamiento que usa el portal (`STORAGE_DRIVER`: disco local o MinIO/S3). Las rutas de enlaces del portal (`/api/v1/admin/links`) también exigen sesión.

## Portal de llenado

Los solicitantes completan un formulario publicado sin crear cuenta.

1. En **Formularios → Compartir** (`/admin/forms/{id}/enlaces`) se crea un enlace público o se invita a alguien por email (con mensaje y fecha de vencimiento opcionales).
2. El enlace abre `/f/{token}`: la persona deja su nombre y email y recibe un **enlace privado** `/s/{token}` para continuar cuando quiera. Solo se guarda el hash del token.
3. El formulario va paso a paso, con barra de progreso, condiciones, validación por paso (las mismas reglas que valida la API al enviar) y guardado automático.
4. Los documentos se suben con arrastrar y soltar, con progreso y vista previa; se validan tipo y tamaño en el navegador y en la API. Siempre se descargan a través de la API, nunca con acceso directo al bucket.
5. Antes de enviar hay una pantalla de revisión. Al enviar llega un email de acuse.
6. Si un revisor pide correcciones (`changes_requested` con comentarios por campo), el solicitante ve los comentarios y solo puede editar los campos observados; al reenviar, los comentarios quedan resueltos y la solicitud vuelve a `submitted`.
7. En `/retomar` se pide un enlace nuevo con el email (invalida los anteriores).

Para probarlo en local: `make db && make seed`, luego abre http://localhost:3000/f/demo-kyb.

Configuración (variables de la API):

| Variable | Para qué | Por defecto |
|---|---|---|
| `STORAGE_DRIVER` | `local` (carpeta) o `s3` (MinIO, R2, S3) | `local` |
| `STORAGE_DIR` | Carpeta del driver local | `data/uploads` |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`, `S3_USE_SSL` | Bucket compatible con S3; se crea si no existe | `localhost:9000`, `formflow` |
| `MAX_UPLOAD_MB` | Tope por archivo, aunque el campo permita más | `25` |
| `WEB_PUBLIC_URL` | URL pública de la web para los enlaces de los emails | `WEB_ORIGIN` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `MAIL_FROM` | Envío de emails. Sin `SMTP_HOST`, los emails se escriben en el log de la API (útil para copiar el enlace en desarrollo) | — |

Con `make up`, la API usa el MinIO del compose.

API pública (`/api/v1/portal`): `GET /links/{token}`, `POST /links/{token}/start`, `POST /resume`; y con `Authorization: Bearer {token}`: `GET /submission`, `PUT /submission/data`, `POST /submission/validate`, `POST /submission/submit`, `POST /submission/files`, `GET|DELETE /submission/files/{id}`. Enlaces (admin): `GET /api/v1/admin/links?formId=`, `POST /api/v1/admin/links`, `DELETE /api/v1/admin/links/{id}`.

## Pruebas

```sh
make test
# con Postgres local, también las pruebas de la API contra la base (no borran datos):
TEST_DATABASE_URL=postgres://formflow:formflow@localhost:5432/formflow?sslmode=disable make test
```

## Modelo de datos

`organizations`, `users`, `memberships` (roles owner/admin/reviewer), `sessions`, `forms`, `form_versions` (versiones publicadas e inmutables), `form_links`, `submissions` (estado + respuestas JSONB), `submission_files`, `review_comments` y `audit_events` (solo inserción).

Estados de un envío: `draft → submitted → in_review → (changes_requested ↔ submitted) → approved | rejected`.

## Hoja de ruta

1. Constructor de formularios
2. Portal de llenado
3. Panel administrativo
4. Fase 2: extracción con IA, aprobaciones multinivel, marca propia
