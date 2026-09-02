# App Churrería Guty

Gestión de pedidos de una churrería: formulario público de reserva/presupuesto y panel de administración completo (pedidos, clientes, proveedores, precios, información de empresa). Backend en Node.js/Express con persistencia en MySQL, frontend en HTML/CSS/JS sin frameworks.

## Requisitos

- Node.js 18+
- MySQL Server 8.x (y opcionalmente MySQL Workbench)

## Configuración

1. Crea la base de datos (el servidor crea/actualiza las tablas automáticamente al arrancar mediante `ensureSchema()`; también hay un dump de referencia en [app_pedidos_guty.sql](app_pedidos_guty.sql)).
2. Crea un archivo `.env` en la raíz con estas variables:

   | Variable | Descripción | Por defecto |
   |---|---|---|
   | `PORT` | Puerto del servidor | `3000` |
   | `DB_HOST` | Host de MySQL | `localhost` |
   | `DB_PORT` | Puerto de MySQL | `3306` |
   | `DB_USER` | Usuario de MySQL | `root` |
   | `DB_PASS` | Contraseña de MySQL | (vacío) |
   | `DB_NAME` | Base de datos | `app_pedidos_guty` |
   | `DB_SSL` | `true` activa TLS en la conexión MySQL (necesario para TiDB Cloud u otros proveedores en la nube) | (vacío = sin TLS, para MySQL local) |
   | `SESSION_SECRET` | Secreto para firmar la cookie de sesión de admin | `change-me` |
   | `ADMIN_USER` | Usuario del panel de administración | `admin` |
   | `ADMIN_PASS_HASH` | Hash bcrypt de la contraseña de admin | (si vacío, la contraseña es `admin123`) |
   | `NODE_ENV` | `production` activa cookies `secure` | (vacío) |

## Instalación y ejecución

```powershell
Push-Location "C:\Users\Guty\Desktop\AppChurreriaGuty"
npm install
npm start
```

Para desarrollo con recarga automática: `npm run dev` (nodemon).

El servidor corre en `http://localhost:3000`.

## Entornos (local vs. producción con TiDB Cloud)

El servidor siempre lee la conexión de `process.env.DB_*`, nunca hay datos de base de datos hardcodeados. Para usar MySQL local en desarrollo y TiDB Cloud en producción no hace falta tocar código, solo configurar variables de entorno distintas en cada sitio:

- **Local**: tu `.env` (ignorado por git) con `DB_HOST=localhost` y el resto de credenciales de tu MySQL local, sin `DB_SSL`.
- **Producción**: en el panel de la plataforma de despliegue (Render, Railway, Fly.io, VPS, etc.) configura `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME` con los datos de tu cluster de TiDB Cloud y añade `DB_SSL=true` (TiDB Cloud exige TLS).

## Tests

```powershell
npm test
```

Usa el runner nativo de Node (`node --test`) sobre los archivos en [test/](test/): validaciones de formulario, selector de clientes e integración de endpoints (supertest).

## Estructura

- `server.js`: servidor Express único con todas las rutas (páginas, API, login/logout de admin), validaciones y `ensureSchema()` (creación/migración de tablas).
- `public/`: sitio público sin autenticación.
  - `index.html`: formulario de pedido con presupuesto dinámico.
  - `privacidad.html`, `terminos.html`: páginas legales.
  - `styles.css`: hoja de estilos compartida por todo el sitio (público y admin).
- `private/`: panel de administración, protegido por sesión (`ensureAdmin`).
  - `admin_login.html` / `admin.html`: login y menú principal.
  - `pedidos.html`: gestión de pedidos activos (vista tabla/fichas/calendario, filtros, paginación, exportar CSV, imprimir PDF/factura).
  - `historial_pedidos.html`: histórico de pedidos cobrados.
  - `admin_pedido.html`: ficha de detalle/edición de un pedido.
  - `crear_pedido.html`: alta de pedidos desde administración.
  - `clientes.html`, `proveedores.html`: gestión de clientes y proveedores (CRUD, export CSV).
  - `precios.html`: edición de los precios vigentes (churro, chocolate, envío).
  - `informacion_empresa.html`: notas/información interna de la empresa.
- `utils/`: lógica compartida y testeable.
  - `validations.js`: validaciones de NIF/NIE/CIF español, teléfono, email, etc.
  - `clientePicker.js`: buscador/selector de clientes reutilizado en varias vistas.
- `test/`: tests unitarios y de integración (Node test runner + supertest).
- `img/`: recursos gráficos.
- `app_pedidos_guty.sql`: dump/esquema de referencia de la base de datos.

## Endpoints principales

### Públicos
- `GET /health` — comprobación de estado.
- `GET /api/precios` — precios vigentes (churro/chocolate/envío), usados para calcular presupuestos.
- `POST /api/pedidos` — crea un pedido desde el formulario público.
  - Requiere: `nombre`, `telefono`, `fecha`, `hora`, `metodo_pago`.
  - Si `solicita_factura = true` → exige `provincia` y `nif` (normalizado a mayúsculas).
  - Guarda un snapshot de precios (`precio_churro`, `precio_chocolate`, `precio_envio` con IVA) en el propio pedido para que las facturas ya emitidas no cambien si luego se editan los precios globales.
  - Respuesta: `{ ok: true, id, presupuesto_total }`.

### Autenticación de administrador
- `POST /admin/login`, `POST /admin/logout`.
- Resto de rutas bajo `/admin/*` requieren sesión activa (middleware `ensureAdmin`) y se sirven con `Cache-Control: no-store`.

### Panel de administración (API, todas bajo `/admin/api/*`, protegidas)
- **Pedidos**: `GET /pedidos`, `GET /pedidos/:id`, `PUT /pedidos/:id`, `DELETE /pedidos/:id`, `GET /export.csv`.
- **Clientes**: `GET/POST /clientes`, `PUT/DELETE /clientes/:id`, `GET /clientes/export.csv`.
- **Proveedores**: `GET/POST /proveedores`, `PUT/DELETE /proveedores/:id`, `GET /proveedores/export.csv`.
- **Precios**: `GET/PUT /precios`.
- **Información de empresa**: `GET/POST /info-empresa`, `DELETE /info-empresa/:id`.

## Seguridad y privacidad

- Sesiones de administrador con `express-session` (cookie `secure` en producción).
- Contraseña de admin verificada con `bcryptjs` contra `ADMIN_PASS_HASH`.
- Validación de NIF/NIE/CIF español y teléfono/email en servidor.
- NIF normalizado a mayúsculas antes de guardar.
- Rutas `/admin/*` fuerzan `Cache-Control: no-store` para no cachear datos sensibles.

## Troubleshooting

- Si el servidor no arranca, verifica las variables `DB_*` en `.env` y que MySQL esté en marcha.
- Cambia `PORT` en `.env` si el 3000 está en uso.
- Si no puedes entrar al panel admin, revisa `ADMIN_USER`/`ADMIN_PASS_HASH` (o usa `admin`/`admin123` por defecto si no configuraste el hash).
