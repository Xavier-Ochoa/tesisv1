/**
 * Sprint 2 — Control administrativo de proyectos
 *
 * Endpoints cubiertos:
 *   PUT  /api/admin/proyectos/:id/aprobar
 *   PUT  /api/admin/proyectos/:id/rechazar
 *   PUT  /api/admin/proyectos/:id/desactivar
 *   PUT  /api/admin/proyectos/:id/reactivar
 *   PUT  /api/proyectos/:id/publicar
 *   GET  /api/admin/proyectos
 *   GET  /api/admin/proyectos?q=texto  (búsqueda por query param)
 *   GET  /api/admin/proyectos/:id
 *   PUT  /api/admin/proyectos/:id
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
});

afterAll(async () => {
  await Proyecto.deleteMany({});
  await Estudiante.deleteMany({});
  await desconectarBD();
});

afterEach(async () => {
  await Proyecto.deleteMany({});
});

// ─── helper ───────────────────────────────────────────────────────────────────
const crearProyecto = async (override = {}) => {
  const res = await request(app)
    .post('/api/proyectos')
    .set('Authorization', `Bearer ${estudiante.token}`)
    .send({ ...bodyProyectoValido, ...override });
  return res.body.data?._id;
};
// ─────────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// APROBAR PROYECTO
// ══════════════════════════════════════════════════════════════════════════════
describe('PUT /api/admin/proyectos/:id/aprobar', () => {

  it('retorna 200 y cambia el estado a aprobado', async () => {
    const id  = await crearProyecto();
    const res = await request(app)
      .put(`/api/admin/proyectos/${id}/aprobar`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    const p = await Proyecto.findById(id);
    expect(p.estado).toBe('aprobado');
  });

  it('retorna 400 si el proyecto ya está aprobado', async () => {
    const id = await crearProyecto();
    await request(app).put(`/api/admin/proyectos/${id}/aprobar`).set('Authorization', `Bearer ${admin.token}`);
    const res = await request(app)
      .put(`/api/admin/proyectos/${id}/aprobar`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(400);
  });

  it('retorna 403 si lo llama un estudiante', async () => {
    const id  = await crearProyecto();
    const res = await request(app)
      .put(`/api/admin/proyectos/${id}/aprobar`)
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect(res.status).toBe(403);
  });

  it('retorna 401 sin token', async () => {
    const id  = await crearProyecto();
    const res = await request(app).put(`/api/admin/proyectos/${id}/aprobar`);
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// RECHAZAR PROYECTO
// ══════════════════════════════════════════════════════════════════════════════
describe('PUT /api/admin/proyectos/:id/rechazar', () => {

  it('retorna 200 y cambia el estado a rechazado', async () => {
    const id  = await crearProyecto();
    const res = await request(app)
      .put(`/api/admin/proyectos/${id}/rechazar`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ motivo: 'El proyecto no cumple con los requisitos mínimos.' });

    expect(res.status).toBe(200);
    const p = await Proyecto.findById(id);
    expect(p.estado).toBe('rechazado');
  });

  it('retorna 400 si el proyecto ya está rechazado', async () => {
    const id = await crearProyecto();
    await request(app).put(`/api/admin/proyectos/${id}/rechazar`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ motivo: 'Primer rechazo.' });
    const res = await request(app)
      .put(`/api/admin/proyectos/${id}/rechazar`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ motivo: 'Segundo intento de rechazo.' });
    expect(res.status).toBe(400);
  });

  it('retorna 403 si lo llama un estudiante', async () => {
    const id  = await crearProyecto();
    const res = await request(app)
      .put(`/api/admin/proyectos/${id}/rechazar`)
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send({ motivo: 'Intento no autorizado.' });
    expect(res.status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DESACTIVAR PROYECTO
// ══════════════════════════════════════════════════════════════════════════════
describe('PUT /api/admin/proyectos/:id/desactivar', () => {

  it('retorna 200 y desactiva el proyecto', async () => {
    const id = await crearProyecto();
    const res = await request(app)
      .put(`/api/admin/proyectos/${id}/desactivar`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
  });

  it('retorna 403 si lo llama un estudiante', async () => {
    const id  = await crearProyecto();
    const res = await request(app)
      .put(`/api/admin/proyectos/${id}/desactivar`)
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect(res.status).toBe(403);
  });

  it('retorna 401 sin token', async () => {
    const id  = await crearProyecto();
    const res = await request(app).put(`/api/admin/proyectos/${id}/desactivar`);
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// REACTIVAR PROYECTO
// ══════════════════════════════════════════════════════════════════════════════
describe('PUT /api/admin/proyectos/:id/reactivar', () => {

  it('retorna 200 y reactiva un proyecto desactivado', async () => {
    const id = await crearProyecto();
    await request(app).put(`/api/admin/proyectos/${id}/desactivar`)
      .set('Authorization', `Bearer ${admin.token}`);

    const res = await request(app)
      .put(`/api/admin/proyectos/${id}/reactivar`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
  });

  it('retorna 403 si lo llama un estudiante', async () => {
    const id  = await crearProyecto();
    const res = await request(app)
      .put(`/api/admin/proyectos/${id}/reactivar`)
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect(res.status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PUBLICAR PROYECTO (autor — solo si aprobado)
// ══════════════════════════════════════════════════════════════════════════════
describe('PUT /api/proyectos/:id/publicar', () => {

  it('retorna 200 y publica el proyecto aprobado', async () => {
    const id = await crearProyecto();
    await request(app).put(`/api/admin/proyectos/${id}/aprobar`)
      .set('Authorization', `Bearer ${admin.token}`);

    const res = await request(app)
      .put(`/api/proyectos/${id}/publicar`)
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect(res.status).toBe(200);

    const p = await Proyecto.findById(id);
    expect(p.publico).toBe(true);
  });

  it('retorna 400 al intentar publicar un proyecto pendiente', async () => {
    const id  = await crearProyecto();
    const res = await request(app)
      .put(`/api/proyectos/${id}/publicar`)
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect(res.status).toBe(400);
  });

  it('retorna 400 al intentar publicar un proyecto ya publicado', async () => {
    const id = await crearProyecto();
    await request(app).put(`/api/admin/proyectos/${id}/aprobar`)
      .set('Authorization', `Bearer ${admin.token}`);
    await request(app).put(`/api/proyectos/${id}/publicar`)
      .set('Authorization', `Bearer ${estudiante.token}`);

    const res = await request(app)
      .put(`/api/proyectos/${id}/publicar`)
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect(res.status).toBe(400);
  });

  it('retorna 403 si otro estudiante intenta publicar', async () => {
    const id   = await crearProyecto();
    await request(app).put(`/api/admin/proyectos/${id}/aprobar`)
      .set('Authorization', `Bearer ${admin.token}`);
    const otro = await crearEstudiante();
    const res  = await request(app)
      .put(`/api/proyectos/${id}/publicar`)
      .set('Authorization', `Bearer ${otro.token}`);
    expect(res.status).toBe(403);
  });

  it('retorna 401 sin token', async () => {
    const id  = await crearProyecto();
    const res = await request(app).put(`/api/proyectos/${id}/publicar`);
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN LISTAR TODOS LOS PROYECTOS
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/admin/proyectos', () => {

  it('retorna 200 con todos los proyectos (cualquier estado)', async () => {
    await crearProyecto();
    await crearProyecto({ titulo: 'Segundo proyecto para listado admin' });

    const res = await request(app)
      .get('/api/admin/proyectos')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('retorna 403 si lo llama un estudiante', async () => {
    const res = await request(app)
      .get('/api/admin/proyectos')
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect(res.status).toBe(403);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app).get('/api/admin/proyectos');
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN BUSCAR PROYECTOS
// ══════════════════════════════════════════════════════════════════════════════
// La búsqueda de proyectos admin se hace usando el query param ?q= sobre la ruta base
describe('GET /api/admin/proyectos?q= (búsqueda por texto)', () => {

  it('retorna 200 con resultados que coinciden con el query', async () => {
    await crearProyecto({ titulo: 'Sistema de inventario especializado' });

    const res = await request(app)
      .get('/api/admin/proyectos?q=inventario')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('retorna 200 con array vacío si no hay coincidencias', async () => {
    const res = await request(app)
      .get('/api/admin/proyectos?q=xyzterminologiainexistente')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);
  });

  it('retorna 403 si lo llama un estudiante', async () => {
    const res = await request(app)
      .get('/api/admin/proyectos?q=test')
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect(res.status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN VER PROYECTO
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/admin/proyectos/:id', () => {

  it('retorna 200 con el detalle completo del proyecto', async () => {
    const id  = await crearProyecto();
    const res = await request(app)
      .get(`/api/admin/proyectos/${id}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data._id.toString()).toBe(id);
  });

  it('retorna 404 con un ID inexistente', async () => {
    const res = await request(app)
      .get('/api/admin/proyectos/64a000000000000000000000')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(404);
  });

  it('retorna 403 si lo llama un estudiante', async () => {
    const id  = await crearProyecto();
    const res = await request(app)
      .get(`/api/admin/proyectos/${id}`)
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect(res.status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN EDITAR PROYECTO
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// PROYECTOS DESTACADOS (sin autenticación requerida)
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/admin/proyectos/destacados', () => {

  // Helper: crear y aprobar un proyecto con enviarAlAdmin=true
  const crearProyectoDestacado = async (override = {}) => {
    const res = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send({ ...bodyProyectoValido, enviarAlAdmin: true, ...override });
    const id = res.body.data?._id;
    await request(app)
      .put(`/api/admin/proyectos/${id}/aprobar`)
      .set('Authorization', `Bearer ${admin.token}`);
    return id;
  };

  it('retorna 200 con un array (puede estar vacío)', async () => {
    const res = await request(app)
      .get('/api/admin/proyectos/destacados')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('retorna 401 sin token (requiere autenticación de admin)', async () => {
    const res = await request(app).get('/api/admin/proyectos/destacados');
    expect(res.status).toBe(401);
  });

  it('retorna 403 si lo llama un estudiante', async () => {
    const res = await request(app)
      .get('/api/admin/proyectos/destacados')
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect(res.status).toBe(403);
  });

  it('incluye proyectos con enviarAlAdmin=true y activo=true', async () => {
    const id = await crearProyectoDestacado({ titulo: 'Destacado para incluir en lista' });
    const res = await request(app)
      .get('/api/admin/proyectos/destacados')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map(p => p._id.toString());
    expect(ids).toContain(id.toString());
    await Proyecto.deleteOne({ _id: id });
  });

  it('no incluye proyectos con enviarAlAdmin=false', async () => {
    const resPrivado = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send({ ...bodyProyectoValido, enviarAlAdmin: false, titulo: 'Proyecto privado no destacado' });
    const idPrivado = resPrivado.body.data?._id;

    const res = await request(app)
      .get('/api/admin/proyectos/destacados')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map(p => p._id.toString());
    expect(ids).not.toContain(idPrivado.toString());
    await Proyecto.deleteOne({ _id: idPrivado });
  });

  it('no incluye proyectos con activo=false', async () => {
    // crearProyectoDestacado aprueba el proyecto, y el endpoint desactivar
    // rechaza proyectos aprobados (regla de negocio). Se fuerza activo=false
    // directamente en la BD para testear el filtro del listado aislado de esa regla.
    const id = await crearProyectoDestacado({ titulo: 'Proyecto a desactivar para test' });
    await Proyecto.findByIdAndUpdate(id, { activo: false });

    const res = await request(app)
      .get('/api/admin/proyectos/destacados')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map(p => p._id.toString());
    expect(ids).not.toContain(id.toString());
    await Proyecto.deleteOne({ _id: id });
  });

  it('retorna máximo 10 proyectos', async () => {
    const res = await request(app)
      .get('/api/admin/proyectos/destacados')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(10);
  });
});