# Desplegar Formsis en Google Cloud (ambiente de prueba)

Esta guía deja Formsis corriendo en una sola máquina virtual de Google Cloud, con https y un dominio, para que otras personas lo prueben. Es el mismo `docker compose` que usas en Docker Desktop, con tres cambios: solo se expone Caddy (puertos 80 y 443), Caddy saca el certificado https solo, y los secretos son obligatorios.

```
Internet ──https──> Caddy ──> web (Next.js) ──> api (Go) ──> db (Postgres)
                                                   ├──────> storage (MinIO)
                                                   └──────> face (prueba de vida)
```

La API, la base, MinIO y el servicio de prueba de vida no se ven desde internet. El navegador solo habla con la web, que reenvía `/api/v1` a la API por la red interna.

**Costo aproximado:** una e2-medium (2 vCPU, 4 GB) con disco de 30 GB e IP fija sale entre 30 y 45 USD al mes según la región. Los 300 USD de prueba la cubren de sobra durante los 90 días. Son valores de referencia; revisa la [calculadora de precios](https://cloud.google.com/products/calculator) si quieres el número exacto.

Todos los comandos de Google Cloud se ejecutan en **Cloud Shell**, una terminal que corre en el navegador. No necesitas instalar nada en Windows.

---

## 1. Crear la cuenta y el proyecto

1. Entra a [console.cloud.google.com](https://console.cloud.google.com) y activa la prueba gratuita (pide una tarjeta, pero no cobra mientras no actives la cuenta de pago).
2. Arriba a la izquierda, en el selector de proyectos, crea uno nuevo, por ejemplo `formsis-prueba`. Anota el **ID del proyecto** que aparece debajo del nombre (puede ser distinto, como `formsis-prueba-471203`).
3. Recomendado: en **Facturación → Presupuestos y alertas** crea un presupuesto de, por ejemplo, 50 USD para recibir un correo si el gasto se dispara.

## 2. Crear la máquina virtual

Abre Cloud Shell con el ícono `>_` de la barra superior y pega estos comandos, cambiando `TU_ID_DE_PROYECTO`:

```sh
gcloud config set project TU_ID_DE_PROYECTO
gcloud services enable compute.googleapis.com

# Elige la región más cercana a quienes van a probar. Ejemplos:
#   southamerica-west1 (Santiago), southamerica-east1 (São Paulo), us-east1 (Carolina del Sur, más barata)
REGION=southamerica-west1
ZONA=${REGION}-a

# IP pública fija, para que no cambie si reinicias la máquina
gcloud compute addresses create formsis-ip --region=$REGION

# La máquina: Ubuntu 24.04, 2 vCPU, 4 GB de RAM, 30 GB de disco
gcloud compute instances create formsis \
  --zone=$ZONA \
  --machine-type=e2-medium \
  --image-family=ubuntu-2404-lts-amd64 --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB --boot-disk-type=pd-balanced \
  --address=formsis-ip \
  --tags=formsis-web

# Firewall: abre http y https solo para esta máquina
gcloud compute firewall-rules create formsis-web \
  --allow=tcp:80,tcp:443,udp:443 \
  --target-tags=formsis-web

# Muestra la IP pública
gcloud compute addresses describe formsis-ip --region=$REGION --format='value(address)'
```

Anota la IP que aparece al final, por ejemplo `34.176.10.20`.

## 3. Elegir el dominio

Necesitas un nombre de dominio que apunte a la IP. Caddy lo usa para pedir el certificado https, y sin https la cámara del celular no funciona en la prueba de vida.

- **Sin dominio propio (lo más rápido):** usa [sslip.io](https://sslip.io), que es gratis y no requiere registrarse. Escribe la IP con guiones: para `34.176.10.20` el dominio es `34-176-10-20.sslip.io`. Ya funciona, no hay nada que configurar.
- **Con dominio propio:** en el panel de tu proveedor de dominio crea un registro **A**, por ejemplo `formsis.tudominio.com`, que apunte a la IP. Espera unos minutos a que se propague (puedes comprobarlo con `nslookup formsis.tudominio.com`).

## 4. Entrar a la máquina y prepararla

Desde Cloud Shell:

```sh
gcloud compute ssh formsis --zone=$ZONA
```

La primera vez te pide crear una llave SSH; acepta con Enter. También puedes entrar con el botón **SSH** junto a la máquina en **Compute Engine → Instancias de VM**.

Ya dentro de la máquina, clona el repo con los submódulos y prepara el servidor:

```sh
git clone --recurse-submodules https://github.com/gabrielventodev/formsis-v2.git
cd formsis-v2
bash deploy/preparar-servidor.sh
```

El script instala Docker, agrega 2 GB de swap (ayuda a compilar en 4 GB de RAM) y te deja usar `docker` sin `sudo`. Al terminar, **sal con `exit` y vuelve a entrar** con el mismo `gcloud compute ssh` para que tome el permiso.

## 5. Configurar los secretos

```sh
cd formsis-v2
cp deploy/.env.prod.example .env
```

Genera un valor aleatorio para cada secreto (ejecútalo una vez por cada uno y copia el resultado):

```sh
openssl rand -hex 24
```

Edita el archivo con `nano .env` y completa como mínimo:

| Variable | Qué poner |
|---|---|
| `DOMINIO` | El dominio del paso 3, sin `https://`, por ejemplo `34-176-10-20.sslip.io` |
| `POSTGRES_PASSWORD` | Un valor de `openssl rand -hex 24` |
| `MINIO_ROOT_PASSWORD` | Otro valor aleatorio |
| `FACE_TOKEN` | Otro valor aleatorio |
| `ADMIN_EMAIL` | Tu correo; con él entras al panel |
| `ADMIN_PASSWORD` | La contraseña inicial del panel (cámbiala después desde Mi cuenta) |

En nano se guarda con `Ctrl+O`, Enter, y se sale con `Ctrl+X`.

**Correos:** si dejas `SMTP_HOST` vacío, los correos (enlaces mágicos, invitaciones, recuperar contraseña) no se envían y quedan escritos en el log de la API. Para que otras personas los reciban, configura un SMTP. Dos opciones gratis para pruebas: [Brevo](https://www.brevo.com) (300 correos al día) o una [contraseña de aplicación de Gmail](https://myaccount.google.com/apppasswords) con `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, tu Gmail como usuario y `MAIL_FROM` con tu misma dirección.

> Importante: no cambies `POSTGRES_PASSWORD` después del primer arranque. Postgres la guarda al crear la base y, si la cambias en `.env`, la API ya no podrá conectarse.

## 6. Primer arranque

```sh
docker compose -f docker-compose.prod.yml up -d --build
```

La primera vez compila todo y tarda varios minutos. Para ver cómo va:

```sh
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f caddy api
```

Cuando Caddy muestre `certificate obtained successfully`, abre `https://TU_DOMINIO` en el navegador y entra al panel con `ADMIN_EMAIL` y `ADMIN_PASSWORD`. Sal de los logs con `Ctrl+C` (los servicios siguen corriendo).

Para comprobar la prueba de vida desde el celular, abre un formulario con un campo de prueba de vida, escanea el QR y verifica que el navegador del celular pida permiso para la cámara.

Para no escribir `-f docker-compose.prod.yml` cada vez, puedes dejarlo fijo en la sesión:

```sh
echo 'export COMPOSE_FILE=docker-compose.prod.yml' >> ~/.bashrc && source ~/.bashrc
```

Desde ahí basta con `docker compose ps`, `docker compose logs -f api`, etc. Los comandos de abajo asumen que hiciste esto.

---

## Operación del día a día

**Actualizar a la última versión** (después de mezclar cambios en `main`):

```sh
cd ~/formsis-v2
git pull
git submodule update --init
docker compose up -d --build
```

Las migraciones de la base se aplican solas al arrancar la API.

**Cargar datos de ejemplo** (un formulario con envíos en varios estados para mirar el panel):

```sh
docker compose exec -T db psql -U formsis formsis < scripts/seed-demo.sql
```

**Ver un enlace mágico sin SMTP:**

```sh
docker compose logs api | grep "SMTP not configured"
```

**Respaldar la base:**

```sh
docker compose exec -T db pg_dump -U formsis formsis | gzip > respaldo-$(date +%F).sql.gz
```

Para bajarlo a tu computador, desde Cloud Shell: `gcloud compute scp formsis:~/formsis-v2/respaldo-AAAA-MM-DD.sql.gz . --zone=$ZONA`, y luego en Cloud Shell el menú **⋮ → Descargar**.

**Abrir la consola de MinIO** (archivos subidos). No está publicada en internet. Desde Cloud Shell abre un túnel:

```sh
gcloud compute ssh formsis --zone=$ZONA -- -L 8081:localhost:9001
```

y usa **Vista previa en la Web → Cambiar puerto → 8081** en Cloud Shell. Entras con `MINIO_ROOT_USER` y `MINIO_ROOT_PASSWORD`.

**Ahorrar crédito cuando nadie esté probando:** detén la máquina y vuelve a encenderla cuando la necesites. Los datos quedan en el disco y la IP fija se mantiene; los servicios arrancan solos.

```sh
gcloud compute instances stop formsis --zone=$ZONA
gcloud compute instances start formsis --zone=$ZONA
```

Mientras está detenida solo pagas el disco y la IP (unos pocos dólares al mes).

## Cuando termine la prueba

El crédito vence a los 90 días aunque te sobre. Antes de eso, decide:

- **Seguir en Google Cloud:** activa la cuenta de pago; la máquina sigue igual.
- **Mudarte a un VPS más barato** (Hetzner, DigitalOcean, etc.): haz un respaldo de la base, repite los pasos 4 a 6 en el nuevo servidor, restaura con `gunzip -c respaldo.sql.gz | docker compose exec -T db psql -U formsis formsis` y apunta el dominio a la nueva IP. Los archivos de MinIO están en el volumen `formsis_storage`.
- **Borrarlo todo** para que no quede nada cobrando:

```sh
gcloud compute instances delete formsis --zone=$ZONA
gcloud compute addresses delete formsis-ip --region=$REGION
gcloud compute firewall-rules delete formsis-web
```

## Problemas comunes

- **Caddy no obtiene el certificado.** Revisa `docker compose logs caddy`. Casi siempre es que el dominio todavía no apunta a la IP (compruébalo con `nslookup TU_DOMINIO`) o que falta la regla de firewall del paso 2. Después de corregirlo, `docker compose restart caddy`.
- **`Falta DOMINIO en .env`** (o cualquier otra variable). El archivo `.env` debe estar en la raíz del repo, junto a `docker-compose.prod.yml`, y esa variable no puede estar vacía.
- **La compilación se corta o la máquina se pone muy lenta.** Comprueba que el swap esté activo con `free -h`. Si sigue fallando, cambia temporalmente la máquina a e2-standard-2 (8 GB) desde la consola.
- **La cámara del celular no abre.** La página tiene que abrirse con `https://`. Si abriste por IP o por `http://`, el navegador bloquea la cámara.
- **Cambiaste `POSTGRES_PASSWORD` y la API no conecta.** Vuelve a poner la contraseña original en `.env`. Si es una instalación nueva sin datos que te importen, puedes borrar la base y empezar de cero con `docker compose down -v` (esto borra todos los datos y archivos).
