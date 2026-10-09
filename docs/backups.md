# Plan de respaldos: 5 capas por cliente

Plan para el ambiente productivo de cada cliente, sea en nuestros servidores o en los suyos. Todavía no está implementado: es la referencia para cuando entre el primer cliente. QA y dev no se respaldan (sus datos son de prueba).

La idea es que ningún problema solo (un borrado por error, una base corrupta, un servidor caído, una cuenta comprometida, un ransomware o la caída de un proveedor) pueda llevarse todas las copias a la vez.

## Qué se respalda

| Qué | Dónde vive | Por qué importa |
|---|---|---|
| Base de datos (PostgreSQL) | Volumen `pgdata` | Formularios, envíos, usuarios, auditoría |
| Archivos subidos (MinIO) | Volumen `storage` | Documentos, firmas y selfies de la prueba de vida: datos sensibles (biométricos) para la Ley 25.326 |
| Secretos (`.env`) | Carpeta del ambiente | Sin ellos no se puede levantar la copia. Se guardan aparte, en un gestor de contraseñas, nunca en texto plano junto a los respaldos |

No hace falta respaldar las imágenes de Docker ni los certificados de Caddy: se reconstruyen solos.

## Las 5 capas

| # | Capa | Frecuencia | Retención | Pérdida máxima (RPO) | Tiempo para volver (RTO) | Protege contra |
|---|---|---|---|---|---|---|
| 1 | Recuperación a un momento exacto (PITR) de PostgreSQL | Continua (WAL) + base completa semanal | 14 días | ~5 minutos | 30–60 min | Borrados o cambios por error, bugs que dañan datos |
| 2 | Snapshots del disco del servidor | Diaria | 7 diarios + 4 semanales | 24 h | 15–30 min | Servidor roto, actualización fallida del sistema |
| 3 | Copia diaria cifrada en otra región | Diaria | 30 diarias + 12 mensuales | 24 h | 1–2 h | Pérdida de la región o del disco y sus snapshots |
| 4 | Copia inmutable en otro proveedor | Diaria | 90 días bloqueada (WORM) | 24 h | 2–4 h | Ransomware, cuenta o credenciales comprometidas, error humano grave, caída del proveedor principal |
| 5 | Copia fría mensual fuera de línea | Mensual | 12 meses (o lo que pida el contrato) | 1 mes | 1 día | Desastre total, auditorías, pedidos legales de datos históricos |

### 1. PITR de PostgreSQL

pgBackRest (o WAL-G) en un contenedor junto a la base: archiva cada segmento WAL a un bucket de objetos y hace una copia completa por semana. Permite volver la base al minuto anterior a un error ("antes del DELETE de las 14:32"). Para los archivos de MinIO se activa el versionado del bucket, que cumple el mismo papel: un archivo borrado o pisado se recupera de la versión anterior.

### 2. Snapshots del disco

Programación de snapshots del proveedor (en GCP, *snapshot schedule* sobre el disco de la VM; en un VPS, la función equivalente). Es la forma más rápida de volver una máquina entera, pero vive en la misma cuenta y el mismo proveedor, así que no alcanza sola.

### 3. Copia diaria en otra región

Todas las noches, `pg_dump` de la base más los archivos de MinIO, con restic (cifrado AES-256, deduplicado, incremental) hacia un bucket en otra región del mismo proveedor. Es el respaldo "de todos los días" que se usa para restaurar en otra máquina.

### 4. Copia inmutable en otro proveedor

La misma copia de restic, enviada a un proveedor distinto del que aloja al cliente (Cloudflare R2 o Backblaze B2) en un bucket con bloqueo de objetos (*object lock* en modo *compliance*): durante 90 días nadie puede borrarla ni modificarla, ni siquiera nosotros con la cuenta de administrador. Las credenciales del servidor solo pueden escribir, no borrar. Es la capa que sobrevive a un ransomware o a que alguien entre a nuestra cuenta.

### 5. Copia fría mensual

Una vez por mes, una copia completa a almacenamiento de archivo (clase *archive*/*cold*) en una cuenta separada, con credenciales que no están en ningún servidor. Sirve para desastres totales y para cumplir plazos legales o contractuales de conservación.

## Reglas que valen para todas las capas

- **Cifrado siempre.** Todo sale del servidor cifrado. La clave de restic se guarda en dos lugares (gestor de contraseñas del equipo y una copia sellada fuera de línea); sin ella las copias no sirven.
- **Una copia que no se probó no existe.** Restauración automática semanal de la copia más reciente en un ambiente aislado, con una verificación básica (la API arranca, los conteos de envíos y archivos coinciden). Simulacro completo de desastre cada tres meses, midiendo el tiempo real de vuelta.
- **Alertas.** Cada tarea de respaldo avisa al terminar (por ejemplo con Healthchecks.io); si no avisa a tiempo, llega un correo o un mensaje. También alerta si el WAL deja de archivarse.
- **Separación de cuentas.** Las capas 4 y 5 viven en cuentas distintas de la del servidor, con acceso de dos personas.
- **Borrado a pedido.** Si un titular pide borrar sus datos (Ley 25.326), se borran de la base y de MinIO; en las copias quedan hasta que vence su retención, y si se restaura una copia se vuelve a aplicar la lista de borrados pendientes.

## Clientes con sus propios servidores

Se aplican las mismas 5 capas, con estos cambios:

- Entregamos el respaldo como un contenedor más del `docker-compose` (pgBackRest + restic + tareas programadas) y un manual de restauración.
- Los destinos de las capas 3, 4 y 5 son cuentas del cliente; nosotros, como mucho, con permiso de solo escritura para monitorear.
- El contrato define quién hace qué: quién paga el almacenamiento, quién recibe las alertas, quién hace las pruebas de restauración y en qué plazo.

## Aspectos legales (Argentina)

- La Ley 25.326 (art. 9) obliga a tomar medidas de seguridad sobre los datos personales; los respaldos cifrados y probados son parte de eso, y conviene documentarlos.
- Guardar copias fuera de Argentina es una transferencia internacional (art. 12): hay que elegir proveedores y regiones que cumplan con los criterios de la AAIP o firmar las cláusulas modelo. Conviene revisarlo con un abogado antes del primer cliente.
- Los plazos de RPO y RTO de la tabla son los que se pueden ofrecer en el contrato (SLA).

## Orden para implementarlo

1. Capas 3 y 4 (la copia diaria cifrada y la inmutable): son las que más riesgo cubren por menos trabajo.
2. Pruebas automáticas de restauración y alertas.
3. Capa 2 (snapshots), que en GCP es solo configuración.
4. Capa 1 (PITR), cuando el volumen de datos haga que perder un día sea inaceptable.
5. Capa 5 (fría mensual).

Costo orientativo para un cliente chico (decenas de GB): unos pocos dólares por mes de almacenamiento por capa; lo que más pesa son los archivos subidos, no la base.
