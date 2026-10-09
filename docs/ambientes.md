# Ambientes: producción, QA y dev

Formsis corre tres ambientes en el mismo servidor, cada uno con su propia base de datos, sus archivos subidos y sus secretos. No comparten nada salvo el Caddy que recibe el tráfico.

| Ambiente | Dominio | Rama (formsis-v2, formsis-backend y formsis-face) | Carpeta en el servidor | Quién entra |
|---|---|---|---|---|
| Producción | `app.formsis.com` | `main` | `~/formsis-v2` | Todo el mundo |
| QA | `qa.formsis.com` | `qa` | `~/formsis-v2-qa` | Solo las IPs de `IPS_PERMITIDAS` |
| Dev | `dev.formsis.com` | `dev` | `~/formsis-v2-dev` | Solo las IPs de `IPS_PERMITIDAS` |

`prueba.formsis.com` redirige a `app.formsis.com`, y el sitio de presentación sigue en `formsis.com`.

## Cómo funciona

```
internet ──> Caddy (80/443, en el stack de producción)
               ├─ app.formsis.com  ──> web-prod ──> api, db, storage, face   (proyecto "formsis")
               ├─ qa.formsis.com   ──> web-qa   ──> api, db, storage, face   (proyecto "formsis-qa")
               ├─ dev.formsis.com  ──> web-dev  ──> api, db, storage, face   (proyecto "formsis-dev")
               └─ formsis.com      ──> sitio estático (repo formsis-web)
```

- Producción se levanta con `docker-compose.prod.yml`, que también trae el Caddy y crea la red compartida `formsis-borde`.
- QA y dev se levantan con `docker-compose.ambiente.yml`, que reutiliza los mismos servicios sin un segundo Caddy. Solo la web de cada ambiente se conecta a `formsis-borde`; la base, los archivos y la API quedan en la red propia del ambiente.
- Cada carpeta sabe qué ambiente es por `AMBIENTE` en su `.env`.
- Producción usa exactamente los commits de `main` fijados en los submódulos `api` y `face`. QA y dev siguen la punta de la rama `qa` o `dev` de cada submódulo, así se pueden probar cambios del backend sin tocar el puntero en formsis-v2. Si un submódulo no tiene esa rama, queda en el commit fijado.
- Antes de pasar el tráfico a QA o dev, Caddy compara la IP del visitante con `IPS_PERMITIDAS`; al resto le responde 403. Esos dos ambientes además llevan `X-Robots-Tag: noindex` para que no los indexen los buscadores.

## Flujo de trabajo sugerido

1. Los cambios se mezclan primero en `dev` (en el repo que corresponda) y se despliegan solos en `dev.formsis.com`.
2. Cuando algo está listo para probarse en serio, se pasa `dev` a `qa` (un PR de `dev` a `qa`) y se prueba en `qa.formsis.com`.
3. Lo aprobado en QA pasa a `main` (un PR de `qa` a `main`). Si el cambio es del backend o de face, además se actualiza el submódulo en formsis-v2 `main`, que es lo que despliega producción.

## Deploy automático

| Push a... | Despliega |
|---|---|
| formsis-v2 `main` | Producción (y el Caddy y el sitio) |
| formsis-v2 `qa` / `dev` | QA / dev |
| formsis-backend o formsis-face `qa` / `dev` | QA / dev, con la punta de esa rama |
| formsis-backend o formsis-face `main` | Nada por sí solo: producción se despliega cuando formsis-v2 actualiza el submódulo |
| formsis-web `main` | El sitio (corre el deploy de producción) |

Todos entran por SSH con una llave que solo puede correr `~/formsis-v2/deploy/actualizar.sh` y le mandan el ambiente como comando. El script valida que sea `prod`, `qa` o `dev` y, si no es producción, corre el script de la carpeta de ese ambiente. En el servidor corre un deploy a la vez: si llega otro, espera.

A mano, desde el servidor:

```sh
~/formsis-v2/deploy/actualizar.sh        # producción
~/formsis-v2/deploy/actualizar.sh qa     # QA
~/formsis-v2/deploy/actualizar.sh dev    # dev
```

## Puesta en marcha (una sola vez)

### 1. DNS

Agregá tres registros A apuntando a la IP fija del servidor (hoy `34.176.140.87`): `app`, `qa` y `dev`. Dejá el de `prueba` como está, así los enlaces viejos siguen funcionando y redirigen. Si ya pasaste el dominio a Cloudflare, mirá [Cloudflare](#cloudflare) más abajo.

### 2. Crear las ramas

En formsis-v2, formsis-backend y formsis-face, creá las ramas `qa` y `dev` desde `main` (en GitHub: selector de ramas → escribir el nombre → "Create branch from main"). En formsis-v2 tiene que ser después de mezclar este cambio en `main`, porque cada ambiente usa el `deploy/actualizar.sh` de su propia rama.

### 3. Producción pasa a app.formsis.com

En el servidor, editá `~/formsis-v2/.env` y dejá estas líneas (`IPS_PERMITIDAS` es la IP pública de tu casa; la ves en <https://ifconfig.me>):

```sh
AMBIENTE=prod
DOMINIO=app.formsis.com
DOMINIO_ANTERIOR=prueba.formsis.com
IPS_PERMITIDAS=181.x.x.x
```

y actualizá:

```sh
~/formsis-v2/deploy/actualizar.sh
```

Los datos no se tocan: es el mismo proyecto de Docker (`formsis`) con los mismos volúmenes. Quien tenía la sesión abierta en `prueba.formsis.com` tiene que volver a entrar, y los enlaces de correos nuevos ya salen con `app.formsis.com`.

### 4. Crear QA


```sh
git clone -b qa https://github.com/gabrielventodev/formsis-v2.git ~/formsis-v2-qa
cd ~/formsis-v2-qa
cp deploy/.env.prod.example .env
nano .env
```

En el `.env` de QA poné `AMBIENTE=qa`, `DOMINIO=qa.formsis.com`, `PUERTO_CONSOLA_MINIO=9002`, contraseñas nuevas (no copies las de producción; generá cada una con `openssl rand -hex 24`), el mismo SMTP que producción y, si querés distinguir los correos, `MAIL_FROM=Formsis QA <no-reply@formsis.com>`. Las líneas de "Solo en el .env de producción" no hacen falta.

Después:

```sh
~/formsis-v2-qa/deploy/actualizar.sh
```

La primera vez compila todo (unos minutos). Al terminar, `qa.formsis.com` abre desde tu casa y da 403 desde cualquier otra red.

### 5. Crear dev

Igual que QA, con `-b dev`, la carpeta `~/formsis-v2-dev`, `AMBIENTE=dev`, `DOMINIO=dev.formsis.com` y `PUERTO_CONSOLA_MINIO=9003`.

### 6. Deploy automático de QA y dev

- **formsis-v2:** no hay que hacer nada; la llave que ya usa sirve. Probalo en GitHub con **Actions → Deploy → Run workflow**, eligiendo `qa`.
- **formsis-backend y formsis-face:** cada uno tiene el workflow "Deploy QA y dev" y necesita los mismos cuatro secretos `DEPLOY_*`. Como la llave privada original ya no está en el servidor (GitHub no deja leer un secreto guardado), creá una nueva para los dos repos, igual que en "Deploy automático" de [despliegue-gcp.md](despliegue-gcp.md):

  ```sh
  ssh-keygen -t ed25519 -N "" -C deploy-submodulos -f ~/deploy_submodulos
  echo "restrict,command=\"$HOME/formsis-v2/deploy/actualizar.sh\" $(cat ~/deploy_submodulos.pub)" >> ~/.ssh/authorized_keys
  cat ~/deploy_submodulos      # va en DEPLOY_SSH_KEY de formsis-backend y de formsis-face
  rm ~/deploy_submodulos ~/deploy_submodulos.pub   # después de guardarla en los dos repos
  ```

  `DEPLOY_HOST`, `DEPLOY_USER` y `DEPLOY_KNOWN_HOSTS` llevan los mismos valores que en formsis-v2.

## Cambiar las IPs permitidas

Las conexiones hogareñas en Argentina suelen cambiar de IP cada tanto. Cuando QA o dev te den 403 desde tu casa, mirá tu IP nueva en <https://ifconfig.me>, cambiala en `IPS_PERMITIDAS` de `~/formsis-v2/.env` (podés poner varias separadas por espacios, o un rango como `181.1.2.0/24`) y aplicalo:

```sh
cd ~/formsis-v2 && docker compose -f docker-compose.prod.yml up -d caddy
```

Para la prueba de vida en QA o dev con el QR, el teléfono tiene que estar en el wifi de tu casa: con datos móviles sale por otra IP y le da 403.

## Cloudflare

La configuración ya está lista para cuando el tráfico pase por Cloudflare: Caddy toma la IP real del visitante de la cabecera `CF-Connecting-IP`, pero solo cuando la conexión viene de los rangos de Cloudflare (listados en `deploy/Caddyfile`). Así la restricción de QA y dev y los límites de intentos de la API siguen viendo la IP de cada persona, y nadie puede hacerse pasar por tu IP mandando esa cabecera directo al servidor.

Para pasar el dominio:

1. En Cloudflare, **Add a site** → `formsis.com` → plan Free. Importa los registros que ya tenés en Namecheap; revisá que estén `@`, `www`, `app`, `qa`, `dev` y `prueba` apuntando a la IP del servidor, y los de Resend (correo) tal cual.
2. En Namecheap, **Domain → Nameservers → Custom DNS** con los dos que te da Cloudflare.
3. En Cloudflare, **SSL/TLS → Overview → Full (strict)**. Caddy sigue sacando sus certificados de Let's Encrypt y Cloudflare los valida.
4. Dejá **Always Use HTTPS** apagado: Caddy ya redirige a https y necesita el puerto 80 libre para renovar los certificados.
5. Los registros pueden quedar con la nube naranja (proxy). Los de correo (MX, TXT) siempre en gris.

Más adelante, con todo ya pasando por Cloudflare, se puede cerrar el firewall de GCP para que 80 y 443 solo acepten los rangos de Cloudflare, y reemplazar la restricción por IP de QA y dev por Cloudflare Access (entrar con el correo, gratis hasta 50 personas), que no depende de que tu IP cambie.

## Recursos del servidor

Medido con los tres ambientes levantados y sin uso: unos 280 MB de memoria por ambiente, 0,9 GB en total con Caddy. La e2-medium (4 GB más 2 GB de swap) alcanza para probar. Lo más pesado es compilar la web, por eso los deploys corren de a uno.

Cuando haya clientes reales en producción conviene que QA y dev no compitan con ella: lo más simple es pasar QA y dev a una segunda máquina chica, o subir la actual a e2-standard-2 (8 GB, más o menos el doble de precio que la e2-medium).

## Respaldos

El plan de respaldos para producción está en [backups.md](backups.md).
