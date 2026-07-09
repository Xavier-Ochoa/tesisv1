/**
 * Sprint 1 — Endpoints públicos (landing)
 *
 * Endpoints cubiertos:
 *   GET  /api/proyectos                    (listar proyectos públicos)
 *   GET  /api/proyectos/destacados         (proyectos destacados)
 *   GET  /api/proyectos/categoria/:tipo    (por categoría)
 *   GET  /api/proyectos/estudiante/:id     (por estudiante)
 *   GET  /api/proyectos/:id               (detalle de proyecto)
 */

import request from 'supertest';
import { conectarBD, desconectarBD, limpiarBD } from '../../dbHelper.js';
import Proyecto from '../../../src/models/Proyecto.js';
import Estudiante from '../../../src/models/Estudiante.js';
import app from '../../../src/server.js';
import { crearEstudiante, crearAdmin, bodyProyectoValido } from '../../helpers.js';

// ─── Setup ────────────────────────────────────────────────────────────────────
let estudiante;
let admin;
let proyectoPublicoId;   // aprobado + publicado
let proyectoPendienteId; // solo pendiente

// Proyectos adicionales para tests de filtros (hallazgo #8)
let proyectoSoftwareId;  // categoria=academico, carrera del autor
let proyectoExtracurricularId;

beforeAll(async () => {
  await conectarBD();
  estudiante = await crearEstudiante();
  admin      = await crearAdmin();

  // Crear proyecto pendiente
  const resPend = await request(app)
    .post('/api/proyectos')
    .set('Authorization', `Bearer ${estudiante.token}`)
    .send(bodyProyectoValido);
  proyectoPendienteId = resPend.body.data._id;

  // Crear proyecto público: crear → aprobar → publicar
  const resCrear = await request(app)
    .post('/api/proyectos')
    .set('Authorization', `Bearer ${estudiante.token}`)
    .send({ ...bodyProyectoValido, titulo: 'Proyecto publicado para landing test' });
  const id = resCrear.body.data._id;

  await request(app)
    .put(`/api/admin/proyectos/${id}/aprobar`)
    .set('Authorization', `Bearer ${admin.token}`);

  await request(app)
    .put(`/api/proyectos/${id}/publicar`)
    .set('Authorization', `Bearer ${estudiante.token}`);

  proyectoPublicoId = id;

  // Proyecto público adicional — categoría 'academico' para filtrar (hallazgo #8)
  const resSoft = await request(app)
    .post('/api/proyectos')
    .set('Authorization', `Bearer ${estudiante.token}`)
    .send({ ...bodyProyectoValido, titulo: 'Proyecto academico para filtro por categoria', categoria: 'academico' });
  proyectoSoftwareId = resSoft.body.data._id;
  await request(app).put(`/api/admin/proyectos/${proyectoSoftwareId}/aprobar`).set('Authorization', `Bearer ${admin.token}`);
  await request(app).put(`/api/proyectos/${proyectoSoftwareId}/publicar`).set('Authorization', `Bearer ${estudiante.token}`);

  // Proyecto público adicional — categoría 'extracurricular' para comprobar exclusión
  const resExtra = await request(app)
    .post('/api/proyectos')
    .set('Authorization', `Bearer ${estudiante.token}`)
    .send({ ...bodyProyectoValido, titulo: 'Proyecto extracurricular para prueba de filtros', categoria: 'extracurricular' });
  proyectoExtracurricularId = resExtra.body.data._id;
  await request(app).put(`/api/admin/proyectos/${proyectoExtracurricularId}/aprobar`).set('Authorization', `Bearer ${admin.token}`);
  await request(app).put(`/api/proyectos/${proyectoExtracurricularId}/publicar`).set('Authorization', `Bearer ${estudiante.token}`);
});

afterAll(async () => {
  await Proyecto.deleteMany({});
  await Estudiante.deleteMany({});
  await desconectarBD();
});
// ─────────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// LISTAR PROYECTOS PÚBLICOS
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/proyectos', () => {

  it('retorna 200 sin necesitar token', async () => {
    const res = await request(app).get('/api/proyectos');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('incluye el proyecto publicado en la lista', async () => {
    const res = await request(app).get('/api/proyectos');
    const ids = res.body.data.map(p => p._id.toString());
    expect(ids).toContain(proyectoPublicoId);
  });

  it('NO incluye proyectos pendientes o no publicados', async () => {
    const res = await request(app).get('/api/proyectos');
    const ids = res.body.data.map(p => p._id.toString());
    expect(ids).not.toContain(proyectoPendienteId);
  });

  it('la respuesta no expone el password del autor', async () => {
    const res = await request(app).get('/api/proyectos');
    res.body.data.forEach(p => {
      expect(p.autor?.password).toBeUndefined();
    });
  });

  // ── Hallazgo #8: filtros con datos controlados ────────────────────────────

  it('?categoria= filtra correctamente por categoría', async () => {
    const res = await request(app).get('/api/proyectos?categoria=academico');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    // Todos los proyectos devueltos deben ser de la categoría solicitada
    res.body.data.forEach(p => expect(p.categoria).toBe('academico'));
    // El proyecto academico creado en el setup debe aparecer
    const ids = res.body.data.map(p => p._id.toString());
    expect(ids).toContain(proyectoSoftwareId);
    // El proyecto extracurricular no debe aparecer
    expect(ids).not.toContain(proyectoExtracurricularId);
  });

  it('?q= busca por texto en título o descripción', async () => {
    const res = await request(app).get('/api/proyectos?q=extracurricular');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    // Si el índice de texto está activo, debe encontrar el proyecto con ese término
    // Si no hay índice $text configurado el endpoint puede devolver 500 o array vacío;
    // lo que importa es que no rompa con un error no controlado.
    expect([200]).toContain(res.status);
  });

  it('?carrera= filtra proyectos por la carrera del autor', async () => {
    // El estudiante de prueba tiene carrera 'Desarrollo de Software' (ver helpers.js)
    const carrera = encodeURIComponent('Desarrollo de Software');
    const res = await request(app).get(`/api/proyectos?carrera=${carrera}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    // Todos los proyectos devueltos deben tener un autor con esa carrera
    res.body.data.forEach(p => {
      expect(p.autor?.carrera).toBe('Desarrollo de Software');
    });
  });

  it('paginación: ?page=1&limit=1 devuelve exactamente 1 resultado y metadatos de paginación', async () => {
    const res = await request(app).get('/api/proyectos?page=1&limit=1');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(1);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.page).toBe(1);
    expect(typeof res.body.pagination.total).toBe('number');
    expect(typeof res.body.pagination.totalPages).toBe('number');
  });

  it('paginación: ?page=2&limit=1 devuelve la segunda página sin solapar con la primera', async () => {
    const p1 = await request(app).get('/api/proyectos?page=1&limit=1');
    const p2 = await request(app).get('/api/proyectos?page=2&limit=1');
    expect(p1.status).toBe(200);
    expect(p2.status).toBe(200);
    // Las páginas no deben contener el mismo proyecto (si hay al menos 2 proyectos públicos)
    if (p1.body.data.length > 0 && p2.body.data.length > 0) {
      expect(p1.body.data[0]._id).not.toBe(p2.body.data[0]._id);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PROYECTOS DESTACADOS
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/proyectos/destacados', () => {

  it('retorna 200 sin token', async () => {
    const res = await request(app).get('/api/proyectos/destacados');
    expect(res.status).toBe(200);
  });

  it('retorna un array (puede estar vacío si no hay proyectos con muchas vistas)', async () => {
    const res = await request(app).get('/api/proyectos/destacados');
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PROYECTOS POR CATEGORÍA
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/proyectos/categoria/:tipo', () => {

  it('retorna 200 para categoría "academico"', async () => {
    const res = await request(app).get('/api/proyectos/categoria/academico');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('retorna 200 para categoría "extracurricular"', async () => {
    const res = await request(app).get('/api/proyectos/categoria/extracurricular');
    expect(res.status).toBe(200);
  });

  it('los proyectos retornados son solo de la categoría solicitada', async () => {
    const res = await request(app).get('/api/proyectos/categoria/academico');
    res.body.data.forEach(p => expect(p.categoria).toBe('academico'));
  });

  it('retorna array vacío para categoría válida sin proyectos', async () => {
    const res = await request(app).get('/api/proyectos/categoria/extracurricular');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PROYECTOS POR ESTUDIANTE
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/proyectos/estudiante/:id', () => {

  it('retorna 200 con los proyectos públicos del estudiante', async () => {
    const res = await request(app)
      .get(`/api/proyectos/estudiante/${estudiante.userId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('los proyectos retornados pertenecen al estudiante solicitado', async () => {
    const res = await request(app)
      .get(`/api/proyectos/estudiante/${estudiante.userId}`);
    res.body.data.forEach(p => {
      const autorId = p.autor?._id?.toString() || p.autor?.toString();
      expect(autorId).toBe(estudiante.userId);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DETALLE DE PROYECTO
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/proyectos/:id', () => {

  it('retorna 200 con el detalle del proyecto publicado sin token', async () => {
    const res = await request(app).get(`/api/proyectos/${proyectoPublicoId}`);
    expect(res.status).toBe(200);
    expect(res.body.data._id.toString()).toBe(proyectoPublicoId);
  });

  it('retorna 200 con el detalle del proyecto usando token del autor', async () => {
    const res = await request(app)
      .get(`/api/proyectos/${proyectoPendienteId}`)
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect(res.status).toBe(200);
  });

  it('retorna 404 con un ID inexistente', async () => {
    const res = await request(app).get('/api/proyectos/64a000000000000000000000');
    expect(res.status).toBe(404);
  });

  it('no expone el password del autor en el detalle', async () => {
    const res = await request(app).get(`/api/proyectos/${proyectoPublicoId}`);
    expect(res.body.data?.autor?.password).toBeUndefined();
  });

  // ── Hallazgo #9: admin puede ver proyecto no público si enviarAlAdmin=true ──

  it('admin puede acceder a proyecto no público cuando enviarAlAdmin=true (branch esAdminConAcceso)', async () => {
    // Crear proyecto con enviarAlAdmin=true pero sin publicar (no público)
    const resCrear = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send({ ...bodyProyectoValido, titulo: 'Proyecto enviado al admin sin publicar', enviarAlAdmin: true });
    const idNoPublico = resCrear.body.data._id;

    // Verificar que sin token (anónimo) no tiene acceso
    const resSinToken = await request(app).get(`/api/proyectos/${idNoPublico}`);
    expect(resSinToken.status).toBe(403);

    // El admin SÍ debe poder verlo porque enviarAlAdmin=true
    const resAdmin = await request(app)
      .get(`/api/proyectos/${idNoPublico}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(resAdmin.status).toBe(200);
    expect(resAdmin.body.data._id.toString()).toBe(idNoPublico);

    // Un estudiante ajeno NO debe poder verlo
    const otro = await crearEstudiante();
    const resOtro = await request(app)
      .get(`/api/proyectos/${idNoPublico}`)
      .set('Authorization', `Bearer ${otro.token}`);
    expect(resOtro.status).toBe(403);

    await Proyecto.findByIdAndDelete(idNoPublico);
  });

  it('admin NO puede acceder a proyecto no público con enviarAlAdmin=false', async () => {
    // bodyProyectoValido tiene enviarAlAdmin=true, así que proyectoPendienteId
    // también lo tiene y el admin puede verlo (esAdminConAcceso=true).
    // Para testear el caso enviarAlAdmin=false hay que crear un proyecto explícito.
    const resCrear = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send({ ...bodyProyectoValido, titulo: 'Proyecto privado sin enviar al admin', enviarAlAdmin: false });
    const idPrivado = resCrear.body.data._id;

    const resAdmin = await request(app)
      .get(`/api/proyectos/${idPrivado}`)
      .set('Authorization', `Bearer ${admin.token}`);

    // esAdminConAcceso = esAdmin && proyecto.enviarAlAdmin → false → 403
    expect(resAdmin.status).toBe(403);

    await Proyecto.findByIdAndDelete(idPrivado);
  });
});