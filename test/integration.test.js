const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

function estadoClienteDuplicado(state, telefono) {
  return Boolean(telefono) && state.clientes.some((cliente) => cliente.telefono === telefono);
}

function makeDbState() {
  const state = {
    nextId: 1,
    precios: [{ precio_churro: 1.2, precio_chocolate: 1.1, precio_envio: 3.5 }],
    clientes: [],
    proveedores: [],
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

      if (query.includes('INSERT INTO pedidos')) {
        const [nombre, telefono, email, cp, direccion, ciudad, provincia, nif, solicita_factura, personas, churros_por_persona, chocolates, fecha, hora, requiere_envio, direccion_entrega, metodo_pago, comentarios, presupuesto_total, precio_churro, precio_chocolate, precio_envio, descuento] = params;
        const row = {
          id: state.nextId++,
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
          estado: 'Pendiente',
        };
        state.pedidos.push(row);
        return [{ insertId: row.id }];
      }

      if (query.includes('SELECT estado FROM pedidos WHERE id = ? LIMIT 1')) {
        const id = Number(params[0]);
        const pedido = state.pedidos.find((item) => item.id === id);
        return [[{ estado: pedido ? (pedido.estado || 'Pendiente') : null }]];
      }

      if (query.includes('SELECT * FROM pedidos WHERE id = ? LIMIT 1')) {
        const id = Number(params[0]);
        return [state.pedidos.filter((pedido) => pedido.id === id)];
      }

      if (query.includes('SELECT id, nombre, telefono, email, cp, direccion, ciudad, provincia, nif, solicita_factura, personas, churros_por_persona, chocolates, fecha, hora, requiere_envio, direccion_entrega, metodo_pago, comentarios, presupuesto_total, descuento, estado, created_at')) {
        const searchTerm = String(params[0] || '').replace(/[%_]/g, '').trim();
        const estadoFilter = params.find((p) => typeof p === 'string' && ['Pendiente', 'Realizado', 'Cobrado', 'Cancelado'].includes(p)) || null;
        const items = state.pedidos.filter((pedido) => {
          const hayQ = !searchTerm || [pedido.nombre, pedido.email, pedido.telefono, pedido.ciudad, pedido.provincia].some((value) => String(value || '').toLowerCase().includes(searchTerm.toLowerCase()));
          const hayEstado = !estadoFilter || pedido.estado === estadoFilter;
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
            'metodo_pago','comentarios','estado','descuento','presupuesto_total','precio_churro','precio_chocolate','precio_envio'
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

test('GET /health responde OK', async () => {
  const app = loadAppWithDb(makeDbState());
  const res = await request(app).get('/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
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

  const pendingDelete = await agent.delete(`/admin/api/pedidos/${created.body.id}`);
  assert.equal(pendingDelete.status, 400);
  assert.match(pendingDelete.body.error, /Cancelado/i);

  const changeStatus = await agent.put(`/admin/api/pedidos/${created.body.id}`).send({ estado: 'Cancelado' });
  assert.equal(changeStatus.status, 200);

  const canceledDelete = await agent.delete(`/admin/api/pedidos/${created.body.id}`);
  assert.equal(canceledDelete.status, 200);
  assert.equal(canceledDelete.body.ok, true);
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
  const app = loadAppWithDb(makeDbState());
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

  // Cambiar a Cobrado
  const updateRes = await agent.put(`/admin/api/pedidos/${pedidoId}`).send({ estado: 'Cobrado' });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.ok, true);

  // Listar nuevamente para ver el estado actualizado (después de refrescar)
  const afterRes = await agent.get('/admin/api/pedidos');
  const updatedPedido = afterRes.body.data.find((p) => p.id === pedidoId);
  assert.ok(updatedPedido, 'Pedido debe existir en la lista');
  assert.equal(updatedPedido.estado, 'Cobrado', 'Pedido debe tener estado Cobrado después de actualizar');
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
