const request = require('supertest');
const { app } = require('./server');

global.pool = {
  state: { nextId: 1, precios: [{ precio_churro: 1.2, precio_chocolate: 1.1, precio_envio: 3.5 }], clientes: [], proveedores: [], pedidos: [] },
  execute(sql, params = []) {
    const q = String(sql).trim();
    if (q.includes('SELECT precio_churro')) return [[this.state.precios[0]]];
    if (q.includes('INSERT INTO pedidos')) {
      const [nombre, telefono, email, cp, direccion, ciudad, provincia, nif, solicita_factura, personas, churros_por_persona, chocolates, fecha, hora, requiere_envio, direccion_entrega, metodo_pago, comentarios, presupuesto_total, precio_churro, precio_chocolate, precio_envio, descuento] = params;
      const row = { id: this.state.nextId++, nombre, telefono, email: email ?? null, cp: cp ?? null, direccion: direccion ?? null, ciudad: ciudad ?? null, provincia: provincia ?? null, nif: nif ?? null, solicita_factura: !!solicita_factura, personas: personas ?? null, churros_por_persona: churros_por_persona ?? null, chocolates: chocolates ?? null, fecha, hora, requiere_envio: !!requiere_envio, direccion_entrega: direccion_entrega ?? null, metodo_pago, comentarios: comentarios ?? null, presupuesto_total, precio_churro: precio_churro ?? null, precio_chocolate: precio_chocolate ?? null, precio_envio: precio_envio ?? null, descuento: descuento ?? 0, estado: 'Pendiente' };
      this.state.pedidos.push(row);
      return [{ insertId: row.id }];
    }
    if (q.includes('FROM pedidos') && q.includes('ORDER BY') && !q.includes('WHERE id = ?')) {
      const likeParam = params.find((value) => typeof value === 'string' && value.includes('%')) || params[0] || '';
      const searchTerm = String(likeParam).replace(/[%_]/g, '').trim();
      const items = this.state.pedidos.filter((pedido) => !searchTerm || [pedido.nombre, pedido.email, pedido.telefono, pedido.ciudad, pedido.provincia].some((value) => String(value || '').toLowerCase().includes(searchTerm.toLowerCase())));
      console.log('DEBUG_LIST_QUERY', { sql: q, params, searchTerm, items: this.state.pedidos.map(p => p.nombre) });
      return [items.slice(0, 20)];
    }
    return [[]];
  },
  getConnection() {
    return {
      beginTransaction: async () => {},
      execute: async (sql, params = []) => this.execute(sql, params),
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
    };
  }
};

(async () => {
  const agent = request.agent(app);
  await agent.post('/admin/login').send({ username: 'admin', password: 'admin123' });
  await request(app).post('/api/pedidos').send({ nombre: 'Ana García', telefono: '612345678', fecha: '2026-09-01', hora: '18:00', metodo_pago: 'efectivo', personas: 10, churros_por_persona: 12, chocolates: 0 });
  await request(app).post('/api/pedidos').send({ nombre: 'Marta López', telefono: '698765432', fecha: '2026-09-02', hora: '19:00', metodo_pago: 'tarjeta', personas: 8, churros_por_persona: 12, chocolates: 0 });
  const res = await agent.get('/admin/api/pedidos?q=Ana&page=1&pageSize=10');
  console.log('FINAL', JSON.stringify({ status: res.status, body: res.body }, null, 2));
  process.exit(0);
})();
