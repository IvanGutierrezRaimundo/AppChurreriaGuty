const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');
const session = require('express-session');
const bcrypt = require('bcryptjs');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para loggear todas las peticiones
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] Petición recibida: ${req.method} ${req.originalUrl}`);
  next();
});

app.use('/admin', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Sesiones para autenticación de administrador
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  })
);

function ensureAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.set('Cache-Control', 'no-store');
  return res.status(401).json({ ok: false, error: 'No autorizado' });
}

app.get('/health', (_req, res) => res.json({ ok: true }));

// Login y logout de administrador
app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body || {};
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminHash = process.env.ADMIN_PASS_HASH || '';

  if (!username || !password) {
    return res.status(400).json({ ok: false, error: 'Usuario y contraseña requeridos' });
  }
  if (username !== adminUser) {
    return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
  }
  const valid = adminHash ? await bcrypt.compare(password, adminHash) : password === 'admin123';
  if (!valid) {
    return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
  }
  req.session.admin = { username };
  return res.json({ ok: true });
});

app.post('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// Página del panel (protegida)
app.get('/admin', (req, res) => {
  if (req.session && req.session.admin) {
    return res.sendFile(path.join(__dirname, 'private', 'admin.html'), {
      headers: { 'Cache-Control': 'no-store' }
    });
  }
  return res.sendFile(path.join(__dirname, 'private', 'admin_login.html'), {
    headers: { 'Cache-Control': 'no-store' }
  });
});

// Página de pedidos (ficha 1 del menú admin)
app.get('/admin/pedidos', ensureAdmin, (_req, res) => {
  return res.sendFile(path.join(__dirname, 'private', 'pedidos.html'), {
    headers: { 'Cache-Control': 'no-store' }
  });
});

// Página de historial de pedidos cobrados
app.get('/admin/historial-pedidos', ensureAdmin, (_req, res) => {
  return res.sendFile(path.join(__dirname, 'private', 'historial_pedidos.html'), {
    headers: { 'Cache-Control': 'no-store' }
  });
});

// Página de clientes (ficha del menú admin)
app.get('/admin/clientes', ensureAdmin, (_req, res) => {
  return res.sendFile(path.join(__dirname, 'private', 'clientes.html'), {
    headers: { 'Cache-Control': 'no-store' }
  });
});

app.post('/api/pedidos', async (req, res) => {
  try {
    const {
      nombre,
      telefono,
      email,
      cp,
      direccion,
      ciudad,
      provincia,
      nif,
      solicita_factura,
      personas,
      churros_por_persona,
      chocolates,
      fecha,
      hora,
      requiere_envio,
      direccion_entrega,
      metodo_pago,
      comentarios
    } = req.body || {};

    if (!nombre || !telefono || !fecha || !hora || !metodo_pago) {
      return res.status(400).json({ ok: false, error: 'Campos obligatorios faltan: nombre, teléfono, fecha, hora, método de pago.' });
    }

    const personasNum = Number(personas);
    const churrosPorNum = Number(churros_por_persona);
    const chocolatesNum = Number(chocolates);
    const envioBool = !!requiere_envio;
    const facturaBool = !!solicita_factura;
    const MAX_DIRECCION = 100;
    const MAX_COMENTARIOS = 200;

    const churrosOk = Number.isFinite(personasNum) && personasNum > 0 && Number.isFinite(churrosPorNum) && churrosPorNum >= 2 && churrosPorNum <= 12;
    const priceChurros = churrosOk ? personasNum * churrosPorNum * 0.25 : 0;
    const priceChoco = Number.isFinite(chocolatesNum) && chocolatesNum >= 0 ? chocolatesNum * 1.5 : 0;
    const priceEnvio = envioBool ? 25 : 0;
    const presupuesto_total = Number((priceChurros + priceChoco + priceEnvio).toFixed(2));

    if (presupuesto_total < 100) {
      return res.status(400).json({ ok: false, error: 'El presupuesto mínimo es 100 €.' });
    }

    if (facturaBool && (!provincia || !nif)) {
      return res.status(400).json({ ok: false, error: 'Provincia y NIF son obligatorios si se solicita factura.' });
    }

    if (typeof direccion === 'string' && direccion.length > MAX_DIRECCION) {
      return res.status(400).json({ ok: false, error: `La dirección no puede superar ${MAX_DIRECCION} caracteres.` });
    }

    if (typeof direccion_entrega === 'string' && direccion_entrega.length > MAX_DIRECCION) {
      return res.status(400).json({ ok: false, error: `La dirección de entrega no puede superar ${MAX_DIRECCION} caracteres.` });
    }

    if (typeof comentarios === 'string' && comentarios.length > MAX_COMENTARIOS) {
      return res.status(400).json({ ok: false, error: `Los comentarios no pueden superar ${MAX_COMENTARIOS} caracteres.` });
    }

    const sql = `
      INSERT INTO pedidos (
        nombre, telefono, email, cp, direccion, ciudad, provincia, nif, solicita_factura,
        personas, churros_por_persona, chocolates, fecha, hora,
        requiere_envio, direccion_entrega, metodo_pago, comentarios, presupuesto_total
      ) VALUES (?,?,?,?,?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?)
    `;

    const params = [
      nombre, telefono, email || null, cp || null, direccion || null, ciudad || null, provincia || null, (nif || '').toUpperCase() || null, facturaBool,
      Number.isFinite(personasNum) ? personasNum : null,
      Number.isFinite(churrosPorNum) ? churrosPorNum : null,
      Number.isFinite(chocolatesNum) ? chocolatesNum : null,
      fecha, hora,
      envioBool, direccion_entrega || null, metodo_pago, comentarios || null, presupuesto_total
    ];

    const [result] = await pool.execute(sql, params);
    return res.status(201).json({ ok: true, id: result.insertId, presupuesto_total });
  } catch (err) {
    console.error('Error al insertar pedido:', err);
    return res.status(500).json({ ok: false, error: 'Error interno.' });
  }
});

// --- APIs de administración ---
app.get('/admin/api/pedidos', ensureAdmin, async (req, res) => {
  try {
    const { q, desde, hasta, estado, page = 1, pageSize = 20 } = req.query;
    // Ordenación segura por columnas permitidas
    const sortMap = {
      id: 'id',
      nombre: 'nombre',
      personas: 'personas',
      churros_por_persona: 'churros_por_persona',
      chocolates: 'chocolates',
      fecha: 'fecha',
      hora: 'hora',
      presupuesto_total: 'presupuesto_total',
      estado: 'estado'
    };
    const sortParam = (req.query.sort || 'fecha').toString();
    const dirParam = (req.query.dir || 'desc').toString().toLowerCase();
    const sortCol = sortMap[sortParam] || 'fecha';
    const sortDir = dirParam === 'asc' ? 'ASC' : 'DESC';
    const where = [];
    const params = [];
    if (q) {
      where.push('(nombre LIKE ? OR email LIKE ? OR telefono LIKE ? OR ciudad LIKE ? OR provincia LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like, like, like);
    }
    if (estado) {
      where.push('estado = ?');
      params.push(estado);
    }
    if (desde) { where.push('fecha >= ?'); params.push(desde); }
    if (hasta) { where.push('fecha <= ?'); params.push(hasta); }
    const safePageSize = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 500);
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (safePage - 1) * safePageSize;
    const sql = `SELECT id, nombre, telefono, email, cp, direccion, ciudad, provincia, nif, personas, churros_por_persona, chocolates, fecha, hora, presupuesto_total, estado
           FROM pedidos
           ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
           ORDER BY ${sortCol} ${sortDir}, id DESC
           LIMIT ${safePageSize} OFFSET ${offset}`;
    const [rows] = await pool.execute(sql, params);
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error('Error listando pedidos:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

app.get('/admin/api/clientes', ensureAdmin, async (req, res) => {
  try {
    const { q, page = 1, pageSize = 20 } = req.query;
    const sortMap = {
      id: 'id',
      nif: 'nif',
      nombre: 'nombre',
      telefono: 'telefono',
      email: 'email',
      direccion: 'direccion',
      ciudad: 'ciudad',
      provincia: 'provincia',
      cp: 'cp',
      fecha_registro: 'fecha_registro'
    };
    const sortParam = (req.query.sort || 'fecha_registro').toString();
    const dirParam = (req.query.dir || 'desc').toString().toLowerCase();
    const sortCol = sortMap[sortParam] || 'fecha_registro';
    const sortDir = dirParam === 'asc' ? 'ASC' : 'DESC';

    const where = [];
    const params = [];
    if (q) {
      where.push('(nombre LIKE ? OR nif LIKE ? OR telefono LIKE ? OR email LIKE ? OR direccion LIKE ? OR ciudad LIKE ? OR provincia LIKE ? OR cp LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like, like, like, like, like, like);
    }

    const safePageSize = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 500);
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (safePage - 1) * safePageSize;

    const sql = `SELECT id, nif, nombre, telefono, email, direccion, ciudad, provincia, cp, fecha_registro
      FROM clientes
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY ${sortCol} ${sortDir}, id DESC
      LIMIT ${safePageSize} OFFSET ${offset}`;

    const [rows] = await pool.execute(sql, params);
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error('Error listando clientes:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

// Obtener detalle de un pedido
app.get('/admin/api/pedidos/:id', ensureAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: 'ID inválido' });
    const [rows] = await pool.execute('SELECT * FROM pedidos WHERE id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ ok: false, error: 'No encontrado' });
    res.json({ ok: true, data: rows[0] });
  } catch (err) {
    console.error('Error obteniendo pedido:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

app.delete('/admin/api/pedidos/:id', ensureAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: 'ID inválido' });
    const [rows] = await pool.execute('SELECT estado FROM pedidos WHERE id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Pedido no encontrado' });
    }
    const estadoActual = rows[0].estado || 'Pendiente';
    if (estadoActual !== 'Cancelado') {
      return res.status(400).json({
        ok: false,
        error: 'Solo se puede eliminar un pedido con estado Cancelado.'
      });
    }
    const [result] = await pool.execute('DELETE FROM pedidos WHERE id = ?', [id]);
    res.json({ ok: true, affectedRows: result.affectedRows });
  } catch (err) {
    console.error('Error eliminando pedido:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

app.put('/admin/api/pedidos/:id', ensureAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: 'ID inválido' });
    const body = req.body || {};
    // Obtener el pedido actual para mezclar valores y mantener obligatorios
    const [rows] = await pool.execute('SELECT * FROM pedidos WHERE id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ ok: false, error: 'No encontrado' });
    const current = rows[0];

    // Lista blanca de campos actualizables (igual que inserción)
    const allowed = [
      'nombre','telefono','email','cp','direccion','ciudad','provincia','nif','solicita_factura',
      'personas','churros_por_persona','chocolates','fecha','hora',
      'requiere_envio','direccion_entrega','metodo_pago','comentarios',
      'estado'
    ];

    // Mezclar: valores actuales + cambios del body
    const merged = { ...current };
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        merged[key] = body[key];
      }
    }

    // Normalizar tipos y formatos
    merged.solicita_factura = merged.solicita_factura ? 1 : 0;
    merged.requiere_envio = merged.requiere_envio ? 1 : 0;
    // Numéricos
    const numOrNull = (v) => {
      if (v === '' || v === null || typeof v === 'undefined') return null;
      const n = Number(v); return Number.isFinite(n) ? n : null;
    };
    merged.personas = numOrNull(merged.personas);
    merged.churros_por_persona = numOrNull(merged.churros_por_persona);
    merged.chocolates = numOrNull(merged.chocolates);
    // Fecha YYYY-MM-DD
    if (typeof merged.fecha === 'string') {
      const s = merged.fecha.includes('T') ? merged.fecha.slice(0,10) : merged.fecha;
      merged.fecha = s ? s.slice(0,10) : current.fecha;
    }
    // Hora HH:MM:SS
    if (typeof merged.hora === 'string') {
      const s = merged.hora;
      const m2 = /^(\d{2}):(\d{2})$/.exec(s);
      const m3 = /^(\d{2}):(\d{2}):(\d{2})$/.exec(s);
      merged.hora = m3 ? `${m3[1]}:${m3[2]}:${m3[3]}` : (m2 ? `${m2[1]}:${m2[2]}:00` : s);
    }
    // NIF mayúsculas o null
    merged.nif = (merged.nif || '').toString().toUpperCase() || null;
    // Strings vacíos → null donde aplica
    const nullIfEmpty = (v) => (v === '' || typeof v === 'undefined') ? null : v;
    merged.email = nullIfEmpty(merged.email);
    merged.cp = nullIfEmpty(merged.cp);
    merged.direccion = nullIfEmpty(merged.direccion);
    merged.ciudad = nullIfEmpty(merged.ciudad);
    merged.provincia = nullIfEmpty(merged.provincia);
    merged.direccion_entrega = nullIfEmpty(merged.direccion_entrega);
    merged.comentarios = nullIfEmpty(merged.comentarios);
    merged.metodo_pago = (merged.metodo_pago || current.metodo_pago);
    merged.nombre = (merged.nombre || current.nombre);
    merged.telefono = (merged.telefono || current.telefono);

    // Validaciones igual que el formulario
    if (!merged.nombre || !merged.telefono || !merged.fecha || !merged.hora || !merged.metodo_pago) {
      return res.status(400).json({ ok: false, error: 'Campos obligatorios faltan: nombre, teléfono, fecha, hora, método de pago.' });
    }
    if (merged.solicita_factura === 1 && (!merged.provincia || !merged.nif)) {
      return res.status(400).json({ ok: false, error: 'Provincia y NIF son obligatorios si se solicita factura.' });
    }

    // Recalcular presupuesto_total igual que POST
    const personasNum = Number(merged.personas);
    const churrosPorNum = Number(merged.churros_por_persona);
    const chocolatesNum = Number(merged.chocolates);
    const envioBool = !!merged.requiere_envio;
    const churrosOk = Number.isFinite(personasNum) && personasNum > 0 && Number.isFinite(churrosPorNum) && churrosPorNum >= 4 && churrosPorNum <= 12;
    const priceChurros = churrosOk ? personasNum * churrosPorNum * 0.25 : 0;
    const priceChoco = Number.isFinite(chocolatesNum) && chocolatesNum >= 0 ? chocolatesNum * 1.5 : 0;
    const priceEnvio = envioBool ? 25 : 0;
    const presupuesto_total = Number((priceChurros + priceChoco + priceEnvio).toFixed(2));
    if (presupuesto_total < 100) {
      return res.status(400).json({ ok: false, error: 'El presupuesto mínimo es 100 €.' });
    }
    merged.presupuesto_total = presupuesto_total;

    // Construir UPDATE con todos los campos permitidos
    const set = allowed.concat('presupuesto_total').map(k => `${k} = ?`).join(', ');
    const params = allowed.concat('presupuesto_total').map(k => merged[k]);
    params.push(id);
    const sql = `UPDATE pedidos SET ${set} WHERE id = ?`;
    const [result] = await pool.execute(sql, params);
    // Devolver el registro actualizado
    const [rows2] = await pool.execute('SELECT * FROM pedidos WHERE id = ? LIMIT 1', [id]);
    const row = rows2 && rows2[0] ? rows2[0] : null;
    res.json({ ok: true, affectedRows: result.affectedRows, data: row });
  } catch (err) {
    console.error('Error actualizando pedido:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

app.get('/admin/api/export.csv', ensureAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, nombre, telefono, email, ciudad, provincia, fecha, hora, presupuesto_total FROM pedidos ORDER BY fecha DESC, hora DESC');
    const header = 'id;nombre;telefono;email;ciudad;provincia;fecha;hora;presupuesto_total\n';
    const body = rows.map(r => [r.id, r.nombre, r.telefono, r.email || '', r.ciudad || '', r.provincia || '', r.fecha, r.hora, r.presupuesto_total].join(';')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="pedidos.csv"');
    res.send(header + body);
  } catch (err) {
    console.error('Error exportando pedidos:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

// Página de detalle del pedido (protegida)
app.get('/admin/pedido/:id', ensureAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.redirect('/admin/pedidos');
  return res.sendFile(path.join(__dirname, 'private', 'admin_pedido.html'), {
    headers: { 'Cache-Control': 'no-store' }
  });
});
app.get('/admin/pedido', ensureAdmin, (req, res) => {
  const id = req.query.id;
  if (!id) return res.redirect('/admin/pedidos');
  return res.sendFile(path.join(__dirname, 'private', 'admin_pedido.html'), {
    headers: { 'Cache-Control': 'no-store' }
  });
});

async function start() {
  try {
    pool = await mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'app_pedidos_guty',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    // Asegura el esquema necesario
    await ensureSchema();
    app.listen(PORT, () => {
      console.log(`Servidor en http://localhost:${PORT}`);
    });
  } catch (e) {
    console.error('No se pudo conectar a MySQL:', e);
    process.exit(1);
  }
}

start();

async function ensureSchema() {
  const ddlPedidos = `
    CREATE TABLE IF NOT EXISTS pedidos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(120) NOT NULL,
      telefono VARCHAR(40) NOT NULL,
      email VARCHAR(160),
      cp VARCHAR(10),
      direccion VARCHAR(200),
      ciudad VARCHAR(120),
      provincia VARCHAR(120),
      nif VARCHAR(20),
      solicita_factura TINYINT(1) NOT NULL DEFAULT 0,
      personas INT,
      churros_por_persona INT,
      chocolates INT,
      fecha DATE NOT NULL,
      hora TIME NOT NULL,
      requiere_envio TINYINT(1) NOT NULL DEFAULT 0,
      direccion_entrega VARCHAR(200),
      metodo_pago VARCHAR(30) NOT NULL,
      comentarios TEXT,
      presupuesto_total DECIMAL(10,2) NOT NULL,
      estado ENUM('Pendiente','Realizado','Cobrado','Cancelado') NOT NULL DEFAULT 'Pendiente',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  const ddlClientes = `
    CREATE TABLE IF NOT EXISTS clientes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nif VARCHAR(15),
      nombre VARCHAR(100) NOT NULL,
      telefono VARCHAR(15),
      email VARCHAR(100),
      direccion VARCHAR(255),
      ciudad VARCHAR(50),
      provincia VARCHAR(50),
      cp VARCHAR(10),
      fecha_registro TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_clientes_telefono (telefono)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  try {
    await pool.execute(ddlPedidos);
    await pool.execute(ddlClientes);
  } catch (err) {
    console.error('Error al asegurar esquema:', err);
    throw err;
  }
}
