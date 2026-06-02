# App Churrería Guty

Gestion de pedidos (formulario) y otras herramientas, HTML/JS con servidor Express y persistencia en MySQL.

## Requisitos

- Node.js 18+
- MySQL Server 8.x y MySQL Workbench

## Configuración

1. Crea la base de datos y la tabla `pedidos` (ver script SQL propuesto en Workbench).
2. Copia `.env.example` a `.env` y ajusta credenciales:
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`, `PORT`

## Instalación y ejecución

```powershell
Push-Location "C:\Users\Guty\Desktop\AppChurreriaGuty"
npm install
npm start
```

El servidor corre en `http://localhost:3000`.

## Endpoint

- `POST /api/pedidos`
  - Guarda el pedido y calcula `presupuesto_total` en el servidor.
  - Requiere: `nombre`, `telefono`, `fecha`, `hora`, `metodo_pago`.
  - Si `solicita_factura = true` → exige `provincia` y `nif` (se normaliza a mayúsculas).
  - Regla: `presupuesto_total >= 100`.
  - Respuesta: `{ ok: true, id, presupuesto_total }`.

## Estructura

- `public/index.html`: formulario con validaciones y presupuesto dinámico.
- `public/styles.css`: tema visual corporativo.
- `server.js`: servidor Express + conexión MySQL.

## Seguridad y privacidad

- Campo honeypot simple en el formulario.
- NIF se normaliza a mayúsculas en servidor antes de guardar.

## Troubleshooting

- Si el server no arranca, verifica `DB_*` en `.env` y que MySQL esté en marcha.
- Cambia `PORT` en `.env` si el 3000 está en uso.
