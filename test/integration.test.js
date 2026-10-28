const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

function estadoClienteDuplicado(state, telefono) {
  return Boolean(telefono) && state.clientes.some((cliente) => cliente.telefono === telefono);
}

// Datos de un pedido que solicita factura (único caso en que se asigna Nº de factura automáticamente).
const FACTURA = { solicita_factura: true, provincia: 'Asturias', nif: '12345678Z' };

function makeDbState() {
  const state = {
    nextId: 1,
    contadores: {},
    precios: [{ precio_churro: 1.2, precio_chocolate: 1.1, precio_envio: 3.5 }],
    clientes: [],
    proveedores: [],
    libroComprasGastos: [],
    pedidos: [],
  };

  const db = {
    state,
    execute(sql, params = []) {
      const query = String(sql).trim();

      if (query.includes('SELECT precio_churro')) {
        return [[state.precios[0]]];
      }

      if (query.includes('INSERT INTO clientes')) {
        const [nif, nombre, telefono, email, direccion, ciudad, provincia, cp] = params;
        if (query.includes('ON DUPLICATE KEY UPDATE')) {
          const existing = state.clientes.find((cliente) => cliente.telefono === telefono);
          if (existing) {
            Object.assign(existing, {
              nif: nif ?? existing.nif,
              nombre: nombre ?? existing.nombre,
              telefono,
              email: email ?? existing.email,
              direccion: direccion ?? existing.direccion,
              ciudad: ciudad ?? existing.ciudad,
              provincia: provincia ?? existing.provincia,
              cp: cp ?? existing.cp,
            });
            return [{ insertId: existing.id }];
          }
        }
        if (estadoClienteDuplicado(state, telefono)) {
          const err = new Error('Duplicate entry');
          err.code = 'ER_DUP_ENTRY';
          throw err;
        }
        const row = {
          id: state.nextId++,
          nif: nif ?? null,
          nombre,
          telefono,
          email: email ?? null,
          direccion: direccion ?? null,
          ciudad: ciudad ?? null,
          provincia: provincia ?? null,
          cp: cp ?? null,
          fecha_registro: '2026-09-01',
        };
        state.clientes.push(row);
        return [{ insertId: row.id }];
      }

      if (query.includes('INSERT INTO proveedores')) {
        const [nif, nombre, telefono, email, direccion, ciudad, provincia, cp] = params;
        if (nif && state.proveedores.some((proveedor) => proveedor.nif === nif)) {
          const err = new Error('Duplicate entry');
          err.code = 'ER_DUP_ENTRY';
          throw err;
        }
        const row = {
          id: state.nextId++,
          nif: nif ?? null,
          nombre,
          telefono,
          email: email ?? null,
          direccion: direccion ?? null,
          ciudad: ciudad ?? null,
          provincia: provincia ?? null,
          cp: cp ?? null,
          fecha_registro: '2026-09-01',
        };
        state.proveedores.push(row);
        return [{ insertId: row.id }];
      }

      if (query.includes('INSERT IGNORE INTO contador_facturas')) {
        const anio = params.length ? Number(params[0]) : 0;
        if (!(anio in state.contadores)) state.contadores[anio] = 0;
        return [{ affectedRows: 1 }];
      }

      if (query.includes('SELECT ultimo FROM contador_facturas WHERE anio = 0')) {
        return [[{ ultimo: state.contadores[0] || 0 }]];
      }

      if (query.includes('SELECT ultimo FROM contador_facturas WHERE anio = ?')) {
        return [[{ ultimo: state.contadores[Number(params[0])] || 0 }]];
      }

      if (query.includes('UPDATE contador_facturas SET ultimo = ? WHERE anio = 0')) {
        state.contadores[0] = Number(params[0]);
        return [{ affectedRows: 1 }];
      }

      if (query.includes('UPDATE contador_facturas SET ultimo = ? WHERE anio = ?')) {
        state.contadores[Number(params[1])] = Number(params[0]);
        return [{ affectedRows: 1 }];
      }

      if (query.includes('SELECT COALESCE(MAX(numero), 0) AS max_num FROM pedidos WHERE anio = ?')) {
        const anio = Number(params[0]);
        const maxNum = state.pedidos.filter((item) => item.anio === anio).reduce((acc, item) => Math.max(acc, item.numero || 0), 0);
        return [[{ max_num: maxNum }]];
      }

      if (query.includes('UPDATE pedidos SET anio = ?, numero = ?, fecha_facturacion = ? WHERE id = ? AND numero IS NULL')) {
        const [anio, numero, fechaFacturacion, id] = params;
        const pedido = state.pedidos.find((item) => item.id === Number(id) && item.numero == null);
        if (!pedido) return [{ affectedRows: 0 }];
        pedido.anio = anio;
        pedido.numero = numero;
        pedido.fecha_facturacion = fechaFacturacion;
        return [{ affectedRows: 1 }];
      }

      if (query.includes(`UPDATE pedidos SET estado = 'Realizado' WHERE id = ? AND estado = 'Pendiente'`)) {
        const pedido = state.pedidos.find((item) => item.id === Number(params[0]) && item.estado === 'Pendiente');
        if (!pedido) return [{ affectedRows: 0 }];
        pedido.estado = 'Realizado';
        return [{ affectedRows: 1 }];
      }

      if (query.includes(`SELECT id FROM pedidos WHERE estado = 'Pendiente' AND TIMESTAMP(fecha, hora) <= ?`)) {
        const limite = String(params[0]);
        const vencidos = state.pedidos
          .filter((item) => item.estado === 'Pendiente' && `${item.fecha} ${item.hora}`.slice(0, 19) <= limite)
          .sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`) || a.id - b.id);
        return [vencidos.map((item) => ({ id: item.id }))];
      }

      if (query.includes('INSERT INTO pedidos')) {
        const [id, nombre, telefono, email, cp, direccion, ciudad, provincia, nif, solicita_factura, personas, churros_por_persona, chocolates, fecha, hora, requiere_envio, direccion_entrega, metodo_pago, comentarios, presupuesto_total, precio_churro, precio_chocolate, precio_envio, descuento, suplemento] = params;
        const row = {
          id,
          anio: null,
          numero: null,
          nombre,
          telefono,
          email: email ?? null,
          cp: cp ?? null,
          direccion: direccion ?? null,
          ciudad: ciudad ?? null,
          provincia: provincia ?? null,
          nif: nif ?? null,
          solicita_factura: solicita_factura ? 1 : 0,
          personas: personas ?? null,
          churros_por_persona: churros_por_persona ?? null,
          chocolates: chocolates ?? null,
          fecha,
          hora,
          requiere_envio: requiere_envio ? 1 : 0,
          direccion_entrega: direccion_entrega ?? null,
          metodo_pago,
          comentarios: comentarios ?? null,
          presupuesto_total,
          precio_churro: precio_churro ?? null,
          precio_chocolate: precio_chocolate ?? null,
          precio_envio: precio_envio ?? null,
          descuento: descuento ?? 0,
          suplemento: suplemento ?? 0,
          estado: 'Pendiente',
        };
        state.pedidos.push(row);
        return [{ insertId: row.id }];
      }

      if (query.includes('SELECT estado, anio, numero FROM pedidos WHERE id = ? LIMIT 1')) {
        const id = Number(params[0]);
        const pedido = state.pedidos.find((item) => item.id === id);
        return [pedido ? [{ estado: pedido.estado || 'Pendiente', anio: pedido.anio, numero: pedido.numero }] : []];
      }

      if (query.includes('SELECT MAX(numero) AS max_num FROM pedidos WHERE anio = ?')) {
        const anio = Number(params[0]);
        const maxNum = state.pedidos.filter((item) => item.anio === anio).reduce((acc, item) => Math.max(acc, item.numero), 0);
        return [[{ max_num: maxNum || null }]];
      }

      if (query.includes('SELECT MAX(id) AS max_id FROM pedidos')) {
        const maxId = state.pedidos.reduce((acc, item) => Math.max(acc, item.id), 0);
        return [[{ max_id: maxId || null }]];
      }

      if (query.includes('SELECT * FROM pedidos WHERE id = ? LIMIT 1')) {
        const id = Number(params[0]);
        return [state.pedidos.filter((pedido) => pedido.id === id)];
      }

      if (query.includes('SELECT id, anio, numero, nombre, telefono, email, cp, direccion, ciudad, provincia, nif, solicita_factura, personas, churros_por_persona, chocolates, fecha, hora, requiere_envio, direccion_entrega, metodo_pago, comentarios, presupuesto_total, descuento, estado, created_at')) {
        const estadoValues = ['Pendiente', 'Realizado', 'Cobrado', 'Cancelado'];
        const searchTerm = estadoValues.includes(params[0]) ? '' : String(params[0] || '').replace(/[%_]/g, '').trim();
        const estadoFilters = params.filter((p) => typeof p === 'string' && estadoValues.includes(p));
        const items = state.pedidos.filter((pedido) => {
          const hayQ = !searchTerm || [pedido.nombre, pedido.email, pedido.telefono, pedido.ciudad, pedido.provincia].some((value) => String(value || '').toLowerCase().includes(searchTerm.toLowerCase()));
          const hayEstado = estadoFilters.length === 0 || estadoFilters.includes(pedido.estado);
          return hayQ && hayEstado;
        });
        return [items.slice(0, 20)];
      }


      if (query.includes('DELETE FROM pedidos WHERE id = ?')) {
        const id = Number(params[0]);
        const before = state.pedidos.length;
        state.pedidos = state.pedidos.filter((pedido) => pedido.id !== id);
        return [{ affectedRows: before - state.pedidos.length }];
      }

      if (query.includes('UPDATE pedidos SET')) {
        const id = Number(params[params.length - 1]);
        const index = state.pedidos.findIndex((pedido) => pedido.id === id);
        if (index !== -1) {
          const current = state.pedidos[index];
          const updateKeys = [
            'nombre','telefono','email','cp','direccion','ciudad','provincia','nif','solicita_factura',
            'personas','churros_por_persona','chocolates','fecha','hora','requiere_envio','direccion_entrega',
            'metodo_pago','comentarios','estado','descuento','suplemento','presupuesto_total','precio_churro','precio_chocolate','precio_envio'
          ];
          const next = { ...current };
          for (let i = 0; i < updateKeys.length && i < params.length - 1; i += 1) {
            let value = params[i];
            if (typeof value !== 'undefined') {
              // Convertir boolean a 0/1 para solicita_factura y requiere_envio
              if ((updateKeys[i] === 'solicita_factura' || updateKeys[i] === 'requiere_envio') && typeof value === 'boolean') {
                value = value ? 1 : 0;
              }
              next[updateKeys[i]] = value;
            }
          }
          state.pedidos[index] = next;
        }
        return [{ affectedRows: 1 }];
      }

      if (query.includes('SELECT * FROM clientes WHERE id = ? LIMIT 1')) {
        const id = Number(params[0]);
        return [state.clientes.filter((cliente) => cliente.id === id)];
      }

      if (query.includes('SELECT id, nif, nombre, telefono, email, direccion, ciudad, provincia, cp, fecha_registro FROM clientes WHERE id = ? LIMIT 1')) {
        const id = Number(params[0]);
        return [state.clientes.filter((cliente) => cliente.id === id)];
      }

      if (query.includes('SELECT id FROM clientes WHERE id = ? LIMIT 1')) {
        const id = Number(params[0]);
        return [state.clientes.filter((cliente) => cliente.id === id)];
      }

      if (query.includes('DELETE FROM clientes WHERE id = ?')) {
        const id = Number(params[0]);
        state.clientes = state.clientes.filter((cliente) => cliente.id !== id);
        return [{ affectedRows: 1 }];
      }

      if (query.includes('UPDATE clientes')) {
        const [nif, nombre, telefono, email, direccion, ciudad, provincia, cp, id] = params;
        const index = state.clientes.findIndex((cliente) => cliente.id === Number(id));
        if (index !== -1) {
          state.clientes[index] = { ...state.clientes[index], nif, nombre, telefono, email, direccion, ciudad, provincia, cp };
        }
        return [{}];
      }

      if (query.includes('SELECT * FROM proveedores WHERE id = ? LIMIT 1')) {
        const id = Number(params[0]);
        return [state.proveedores.filter((proveedor) => proveedor.id === id)];
      }

      if (query.includes('SELECT id, nif, nombre, telefono, email, direccion, ciudad, provincia, cp, fecha_registro FROM proveedores WHERE id = ? LIMIT 1')) {
        const id = Number(params[0]);
        return [state.proveedores.filter((proveedor) => proveedor.id === id)];
      }

      if (query.includes('SELECT id FROM proveedores WHERE id = ? LIMIT 1')) {
        const id = Number(params[0]);
        return [state.proveedores.filter((proveedor) => proveedor.id === id)];
      }

      if (query.includes('DELETE FROM proveedores WHERE id = ?')) {
        const id = Number(params[0]);
        state.proveedores = state.proveedores.filter((proveedor) => proveedor.id !== id);
        return [{ affectedRows: 1 }];
      }

      if (query.includes('UPDATE proveedores')) {
        const [nif, nombre, telefono, email, direccion, ciudad, provincia, cp, id] = params;
        const index = state.proveedores.findIndex((proveedor) => proveedor.id === Number(id));
        if (index !== -1) {
          state.proveedores[index] = { ...state.proveedores[index], nif, nombre, telefono, email, direccion, ciudad, provincia, cp };
        }
        return [{}];
      }

      if (query.includes('UPDATE libro_compras_gastos')) {
        const [proveedorNombre, nifFinal, nifAnterior] = params;
        state.libroComprasGastos = state.libroComprasGastos.map((registro) => (
          registro.nif_cif === nifAnterior
            ? { ...registro, proveedor: proveedorNombre, nif_cif: nifFinal }
            : registro
        ));
        return [{}];
      }

      if (query.includes('UPDATE precios SET')) {
        state.precios[0] = {
          precio_churro: Number(params[0]),
          precio_chocolate: Number(params[1]),
          precio_envio: Number(params[2]),
        };
        return [[]];
      }

      return [[]];
    },
    getConnection() {
      return {
        beginTransaction: async () => {},
        execute: async (sql, params = []) => db.execute(sql, params),
        commit: async () => {},
        rollback: async () => {},
        release: () => {},
      };
    },
  };

  return db;
}

function loadAppWithDb(db) {
  delete require.cache[require.resolve('../server')];
  global.pool = db;
  const { app } = require('../server');
  return app;
}

// Simula que el pedido ha vencido: el barrido lo pasa a Realizado y le asigna su Nº de factura.
async function vencer(db, id) {
  const pedido = db.state.pedidos.find((p) => p.id === id);
  pedido.fecha = '2000-01-01';
  const { marcarPedidosVencidos } = require('../server');
  await marcarPedidosVencidos();
}

test('GET /health responde OK', async () => {
  const app = loadAppWithDb(makeDbState());
  const res = await request(app).get('/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});

test('GET /admin/ventas/graficos requiere sesión y se abre desde ventas', async () => {
  const app = loadAppWithDb(makeDbState());
  const sinSesion = await request(app).get('/admin/ventas/graficos');
  assert.equal(sinSesion.status, 401);

  const agent = request.agent(app);
  await agent.post('/admin/login').send({ username: 'admin', password: 'admin123' });

  const ventas = await agent.get('/admin/ventas');
  assert.equal(ventas.status, 200);
  assert.match(ventas.text, /graficosBtn/);
  assert.match(ventas.text, /\/admin\/ventas\/graficos/);

  const graficos = await agent.get('/admin/ventas/graficos');
  assert.equal(graficos.status, 200);
  assert.match(graficos.text, /Caja diaria/);

  const utilidad = await agent.get('/admin/assets/graficos-ventas.js');
  assert.equal(utilidad.status, 200);
  assert.match(utilidad.text, /obtenerTotalesMensuales/);
});

test('El script de factura se sirve solo a admin y lo cargan Pedidos e Historial', async () => {
  const app = loadAppWithDb(makeDbState());

  const sinSesion = await request(app).get('/admin/assets/factura-pedido.js');
  assert.equal(sinSesion.status, 401);

  const agent = request.agent(app);
  await agent.post('/admin/login').send({ username: 'admin', password: 'admin123' });

  const script = await agent.get('/admin/assets/factura-pedido.js');
  assert.equal(script.status, 200);
  assert.match(script.text, /async function downloadFacturaPdf/);
  assert.doesNotMatch(script.text, /`Teléfono: \$\{pedido\.telefono \|\| '-'\}`/);
  assert.doesNotMatch(script.text, /`Email: \$\{pedido\.email \|\| '-'\}`/);

  for (const ruta of ['/admin/pedidos', '/admin/historial-pedidos']) {
    const pagina = await agent.get(ruta);
    assert.equal(pagina.status, 200, ruta);
    assert.match(pagina.text, /\/admin\/assets\/factura-pedido\.js/, ruta);
    assert.match(pagina.text, /class="factura"/, ruta);
  }

  const historial = await agent.get('/admin/historial-pedidos');
  assert.doesNotMatch(historial.text, /class="del"/);
});

test('POST /admin/login acepta credenciales válidas', async () => {
  const app = loadAppWithDb(makeDbState());
  const res = await request(app)
    .post('/admin/login')
    .send({ username: 'admin', password: 'admin123' });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});

test('POST /api/pedidos crea un pedido válido', async () => {
  const app = loadAppWithDb(makeDbState());
  const res = await request(app)
    .post('/api/pedidos')
    .send({
      nombre: 'Ana García',
      telefono: '612345678',
      email: 'ana@ejemplo.com',
      cp: '28001',
      direccion: 'Calle Mayor 1',
      ciudad: 'Madrid',
      provincia: 'Madrid',
      nif: '12345678Z',
      solicita_factura: false,
      personas: 10,
      churros_por_persona: 12,
      chocolates: 0,
      fecha: '2026-09-01',
      hora: '18:00',
      requiere_envio: false,
      metodo_pago: 'efectivo',
      comentarios: 'Sin comentarios',
      descuento: 0,
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.ok, true);
  assert.ok(Number.isInteger(res.body.id));
  assert.ok(res.body.presupuesto_total > 100);
});

test('CRUD de clientes en /admin/api/clientes', async () => {
  const app = loadAppWithDb(makeDbState());
  const agent = request.agent(app);

  await agent.post('/admin/login').send({ username: 'admin', password: 'admin123' });

  const createRes = await agent.post('/admin/api/clientes').send({
    nif: '12345678Z',
    nombre: 'María López',
    telefono: '612345678',
    email: 'maria@ejemplo.com',
    direccion: 'Avenida 2',
    ciudad: 'Sevilla',
    provincia: 'Sevilla',
    cp: '41001',
  });

  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.ok, true);
  const id = createRes.body.data.id;

  const updateRes = await agent.put(`/admin/api/clientes/${id}`).send({
    nombre: 'María López Romero',
    telefono: '612345679',
    email: 'maria.nueva@ejemplo.com',
  });

  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.ok, true);
  assert.equal(updateRes.body.data.nombre, 'María López Romero');

  const deleteRes = await agent.delete(`/admin/api/clientes/${id}`);
  assert.equal(deleteRes.status, 200);
  assert.equal(deleteRes.body.ok, true);
});

test('CRUD de proveedores en /admin/api/proveedores', async () => {
  const app = loadAppWithDb(makeDbState());
  const agent = request.agent(app);

  await agent.post('/admin/login').send({ username: 'admin', password: 'admin123' });

  const createRes = await agent.post('/admin/api/proveedores').send({
    nif: 'B12345678',
    nombre: 'Proveedor Central',
    telefono: '678123456',
    email: 'proveedor@ejemplo.com',
    direccion: 'Calle Fábrica 8',
    ciudad: 'Valencia',
    provincia: 'Valencia',
    cp: '46001',
  });

  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.ok, true);
  const id = createRes.body.data.id;

  const updateRes = await agent.put(`/admin/api/proveedores/${id}`).send({
    nombre: 'Proveedor Central SL',
    telefono: '678123457',
    email: 'nuevo@ejemplo.com',
  });

  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.ok, true);
  assert.equal(updateRes.body.data.nombre, 'Proveedor Central SL');

  const deleteRes = await agent.delete(`/admin/api/proveedores/${id}`);
  assert.equal(deleteRes.status, 200);
  assert.equal(deleteRes.body.ok, true);
});

test('editar proveedor sincroniza nombre y nif en libro de gastos', async () => {
  const db = makeDbState();
  const proveedorId = db.state.nextId++;
  db.state.proveedores.push({
    id: proveedorId,
    nif: 'B12345678',
    nombre: 'Proveedor Central',
    telefono: '678123456',
    email: 'proveedor@ejemplo.com',
    direccion: 'Calle Fábrica 8',
    ciudad: 'Valencia',
    provincia: 'Valencia',
    cp: '46001',
    fecha_registro: '2026-09-01',
  });
  db.state.libroComprasGastos.push({
    id: db.state.nextId++,
    proveedor: 'Proveedor Central',
    nif_cif: 'B12345678',
  });

  const app = loadAppWithDb(db);
  const agent = request.agent(app);

  await agent.post('/admin/login').send({ username: 'admin', password: 'admin123' });

  const updateRes = await agent.put(`/admin/api/proveedores/${proveedorId}`).send({
    nif: 'B87654321',
    nombre: 'Proveedor Central Renovado',
    telefono: '678123457',
    email: 'nuevo@ejemplo.com',
  });

  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.ok, true);
  assert.equal(db.state.libroComprasGastos[0].proveedor, 'Proveedor Central Renovado');
  assert.equal(db.state.libroComprasGastos[0].nif_cif, 'B87654321');
});

test('validaciones de admin/api rechazan datos inválidos', async () => {
  const app = loadAppWithDb(makeDbState());
  const agent = request.agent(app);

  await agent.post('/admin/login').send({ username: 'admin', password: 'admin123' });

  const invalidCliente = await agent.post('/admin/api/clientes').send({
    nombre: '',
    telefono: '123',
    email: 'mal',
  });
  assert.equal(invalidCliente.status, 400);
  assert.equal(invalidCliente.body.ok, false);

  const invalidProveedor = await agent.post('/admin/api/proveedores').send({
    nif: '123',
    nombre: 'Proveedor',
    telefono: '612345678',
    email: 'mal',
  });
  assert.equal(invalidProveedor.status, 400);
  assert.equal(invalidProveedor.body.ok, false);

  const invalidPrecios = await agent.put('/admin/api/precios').send({
    churro: '-1',
    chocolate: '1.2',
    envio: '3.5',
  });
  assert.equal(invalidPrecios.status, 400);
  assert.equal(invalidPrecios.body.ok, false);
});

test('DELETE /admin/api/pedidos/:id solo permite borrar con estado Cancelado', async () => {
  const app = loadAppWithDb(makeDbState());
  const agent = request.agent(app);

  await agent.post('/admin/login').send({ username: 'admin', password: 'admin123' });

  const created = await request(app)
    .post('/api/pedidos')
    .send({
      nombre: 'Ana García',
      telefono: '612345678',
      fecha: '2026-09-01',
      hora: '18:00',
      metodo_pago: 'efectivo',
      personas: 10,
      churros_por_persona: 12,
      chocolates: 0,
    });

  const db = makeDbState();
  const app2 = loadAppWithDb(db);
  const agent2 = request.agent(app2);
  await agent2.post('/admin/login').send({ username: 'admin', password: 'admin123' });
  const base = {
    nombre: 'Ana García', telefono: '612345678', fecha: '2099-01-01', hora: '18:00',
    metodo_pago: 'efectivo', personas: 10, churros_por_persona: 12, chocolates: 0,
  };
  const p1 = await request(app2).post('/api/pedidos').send(base);
  const p2 = await request(app2).post('/api/pedidos').send(base);
  await vencer(db, p2.body.id);
  const realizadoDelete = await agent2.delete(`/admin/api/pedidos/${p2.body.id}`);
  assert.equal(realizadoDelete.status, 400);
  assert.match(realizadoDelete.body.error, /Pendiente o Cancelado/);
  const pendienteDelete = await agent2.delete(`/admin/api/pedidos/${p1.body.id}`);
  assert.equal(pendienteDelete.status, 200);

  const pendingDelete = await agent.delete(`/admin/api/pedidos/${created.body.id}`);
  assert.equal(pendingDelete.status, 200);
  assert.equal(pendingDelete.body.ok, true);
});

test('DELETE /admin/api/pedidos/:id no permite borrar pedidos con Nº de factura', async () => {
  const db = makeDbState();
  const app = loadAppWithDb(db);
  const agent = request.agent(app);

  await agent.post('/admin/login').send({ username: 'admin', password: 'admin123' });

  const payload = {
    ...FACTURA,
    nombre: 'Ana García',
    telefono: '612345678',
    fecha: '2026-09-01',
    hora: '18:00',
    metodo_pago: 'efectivo',
    personas: 10,
    churros_por_persona: 12,
    chocolates: 0,
  };
  const first = await request(app).post('/api/pedidos').send(payload);
  const second = await request(app).post('/api/pedidos').send(payload);

  await vencer(db, first.body.id);
  await vencer(db, second.body.id);
  await agent.put(`/admin/api/pedidos/${first.body.id}`).send({ estado: 'Cancelado' });
  await agent.put(`/admin/api/pedidos/${second.body.id}`).send({ estado: 'Cancelado' });

  const notLast = await agent.delete(`/admin/api/pedidos/${first.body.id}`);
  assert.equal(notLast.status, 400);
  assert.match(notLast.body.error, /Nº de factura/i);

  const last = await agent.delete(`/admin/api/pedidos/${second.body.id}`);
  assert.equal(last.status, 400);
});

test('el Nº de factura se asigna al pasar a Realizado/Cobrado, correlativo por año en curso', async () => {
  const db = makeDbState();
  const app = loadAppWithDb(db);
  const agent = request.agent(app);

  await agent.post('/admin/login').send({ username: 'admin', password: 'admin123' });

  const base = {
    ...FACTURA,
    nombre: 'Ana García',
    telefono: '612345678',
    hora: '18:00',
    metodo_pago: 'efectivo',
    personas: 10,
    churros_por_persona: 12,
    chocolates: 0,
  };
  const a = await request(app).post('/api/pedidos').send({ ...base, fecha: '2099-12-30' });
  const b = await request(app).post('/api/pedidos').send({ ...base, fecha: '2099-12-31' });
  const c = await request(app).post('/api/pedidos').send({ ...base, fecha: '2099-12-31' });

  // Un pedido nuevo no tiene Nº de factura.
  assert.equal(a.body.num_factura, undefined);
  assert.equal(new Set([a, b, c].map((r) => r.body.id)).size, 3);
  assert.equal(db.state.pedidos.every((p) => p.numero === null && p.anio === null), true);

  const anioActual = 2000; // `vencer` fija la fecha del pedido en 2000: el año sale de la fecha del pedido
  const putB = await vencer(db, b.body.id);
  assert.equal(db.state.pedidos.find((p) => p.id === b.body.id).numero, 1);
  const putA = await vencer(db, a.body.id);
  assert.equal(db.state.pedidos.find((p) => p.id === a.body.id).numero, 2);
  assert.equal(db.state.pedidos.find((p) => p.id === a.body.id).anio, anioActual);
  const pendienteARealizado = await agent.put(`/admin/api/pedidos/${c.body.id}`).send({ estado: 'Realizado' });
  assert.equal(pendienteARealizado.status, 400);
  assert.match(pendienteARealizado.body.error, /solo puede pasar a Cancelado/);

  // Cambiar de Realizado a Cobrado no cambia el número ya asignado.
  const putB2 = await agent.put(`/admin/api/pedidos/${b.body.id}`).send({ estado: 'Cobrado' });
  assert.equal(putB2.body.data.num_factura, `1/${anioActual}`);

  // Cancelar un pedido pendiente no le asigna número y se puede borrar libremente.
  await agent.put(`/admin/api/pedidos/${c.body.id}`).send({ estado: 'Cancelado' });
  const borradoSinNumero = await agent.delete(`/admin/api/pedidos/${c.body.id}`);
  assert.equal(borradoSinNumero.status, 200);

  // Un pedido con número no se puede borrar nunca.
  await agent.put(`/admin/api/pedidos/${b.body.id}`).send({ estado: 'Cancelado' });
  const noUltimoDelAnio = await agent.delete(`/admin/api/pedidos/${b.body.id}`);
  assert.equal(noUltimoDelAnio.status, 400);
});

test('marcarPedidosVencidos pasa a Realizado los pendientes vencidos y les asigna número correlativo', async () => {
  const db = makeDbState();
  const app = loadAppWithDb(db);
  const { marcarPedidosVencidos } = require('../server');

  const base = {
    ...FACTURA,
    nombre: 'Ana García',
    telefono: '612345678',
    hora: '18:00',
    metodo_pago: 'efectivo',
    personas: 10,
    churros_por_persona: 12,
    chocolates: 0,
  };
  const tarde = await request(app).post('/api/pedidos').send({ ...base, fecha: '2020-01-02' });
  const temprano = await request(app).post('/api/pedidos').send({ ...base, fecha: '2020-01-01' });
  const futuro = await request(app).post('/api/pedidos').send({ ...base, fecha: '2099-01-01' });

  const ahora = new Date(2026, 5, 15, 12, 0, 0);
  const n = await marcarPedidosVencidos(ahora);
  assert.equal(n, 2);

  const porId = (id) => db.state.pedidos.find((p) => p.id === id);
  assert.deepEqual([porId(temprano.body.id).estado, porId(temprano.body.id).anio, porId(temprano.body.id).numero], ['Realizado', 2020, 1]);
  assert.deepEqual([porId(tarde.body.id).estado, porId(tarde.body.id).anio, porId(tarde.body.id).numero], ['Realizado', 2020, 2]);
  assert.deepEqual([porId(futuro.body.id).estado, porId(futuro.body.id).numero], ['Pendiente', null]);

  // Una segunda pasada no repite ni renumera.
  assert.equal(await marcarPedidosVencidos(ahora), 0);
});

test('un pedido Realizado no puede volver a Pendiente, solo pasar a Cobrado o Cancelado', async () => {
  const db = makeDbState();
  const app = loadAppWithDb(db);
  const agent = request.agent(app);
  await agent.post('/admin/login').send({ username: 'admin', password: 'admin123' });

  const created = await request(app).post('/api/pedidos').send({
    ...FACTURA,
    nombre: 'Ana García',
    telefono: '612345678',
    fecha: '2099-01-01',
    hora: '18:00',
    metodo_pago: 'efectivo',
    personas: 10,
    churros_por_persona: 12,
    chocolates: 0,
  });
  const id = created.body.id;

  await vencer(db, id);
  const vuelta = await agent.put(`/admin/api/pedidos/${id}`).send({ estado: 'Pendiente' });
  assert.equal(vuelta.status, 400);
  assert.match(vuelta.body.error, /Cobrado o Cancelado/);

  const cancelar = await agent.put(`/admin/api/pedidos/${id}`).send({ estado: 'Cancelado' });
  assert.equal(cancelar.status, 200);
  assert.equal(cancelar.body.data.estado, 'Cancelado');
  assert.ok(cancelar.body.data.num_factura);

  const otro = await request(app).post('/api/pedidos').send({
    ...FACTURA,
    nombre: 'Ana García',
    telefono: '612345678',
    fecha: '2099-01-01',
    hora: '18:00',
    metodo_pago: 'efectivo',
    personas: 10,
    churros_por_persona: 12,
    chocolates: 0,
  });
  await vencer(db, otro.body.id);
  const cobrar = await agent.put(`/admin/api/pedidos/${otro.body.id}`).send({ estado: 'Cobrado' });
  assert.equal(cobrar.status, 200);
});

test('un pedido Cancelado vuelve a Pendiente si no ha vencido, o a Realizado con su mismo Nº si ya venció', async () => {
  const db = makeDbState();
  const app = loadAppWithDb(db);
  const agent = request.agent(app);
  await agent.post('/admin/login').send({ username: 'admin', password: 'admin123' });
  const base = {
    ...FACTURA,
    nombre: 'Ana García',
    telefono: '612345678',
    fecha: '2099-01-01',
    hora: '18:00',
    metodo_pago: 'efectivo',
    personas: 10,
    churros_por_persona: 12,
    chocolates: 0,
  };

  const futuro = await request(app).post('/api/pedidos').send(base);
  await agent.put(`/admin/api/pedidos/${futuro.body.id}`).send({ estado: 'Cancelado' });
  const aRealizado = await agent.put(`/admin/api/pedidos/${futuro.body.id}`).send({ estado: 'Realizado' });
  assert.equal(aRealizado.status, 400);
  const aPendiente = await agent.put(`/admin/api/pedidos/${futuro.body.id}`).send({ estado: 'Pendiente' });
  assert.equal(aPendiente.status, 200);
  assert.equal(aPendiente.body.data.estado, 'Pendiente');

  const vencido = await request(app).post('/api/pedidos').send(base);
  await vencer(db, vencido.body.id);
  const numero = db.state.pedidos.find((p) => p.id === vencido.body.id).numero;
  assert.ok(numero);
  await agent.put(`/admin/api/pedidos/${vencido.body.id}`).send({ estado: 'Cancelado' });
  const aPend = await agent.put(`/admin/api/pedidos/${vencido.body.id}`).send({ estado: 'Pendiente' });
  assert.equal(aPend.status, 400);
  const aCobrado = await agent.put(`/admin/api/pedidos/${vencido.body.id}`).send({ estado: 'Cobrado' });
  assert.equal(aCobrado.status, 400);
  const vuelve = await agent.put(`/admin/api/pedidos/${vencido.body.id}`).send({ estado: 'Realizado' });
  assert.equal(vuelve.status, 200);
  assert.equal(db.state.pedidos.find((p) => p.id === vencido.body.id).numero, numero);
});

test('un pedido Cobrado solo puede pasar a Realizado o Cancelado, con el mismo Nº', async () => {
  const db = makeDbState();
  const app = loadAppWithDb(db);
  const agent = request.agent(app);
  await agent.post('/admin/login').send({ username: 'admin', password: 'admin123' });
  const c = await request(app).post('/api/pedidos').send({
    ...FACTURA,
    nombre: 'Ana García', telefono: '612345678', fecha: '2099-01-01', hora: '18:00',
    metodo_pago: 'efectivo', personas: 10, churros_por_persona: 12, chocolates: 0,
  });
  await vencer(db, c.body.id);
  await agent.put(`/admin/api/pedidos/${c.body.id}`).send({ estado: 'Cobrado' });
  const numero = db.state.pedidos.find((p) => p.id === c.body.id).numero;

  const aPend = await agent.put(`/admin/api/pedidos/${c.body.id}`).send({ estado: 'Pendiente' });
  assert.equal(aPend.status, 400);
  const aReal = await agent.put(`/admin/api/pedidos/${c.body.id}`).send({ estado: 'Realizado' });
  assert.equal(aReal.status, 200);
  await agent.put(`/admin/api/pedidos/${c.body.id}`).send({ estado: 'Cobrado' });
  const aCanc = await agent.put(`/admin/api/pedidos/${c.body.id}`).send({ estado: 'Cancelado' });
  assert.equal(aCanc.status, 200);
  assert.equal(db.state.pedidos.find((p) => p.id === c.body.id).numero, numero);
});

test('no se puede cambiar fecha/hora de un pedido con Nº de factura o vencido', async () => {
  const db = makeDbState();
  const app = loadAppWithDb(db);
  const agent = request.agent(app);
  await agent.post('/admin/login').send({ username: 'admin', password: 'admin123' });
  const c = await request(app).post('/api/pedidos').send({
    nombre: 'Ana García', telefono: '612345678', fecha: '2099-01-01', hora: '18:00',
    metodo_pago: 'efectivo', personas: 10, churros_por_persona: 12, chocolates: 0,
  });
  const ok = await agent.put(`/admin/api/pedidos/${c.body.id}`).send({ fecha: '2099-02-01', hora: '19:00' });
  assert.equal(ok.status, 200);
  await vencer(db, c.body.id);
  const mal = await agent.put(`/admin/api/pedidos/${c.body.id}`).send({ fecha: '2099-03-01' });
  assert.equal(mal.status, 400);
  assert.match(mal.body.error, /fecha ni la hora/);
  const igual = await agent.put(`/admin/api/pedidos/${c.body.id}`).send({ fecha: '2000-01-01', hora: '19:00', nombre: 'Otro' });
  assert.equal(igual.status, 200);
});

test('un pedido Cancelado vencido sin Nº de factura no puede pasar a Realizado, solo eliminarse', async () => {
  const db = makeDbState();
  const app = loadAppWithDb(db);
  const agent = request.agent(app);
  await agent.post('/admin/login').send({ username: 'admin', password: 'admin123' });
  const c = await request(app).post('/api/pedidos').send({
    nombre: 'Ana García', telefono: '612345678', fecha: '2099-01-01', hora: '18:00',
    metodo_pago: 'efectivo', personas: 10, churros_por_persona: 12, chocolates: 0,
  });
  await agent.put(`/admin/api/pedidos/${c.body.id}`).send({ estado: 'Cancelado' });
  db.state.pedidos.find((p) => p.id === c.body.id).fecha = '2000-01-01';
  const aReal = await agent.put(`/admin/api/pedidos/${c.body.id}`).send({ estado: 'Realizado' });
  assert.equal(aReal.status, 400);
  assert.equal(db.state.pedidos.find((p) => p.id === c.body.id).numero, null);
  const del = await agent.delete(`/admin/api/pedidos/${c.body.id}`);
  assert.equal(del.status, 200);
});

test('un pedido que no solicita factura no se numera; el botón Factura la genera a posteriori con fecha de facturación', async () => {
  const db = makeDbState();
  const app = loadAppWithDb(db);
  const agent = request.agent(app);
  await agent.post('/admin/login').send({ username: 'admin', password: 'admin123' });
  const base = {
    nombre: 'Ana García', telefono: '612345678', fecha: '2099-01-01', hora: '18:00',
    metodo_pago: 'efectivo', personas: 10, churros_por_persona: 12, chocolates: 0,
  };
  const porId = (id) => db.state.pedidos.find((p) => p.id === id);

  const conFactura = await request(app).post('/api/pedidos').send({ ...base, ...FACTURA });
  const sinFactura = await request(app).post('/api/pedidos').send(base);
  const idSin = sinFactura.body.id;

  // Un pedido Pendiente no admite factura a posteriori.
  const pendiente = await agent.post(`/admin/api/pedidos/${idSin}/factura`);
  assert.equal(pendiente.status, 400);

  // Al vencer, solo el que solicita factura recibe número.
  await vencer(db, idSin);
  await vencer(db, conFactura.body.id);
  assert.equal(porId(conFactura.body.id).numero, 1);
  assert.equal(porId(idSin).estado, 'Realizado');
  assert.equal(porId(idSin).numero, null);
  assert.equal(porId(conFactura.body.id).fecha_facturacion ?? null, null);

  // Pasar a Cobrado tampoco lo numera.
  await agent.put(`/admin/api/pedidos/${idSin}`).send({ estado: 'Cobrado' });
  assert.equal(porId(idSin).numero, null);

  // Sin marcar "solicita factura" no se puede generar.
  const sinCheck = await agent.post(`/admin/api/pedidos/${idSin}/factura`);
  assert.equal(sinCheck.status, 400);
  assert.match(sinCheck.body.error, /Solicita factura/);

  // Marcar el check y guardar los datos tampoco la numera: hace falta el botón Factura.
  const sinDatos = await agent.put(`/admin/api/pedidos/${idSin}`).send({ solicita_factura: true });
  assert.equal(sinDatos.status, 400);
  const conDatos = await agent.put(`/admin/api/pedidos/${idSin}`).send({ solicita_factura: true, provincia: 'Asturias', nif: '12345678Z' });
  assert.equal(conDatos.status, 200);
  assert.equal(porId(idSin).numero, null);

  const generada = await agent.post(`/admin/api/pedidos/${idSin}/factura`);
  assert.equal(generada.status, 200);
  const anioActual = new Date().getFullYear();
  // La serie es la del año de facturación (el pedido con factura automática es de otro año).
  assert.equal(generada.body.data.num_factura, `1/${anioActual}`);
  assert.equal(porId(idSin).anio, anioActual);
  assert.match(String(porId(idSin).fecha_facturacion), /^\d{4}-\d{2}-\d{2}$/);

  // Repetir no consume otro número.
  const repetida = await agent.post(`/admin/api/pedidos/${idSin}/factura`);
  assert.equal(repetida.status, 200);
  assert.equal(porId(idSin).numero, 1);
  assert.equal(db.state.contadores[anioActual], 1);

  // Una vez numerada no se puede eliminar, solo cancelar.
  await agent.put(`/admin/api/pedidos/${idSin}`).send({ estado: 'Cancelado' });
  const borrar = await agent.delete(`/admin/api/pedidos/${idSin}`);
  assert.equal(borrar.status, 400);
});

test('GET /admin/api/pedidos soporta búsqueda y paginación', async () => {
  const app = loadAppWithDb(makeDbState());
  const agent = request.agent(app);

  await agent.post('/admin/login').send({ username: 'admin', password: 'admin123' });

  await request(app).post('/api/pedidos').send({
    nombre: 'Ana García',
    telefono: '612345678',
    fecha: '2026-09-01',
    hora: '18:00',
    metodo_pago: 'efectivo',
    personas: 10,
    churros_por_persona: 12,
    chocolates: 0,
  });
  await request(app).post('/api/pedidos').send({
    nombre: 'Marta López',
    telefono: '698765432',
    fecha: '2026-09-02',
    hora: '19:00',
    metodo_pago: 'tarjeta',
    personas: 8,
    churros_por_persona: 12,
    chocolates: 0,
  });
  await request(app).post('/api/pedidos').send({
    nombre: 'Luis Peña',
    telefono: '665544332',
    fecha: '2026-09-03',
    hora: '20:00',
    metodo_pago: 'efectivo',
    personas: 6,
    churros_por_persona: 12,
    chocolates: 0,
  });

  const searchRes = await agent.get('/admin/api/pedidos?q=Ana&page=1&pageSize=10');
  assert.equal(searchRes.status, 200);
  assert.ok(searchRes.body.data.some((pedido) => pedido.nombre.includes('Ana')));

  const paginatedRes = await agent.get('/admin/api/pedidos?page=1&pageSize=2');
  assert.equal(paginatedRes.status, 200);
  assert.equal(paginatedRes.body.data.length, 2);

  const secondPage = await agent.get('/admin/api/pedidos?page=2&pageSize=2');
  assert.equal(secondPage.status, 200);
  assert.ok(secondPage.body.data.length >= 1);
});

test('POST /admin/logout termina la sesión y bloquea rutas protegidas', async () => {
  const app = loadAppWithDb(makeDbState());
  const agent = request.agent(app);

  const login = await agent.post('/admin/login').send({ username: 'admin', password: 'admin123' });
  assert.equal(login.status, 200);

  const beforeLogout = await agent.get('/admin/api/clientes');
  assert.equal(beforeLogout.status, 200);

  const logout = await agent.post('/admin/logout');
  assert.equal(logout.status, 200);

  const afterLogout = await agent.get('/admin/api/clientes');
  assert.equal(afterLogout.status, 401);
  assert.equal(afterLogout.body.ok, false);
});

test('GET /admin/api/clientes sin sesión responde 401', async () => {
  const app = loadAppWithDb(makeDbState());
  const res = await request(app).get('/admin/api/clientes');

  assert.equal(res.status, 401);
  assert.equal(res.body.ok, false);
});

test('POST /api/pedidos rechaza condiciones de negocio inválidas', async () => {
  const app = loadAppWithDb(makeDbState());

  const invalidBudget = await request(app)
    .post('/api/pedidos')
    .send({
      nombre: 'Ana García',
      telefono: '612345678',
      fecha: '2026-09-01',
      hora: '18:00',
      metodo_pago: 'efectivo',
      personas: 1,
      churros_por_persona: 4,
    });
  assert.equal(invalidBudget.status, 400);
  assert.match(invalidBudget.body.error, /presupuesto/i);

  const invalidFactura = await request(app)
    .post('/api/pedidos')
    .send({
      nombre: 'Ana García',
      telefono: '612345678',
      fecha: '2026-09-01',
      hora: '18:00',
      metodo_pago: 'tarjeta',
      solicita_factura: true,
      provincia: '',
      nif: '',
      personas: 10,
      churros_por_persona: 12,
    });
  assert.equal(invalidFactura.status, 400);
  assert.match(invalidFactura.body.error, /factura/i);
});

test('admin/api/clientes y proveedores rechazan duplicados', async () => {
  const app = loadAppWithDb(makeDbState());
  const agent = request.agent(app);
  await agent.post('/admin/login').send({ username: 'admin', password: 'admin123' });

  await agent.post('/admin/api/clientes').send({
    nif: '12345678Z',
    nombre: 'Cliente Duplicado',
    telefono: '612345678',
    email: 'cliente@ejemplo.com',
  });

  const duplicateCliente = await agent.post('/admin/api/clientes').send({
    nif: '87654321A',
    nombre: 'Otro Cliente',
    telefono: '612345678',
    email: 'otro@ejemplo.com',
  });
  assert.equal(duplicateCliente.status, 400);
  assert.equal(duplicateCliente.body.ok, false);

  await agent.post('/admin/api/proveedores').send({
    nif: 'B12345678',
    nombre: 'Proveedor Duplicado',
    telefono: '678123456',
    email: 'prov@ejemplo.com',
  });

  const duplicateProveedor = await agent.post('/admin/api/proveedores').send({
    nif: 'B12345678',
    nombre: 'Otro Proveedor',
    telefono: '678123457',
    email: 'prov2@ejemplo.com',
  });
  assert.equal(duplicateProveedor.status, 400);
  assert.equal(duplicateProveedor.body.ok, false);
});

test('PUT /admin/api/precios acepta valores válidos y rechaza negativos', async () => {
  const app = loadAppWithDb(makeDbState());
  const agent = request.agent(app);
  await agent.post('/admin/login').send({ username: 'admin', password: 'admin123' });

  const validUpdate = await agent.put('/admin/api/precios').send({
    churro: '1.5',
    chocolate: '2.0',
    envio: '4.0',
  });
  assert.equal(validUpdate.status, 200);
  assert.equal(validUpdate.body.ok, true);
  assert.equal(validUpdate.body.precios.churro, 1.5);

  const invalidUpdate = await agent.put('/admin/api/precios').send({
    churro: '-1',
    chocolate: '2.0',
    envio: '4.0',
  });
  assert.equal(invalidUpdate.status, 400);
  assert.equal(invalidUpdate.body.ok, false);
});

test('Un pedido nuevo usa los precios actualizados, tanto para cliente público como para admin', async () => {
  const app = loadAppWithDb(makeDbState());
  const agent = request.agent(app);
  await agent.post('/admin/login').send({ username: 'admin', password: 'admin123' });

  await agent.put('/admin/api/precios').send({
    churro: '2.0',
    chocolate: '1.5',
    envio: '5.0',
  });

  // Pedido público: 12 personas x 4 churros x 2.0 = 96, + envío 5.0 = 101 (min. 100€ para público)
  const pedidoPublico = await request(app).post('/api/pedidos').send({
    nombre: 'Cliente Publico Precios',
    telefono: '611222333',
    personas: 12,
    churros_por_persona: 4,
    chocolates: 0,
    fecha: '2026-09-10',
    hora: '17:00',
    requiere_envio: true,
    direccion_entrega: 'Calle Nueva 5',
    metodo_pago: 'efectivo',
  });
  assert.equal(pedidoPublico.status, 201);
  assert.equal(pedidoPublico.body.presupuesto_total, 101);

  // Pedido admin: 5 personas x 3 churros x 2.0 = 30, + 1 chocolate x 1.5 = 1.5, sin envío
  const pedidoAdmin = await agent.post('/api/pedidos').send({
    nombre: 'Cliente Admin Precios',
    telefono: '622333444',
    personas: 5,
    churros_por_persona: 3,
    chocolates: 1,
    fecha: '2026-09-11',
    hora: '18:00',
    requiere_envio: false,
    metodo_pago: 'efectivo',
  });
  assert.equal(pedidoAdmin.status, 201);
  assert.equal(pedidoAdmin.body.presupuesto_total, 31.5);
});

test('Un cambio de precios no afecta a pedidos ya creados (respetan el precio antiguo)', async () => {
  const app = loadAppWithDb(makeDbState());
  const agent = request.agent(app);
  await agent.post('/admin/login').send({ username: 'admin', password: 'admin123' });

  // Precios iniciales: churro=1.2, chocolate=1.1, envio=3.5 (ver makeDbState)
  // 12 personas x 4 churros x 1.2 = 57.6, + envío 3.5 = 61.1
  const pedidoAntiguo = await agent.post('/api/pedidos').send({
    nombre: 'Cliente Precio Antiguo',
    telefono: '633444555',
    personas: 12,
    churros_por_persona: 4,
    chocolates: 0,
    fecha: '2026-09-12',
    hora: '17:00',
    requiere_envio: true,
    direccion_entrega: 'Calle Vieja 1',
    metodo_pago: 'efectivo',
  });
  assert.equal(pedidoAntiguo.status, 201);
  assert.equal(pedidoAntiguo.body.presupuesto_total, 61.1);
  const pedidoId = pedidoAntiguo.body.id;

  await agent.put('/admin/api/precios').send({
    churro: '10',
    chocolate: '10',
    envio: '50',
  });

  const detalle = await agent.get(`/admin/api/pedidos/${pedidoId}`);
  assert.equal(detalle.body.data.presupuesto_total, 61.1, 'El presupuesto no debe recalcularse con los nuevos precios');
  assert.equal(detalle.body.data.precio_churro, 1.2, 'Debe conservar el precio de churro con el que se creó');
  assert.equal(detalle.body.data.precio_envio, 3.5, 'Debe conservar el precio de envío con el que se creó');
});

test('Pedido con estado Cobrado aparece en historial', async () => {
  const db = makeDbState();
  const app = loadAppWithDb(db);
  const agent = request.agent(app);

  await agent.post('/admin/login').send({ username: 'admin', password: 'admin123' });

  const created = await request(app).post('/api/pedidos').send({
    nombre: 'Cliente Historial',
    telefono: '612345678',
    fecha: '2026-09-01',
    hora: '18:00',
    metodo_pago: 'tarjeta',
    personas: 10,
    churros_por_persona: 12,
    chocolates: 0,
  });

  assert.equal(created.status, 201);
  const pedidoId = created.body.id;

  // Listar todos los pedidos (sin filtro de estado)
  const allRes = await agent.get('/admin/api/pedidos');
  assert.ok(allRes.body.data.some((p) => p.id === pedidoId && p.estado === 'Pendiente'), 'Pedido debe estar con estado Pendiente');

  // Cambiar a Cobrado (antes pasa a Realizado al vencer)
  await vencer(db, pedidoId);
  const updateRes = await agent.put(`/admin/api/pedidos/${pedidoId}`).send({ estado: 'Cobrado' });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.ok, true);

  // Listar nuevamente para ver el estado actualizado (después de refrescar)
  const afterRes = await agent.get('/admin/api/pedidos');
  const updatedPedido = afterRes.body.data.find((p) => p.id === pedidoId);
  assert.ok(updatedPedido, 'Pedido debe existir en la lista');
  assert.equal(updatedPedido.estado, 'Cobrado', 'Pedido debe tener estado Cobrado después de actualizar');
});

test('GET /admin/api/pedidos acepta varios estados para el historial (Cobrado y Cancelado)', async () => {
  const db = makeDbState();
  const app = loadAppWithDb(db);
  const agent = request.agent(app);

  await agent.post('/admin/login').send({ username: 'admin', password: 'admin123' });

  const payload = {
    nombre: 'Cliente Historial',
    telefono: '612345678',
    fecha: '2026-09-01',
    hora: '18:00',
    metodo_pago: 'tarjeta',
    personas: 10,
    churros_por_persona: 12,
    chocolates: 0,
  };
  const ids = [];
  for (let i = 0; i < 3; i += 1) {
    const res = await request(app).post('/api/pedidos').send(payload);
    ids.push(res.body.id);
  }
  await vencer(db, ids[0]);
  await agent.put(`/admin/api/pedidos/${ids[0]}`).send({ estado: 'Cobrado' });
  await agent.put(`/admin/api/pedidos/${ids[1]}`).send({ estado: 'Cancelado' });

  const res = await agent.get('/admin/api/pedidos').query({ estado: 'Cobrado,Cancelado' });
  assert.equal(res.status, 200);
  const found = res.body.data.map((p) => p.id).sort();
  assert.deepEqual(found, [ids[0], ids[1]].sort());
});

test('Factura incluye envío, descuento y método de pago correcto', async () => {
  const app = loadAppWithDb(makeDbState());
  const agent = request.agent(app);

  await agent.post('/admin/login').send({ username: 'admin', password: 'admin123' });

  // Caso 1: Pedido CON envío, CON descuento, por transferencia (creado por admin)
  const conEnvio = await agent.post('/api/pedidos').send({
    nombre: 'Cliente Factura Completa',
    telefono: '612345678',
    email: 'cliente@ejemplo.com',
    cp: '28001',
    direccion: 'Calle Mayor 1',
    ciudad: 'Madrid',
    provincia: 'Madrid',
    nif: '12345678Z',
    solicita_factura: true,
    personas: 20,
    churros_por_persona: 12,
    chocolates: 0,
    fecha: '2026-09-01',
    hora: '18:00',
    requiere_envio: true,
    direccion_entrega: 'Calle Entrega 10',
    metodo_pago: 'transferencia',
    comentarios: 'Con envío a domicilio',
    descuento: 10,
  });

  assert.equal(conEnvio.status, 201);
  const pedidoId1 = conEnvio.body.id;
  const detalle1 = await agent.get(`/admin/api/pedidos/${pedidoId1}`);
  
  assert.ok(detalle1.body.data, 'Debe devolver datos del pedido');
  assert.equal(detalle1.body.data.solicita_factura, 1, 'Debe solicitar factura');
  assert.equal(detalle1.body.data.requiere_envio, 1, 'Debe tener envío');
  assert.ok(detalle1.body.data.precio_envio > 0, 'Debe tener precio de envío > 0');
  assert.equal(detalle1.body.data.descuento, 10, 'Debe tener descuento de 10');
  assert.equal(detalle1.body.data.metodo_pago, 'transferencia', 'Debe ser transferencia');

  // Caso 2: Pedido SIN envío, SIN descuento, efectivo (creado por admin sin descuento)
  const sinEnvio = await agent.post('/api/pedidos').send({
    nombre: 'Cliente Sin Envío',
    telefono: '698765432',
    email: 'otro@ejemplo.com',
    cp: '41001',
    direccion: 'Avenida 2',
    ciudad: 'Sevilla',
    provincia: 'Sevilla',
    nif: '87654321A',
    solicita_factura: true,
    personas: 10,
    churros_por_persona: 12,
    chocolates: 0,
    fecha: '2026-09-02',
    hora: '19:00',
    requiere_envio: false,
    metodo_pago: 'efectivo',
    comentarios: 'Sin envío, local',
  });

  assert.equal(sinEnvio.status, 201);
  const pedidoId2 = sinEnvio.body.id;
  const detalle2 = await agent.get(`/admin/api/pedidos/${pedidoId2}`);
  
  assert.ok(detalle2.body.data, 'Debe devolver datos del pedido');
  assert.equal(detalle2.body.data.solicita_factura, 1, 'Debe solicitar factura');
  assert.equal(detalle2.body.data.requiere_envio, 0, 'No debe tener envío');
  assert.equal(detalle2.body.data.precio_envio, null, 'Precio de envío debe ser null');
  assert.equal(detalle2.body.data.descuento, 0, 'Descuento debe ser 0');
  assert.equal(detalle2.body.data.metodo_pago, 'efectivo', 'Debe ser efectivo');
});

test('Suplemento día especial: lo aplica solo el admin, se guarda y entra en el presupuesto', async () => {
  const app = loadAppWithDb(makeDbState());
  const agent = request.agent(app);
  await agent.post('/admin/login').send({ username: 'admin', password: 'admin123' });

  const payload = {
    nombre: 'Cliente Suplemento',
    telefono: '612345678',
    fecha: '2026-09-01',
    hora: '18:00',
    metodo_pago: 'transferencia',
    personas: 20,
    churros_por_persona: 12,
    chocolates: 0,
  };

  const base = await agent.post('/api/pedidos').send(payload);
  assert.equal(base.status, 201);
  const conSuplemento = await agent.post('/api/pedidos').send({ ...payload, suplemento: 11, descuento: 5 });
  assert.equal(conSuplemento.status, 201);

  const detalleBase = (await agent.get(`/admin/api/pedidos/${base.body.id}`)).body.data;
  const detalle = (await agent.get(`/admin/api/pedidos/${conSuplemento.body.id}`)).body.data;
  assert.equal(Number(detalle.suplemento), 11);
  assert.equal(Number(detalle.descuento), 5);
  assert.equal(Number(detalle.presupuesto_total), Number((Number(detalleBase.presupuesto_total) + 11 - 5).toFixed(2)));

  // Edición: cambiar el suplemento recalcula el total y no se puede superar con el descuento.
  const editado = await agent.put(`/admin/api/pedidos/${conSuplemento.body.id}`).send({ suplemento: 21 });
  assert.equal(editado.status, 200);
  assert.equal(Number(editado.body.data.suplemento), 21);
  assert.equal(Number(editado.body.data.presupuesto_total), Number((Number(detalleBase.presupuesto_total) + 21 - 5).toFixed(2)));

  const excedido = await agent.put(`/admin/api/pedidos/${conSuplemento.body.id}`).send({ suplemento: 0, descuento: 100000 });
  assert.equal(excedido.status, 400);

  const negativo = await agent.put(`/admin/api/pedidos/${conSuplemento.body.id}`).send({ suplemento: -3 });
  assert.equal(negativo.status, 400);
  assert.match(negativo.body.error, /suplemento/i);

  // Un cliente sin sesión no puede colar suplemento ni descuento.
  const publico = await request(app).post('/api/pedidos').send({ ...payload, suplemento: 500 });
  assert.equal(publico.status, 201);
  const detallePublico = (await agent.get(`/admin/api/pedidos/${publico.body.id}`)).body.data;
  assert.equal(Number(detallePublico.suplemento), 0);
  assert.equal(Number(detallePublico.presupuesto_total), Number(detalleBase.presupuesto_total));
});
