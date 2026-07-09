/**
 * Sprint 2 — Dashboard y estadísticas
 *
 * Endpoints cubiertos:
 *   GET  /api/dashboard/admin    (estadísticas globales — solo admin)
 *   GET  /api/dashboard/usuario  (estadísticas personales — usuario autenticado)
 */

import request from 'supertest';
import { conectarBD, desconectarBD, limpiarBD } from '../../dbHelper.js';
import Proyecto   from '../../../src/models/Proyecto.js';
import Estudiante from '../../../src/models/Estudiante.js';
import app from '../../../src/server.js';
import { crearEstudiante, crearAdmin, bodyProyectoValido } from '../../helpers.js';

// ─── Setup / Teardown ─────────────────────────────────────────────────────────
let estudiante;
let admin;

beforeAll(async () => {
  await conectarBD();
  estudiante = await crearEstudiante();
  admin      = await crearAdmin();

  // Crear algunos proyectos para que las estadísticas no estén vacías
  await request(app)
    .post('/api/proyectos')
    .set('Authorization', `Bearer ${estudiante.token}`)
    .send(bodyProyectoValido);

  await request(app)
    .post('/api/proyectos')
    .set('Authorization', `Bearer ${estudiante.token}`)
    .send({ ...bodyProyectoValido, titulo: 'Segundo proyecto para dashboard test' });
});

afterAll(async () => {
  await Proyecto.deleteMany({});
  await Estudiante.deleteMany({});
  await desconectarBD();
});
// ─────────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// ESTADÍSTICAS GLOBALES (ADMIN)
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/dashboard/admin', () => {

  it('retorna 200 con la estructura completa de estadísticas', async () => {
    const res = await request(app)
      .get('/api/dashboard/admin')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('incluye porCategoria, porCarrera, porEstado', async () => {
    const res = await request(app)
      .get('/api/dashboard/admin')
      .set('Authorization', `Bearer ${admin.token}`);

    const { data } = res.body;
    expect(Array.isArray(data.porCategoria)).toBe(true);
    expect(Array.isArray(data.porCarrera)).toBe(true);
    expect(Array.isArray(data.porEstado)).toBe(true);
  });

  it('incluye el resumen con totalProyectos y totalPublicados', async () => {
    const res = await request(app)
      .get('/api/dashboard/admin')
      .set('Authorization', `Bearer ${admin.token}`);

    const { resumen } = res.body.data;
    expect(resumen.totalProyectos).toBeGreaterThanOrEqual(2);
    expect(resumen.totalPublicados).toBeDefined();
    expect(resumen.totalDonaciones).toBeDefined();
  });

  it('incluye topProyectos como array', async () => {
    const res = await request(app)
      .get('/api/dashboard/admin')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(Array.isArray(res.body.data.topProyectos)).toBe(true);
  });

  it('retorna 403 si lo llama un estudiante', async () => {
    const res = await request(app)
      .get('/api/dashboard/admin')
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect(res.status).toBe(403);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app).get('/api/dashboard/admin');
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ESTADÍSTICAS PERSONALES (USUARIO)
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/dashboard/usuario', () => {

  it('retorna 200 con las estadísticas del usuario autenticado', async () => {
    const res = await request(app)
      .get('/api/dashboard/usuario')
      .set('Authorization', `Bearer ${estudiante.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('incluye los proyectos del usuario', async () => {
    const res = await request(app)
      .get('/api/dashboard/usuario')
      .set('Authorization', `Bearer ${estudiante.token}`);

    expect(Array.isArray(res.body.data.proyectos)).toBe(true);
    expect(res.body.data.proyectos.length).toBeGreaterThanOrEqual(2);
  });

  it('incluye porCategoria y porEstado del usuario', async () => {
    const res = await request(app)
      .get('/api/dashboard/usuario')
      .set('Authorization', `Bearer ${estudiante.token}`);

    expect(Array.isArray(res.body.data.porCategoria)).toBe(true);
    expect(Array.isArray(res.body.data.porEstado)).toBe(true);
  });

  it('incluye el resumen con totalProyectos y totalVistas', async () => {
    const res = await request(app)
      .get('/api/dashboard/usuario')
      .set('Authorization', `Bearer ${estudiante.token}`);

    const { resumen } = res.body.data;
    expect(resumen.totalProyectos).toBeGreaterThanOrEqual(2);
    expect(resumen.totalVistas).toBeDefined();
    expect(resumen.totalLikes).toBeDefined();
  });

  it('solo devuelve proyectos del usuario autenticado, no de otros', async () => {
    const otro = await crearEstudiante();
    await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${otro.token}`)
      .send({ ...bodyProyectoValido, titulo: 'Proyecto de otro usuario para dashboard' });

    const res = await request(app)
      .get('/api/dashboard/usuario')
      .set('Authorization', `Bearer ${estudiante.token}`);

    const titulos = res.body.data.proyectos.map(p => p.titulo);
    expect(titulos).not.toContain('Proyecto de otro usuario para dashboard');
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app).get('/api/dashboard/usuario');
    expect(res.status).toBe(401);
  });
});
