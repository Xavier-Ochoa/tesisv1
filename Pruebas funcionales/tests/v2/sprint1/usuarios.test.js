/**
 * Sprint 1 — Gestión de usuarios (Admin)
 *
 * Endpoints cubiertos:
 *   PATCH  /api/auth/usuarios/:id/rol
 *   GET    /api/admin/estudiantes
 *   GET    /api/admin/estudiantes/estadisticas
 *   GET    /api/admin/estudiantes/:id
 *   PATCH  /api/admin/estudiantes/:id/estado
 */

import request from 'supertest';
import { conectarBD, desconectarBD, limpiarBD } from '../../dbHelper.js';
import Estudiante from '../../../src/models/Estudiante.js';
import app from '../../../src/server.js';
import { crearEstudiante, crearAdmin } from '../../helpers.js';

// ─── Setup / Teardown ─────────────────────────────────────────────────────────
let admin;
let estudiante;

beforeAll(async () => {
  await conectarBD();
  admin      = await crearAdmin();
  estudiante = await crearEstudiante();
});

afterAll(async () => {
  await Estudiante.deleteMany({});
  await desconectarBD();
});
// ─────────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// CAMBIAR ROL
// ══════════════════════════════════════════════════════════════════════════════
describe('PATCH /api/auth/usuarios/:id/rol', () => {

  it('retorna 200 y cambia el rol correctamente', async () => {
    const res = await request(app)
      .patch(`/api/auth/usuarios/${estudiante.userId}/rol`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ rol: 'docente' });
    expect(res.status).toBe(200);
    expect(res.body.data.rol).toBe('docente');
  });

  it('retorna 403 si el admin intenta cambiar su propio rol', async () => {
    const res = await request(app)
      .patch(`/api/auth/usuarios/${admin.userId}/rol`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ rol: 'estudiante' });
    expect(res.status).toBe(403);
  });

  it('retorna 403 si un estudiante intenta cambiar el rol de otro', async () => {
    const otro = await crearEstudiante();
    const res = await request(app)
      .patch(`/api/auth/usuarios/${otro.userId}/rol`)
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send({ rol: 'admin' });
    expect(res.status).toBe(403);
  });

  it('retorna 400 si el rol enviado no es válido', async () => {
    const res = await request(app)
      .patch(`/api/auth/usuarios/${estudiante.userId}/rol`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ rol: 'superusuario' });
    expect(res.status).toBe(400);
  });

  it('retorna 400 si no se envía el campo rol', async () => {
    const res = await request(app)
      .patch(`/api/auth/usuarios/${estudiante.userId}/rol`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app)
      .patch(`/api/auth/usuarios/${estudiante.userId}/rol`)
      .send({ rol: 'docente' });
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// LISTAR USUARIOS
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/admin/estudiantes', () => {

  it('retorna 200 con la lista de usuarios', async () => {
    const res = await request(app)
      .get('/api/admin/estudiantes')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it('filtra por rol correctamente', async () => {
    const res = await request(app)
      .get('/api/admin/estudiantes?rol=admin')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    res.body.data.forEach(u => expect(u.rol).toBe('admin'));
  });

  it('retorna 400 con un rol inválido', async () => {
    const res = await request(app)
      .get('/api/admin/estudiantes?rol=inventado')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(400);
  });

  it('retorna 403 si lo llama un estudiante', async () => {
    const res = await request(app)
      .get('/api/admin/estudiantes')
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect(res.status).toBe(403);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app).get('/api/admin/estudiantes');
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ESTADÍSTICAS DE USUARIOS
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/admin/estudiantes/estadisticas', () => {

  it('retorna 200 con la estructura de estadísticas', async () => {
    const res = await request(app)
      .get('/api/admin/estudiantes/estadisticas')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalUsuarios).toBeDefined();
    expect(Array.isArray(res.body.data.porRol)).toBe(true);
    expect(Array.isArray(res.body.data.porCarrera)).toBe(true);
  });

  it('retorna 403 si lo llama un estudiante', async () => {
    const res = await request(app)
      .get('/api/admin/estudiantes/estadisticas')
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect(res.status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// VER USUARIO POR ID
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/admin/estudiantes/:id', () => {

  it('retorna 200 con los datos del usuario', async () => {
    const res = await request(app)
      .get(`/api/admin/estudiantes/${estudiante.userId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id.toString()).toBe(estudiante.userId);
    expect(res.body.data.password).toBeUndefined();
  });

  it('retorna 404 con un ID inexistente', async () => {
    const res = await request(app)
      .get('/api/admin/estudiantes/64a000000000000000000000')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(404);
  });

  it('retorna 403 si lo llama un estudiante', async () => {
    const res = await request(app)
      .get(`/api/admin/estudiantes/${estudiante.userId}`)
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect(res.status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// CAMBIAR ESTADO DE USUARIO
// ══════════════════════════════════════════════════════════════════════════════
describe('PATCH /api/admin/estudiantes/:id/estado', () => {

  it('retorna 200 y cambia el estado a inactivo', async () => {
    const otro = await crearEstudiante();
    const res = await request(app)
      .patch(`/api/admin/estudiantes/${otro.userId}/estado`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ estado: 'inactivo' });
    expect(res.status).toBe(200);
    expect(res.body.data.estado).toBe('inactivo');
  });

  it('retorna 400 si el admin intenta cambiar su propio estado', async () => {
    const res = await request(app)
      .patch(`/api/admin/estudiantes/${admin.userId}/estado`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ estado: 'inactivo' });
    expect(res.status).toBe(400);
  });

  it('retorna 400 si el estado enviado no es válido', async () => {
    const res = await request(app)
      .patch(`/api/admin/estudiantes/${estudiante.userId}/estado`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ estado: 'suspendido' });
    expect(res.status).toBe(400);
  });

  it('retorna 400 si el usuario ya tiene ese estado', async () => {
    const res = await request(app)
      .patch(`/api/admin/estudiantes/${estudiante.userId}/estado`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ estado: 'activo' }); // ya está activo
    expect(res.status).toBe(400);
  });

  it('retorna 400 si no se envía el campo estado', async () => {
    const res = await request(app)
      .patch(`/api/admin/estudiantes/${estudiante.userId}/estado`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('retorna 403 si lo llama un estudiante', async () => {
    const otro = await crearEstudiante();
    const res = await request(app)
      .patch(`/api/admin/estudiantes/${otro.userId}/estado`)
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send({ estado: 'inactivo' });
    expect(res.status).toBe(403);
  });
});
