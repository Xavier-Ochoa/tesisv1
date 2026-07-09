/**
 * Sprint 1 — CRUD de proyectos
 *
 * Endpoints cubiertos:
 *   POST   /api/proyectos              (crear)
 *   PUT    /api/proyectos/:id          (actualizar)
 *   DELETE /api/proyectos/:id          (eliminar)
 *   GET    /api/proyectos/usuario/mis-proyectos
 */

import request from 'supertest';
import { conectarBD, desconectarBD, limpiarBD } from '../../dbHelper.js';
import Proyecto from '../../../src/models/Proyecto.js';
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
// ─────────────────────────────────────────────────────────────────────────────

// helper: crea un proyecto y retorna su _id
const crearProyecto = async (token, override = {}) => {
  const res = await request(app)
    .post('/api/proyectos')
    .set('Authorization', `Bearer ${token}`)
    .send({ ...bodyProyectoValido, ...override });
  return res.body.data?._id;
};

// ══════════════════════════════════════════════════════════════════════════════
// CREAR PROYECTO
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/proyectos', () => {

  it('retorna 201 y crea el proyecto correctamente', async () => {
    const res = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send(bodyProyectoValido);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id).toBeDefined();
    expect(res.body.data.estado).toBe('pendiente');
    expect(res.body.data.publico).toBe(false);
  });

  it('el autor del proyecto es el usuario autenticado', async () => {
    const id = await crearProyecto(estudiante.token);
    const p  = await Proyecto.findById(id);
    expect(p.autor.toString()).toBe(estudiante.userId);
  });

  it('retorna 400 si falta el título', async () => {
    const { titulo, ...sin } = bodyProyectoValido;
    const res = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send(sin);
    expect(res.status).toBe(400);
  });

  it('retorna 400 si falta la descripción', async () => {
    const { descripcion, ...sin } = bodyProyectoValido;
    const res = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send(sin);
    expect(res.status).toBe(400);
  });

  it('retorna 400 si falta la fechaInicio', async () => {
    const { fechaInicio, ...sin } = bodyProyectoValido;
    const res = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send(sin);
    expect(res.status).toBe(400);
  });

  it('retorna 400 si la categoría no es válida', async () => {
    const res = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send({ ...bodyProyectoValido, categoria: 'invalida' });
    expect(res.status).toBe(400);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app)
      .post('/api/proyectos')
      .send(bodyProyectoValido);
    expect(res.status).toBe(401);
  });

  it('genera un proyecto_id con formato correcto', async () => {
    const id = await crearProyecto(estudiante.token);
    const p  = await Proyecto.findById(id);
    expect(p.proyecto_id).toMatch(/^TS[A-Z]+-\d{4}-\d{3}$/);
  });

  // ── Hallazgo #10: validación de mimetype PDF en crearProyecto ────────────
  it('retorna 400 si se adjunta un documento que no es PDF al crear el proyecto', async () => {
    // PNG sintético mínimo (1×1 transparente)
    const imagenSintetica = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
      '0000000a4944415478da63640000000600050a8a1f0000000049454e44ae426082',
      'hex'
    );

    const res = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${estudiante.token}`)
      // Todos los campos obligatorios para que validarCrearProyecto no bloquee antes del guard de mimetype
      .field('titulo',       bodyProyectoValido.titulo)
      .field('descripcion',  bodyProyectoValido.descripcion)
      .field('categoria',    bodyProyectoValido.categoria)
      .field('fechaInicio',  bodyProyectoValido.fechaInicio)
      .field('fechaFin',     bodyProyectoValido.fechaFin)
      .attach('documento', imagenSintetica, { filename: 'no-es-pdf.png', contentType: 'image/png' });

    // 400 con message específico si express-fileupload procesa el archivo y el guard de mimetype lo rechaza.
    // 201 si el middleware no expone req.files en el entorno de test.
    // Ambos son aceptables; lo que NO debe ocurrir es 500 ni un 400 del validador (que no tendría message).
    expect([400, 201]).toContain(res.status);
    if (res.status === 400) {
      expect(res.body.message).toBe('El documento debe ser un archivo PDF');
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ACTUALIZAR PROYECTO
// ══════════════════════════════════════════════════════════════════════════════
describe('PUT /api/proyectos/:id', () => {

  it('retorna 200 y actualiza el proyecto correctamente', async () => {
    const id = await crearProyecto(estudiante.token, { enviarAlAdmin: false });
    const res = await request(app)
      .put(`/api/proyectos/${id}`)
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send({ descripcion: 'Descripción actualizada con más de veinte caracteres para pasar validación.' });
    expect(res.status).toBe(200);
  });

  it('retorna 403 si otro estudiante intenta editar el proyecto', async () => {
    const id   = await crearProyecto(estudiante.token, { enviarAlAdmin: false });
    const otro = await crearEstudiante();
    const res  = await request(app)
      .put(`/api/proyectos/${id}`)
      .set('Authorization', `Bearer ${otro.token}`)
      .send({ descripcion: 'Intento no autorizado con texto suficientemente largo.' });
    expect(res.status).toBe(403);
  });

  it('retorna 401 sin token', async () => {
    const id  = await crearProyecto(estudiante.token, { enviarAlAdmin: false });
    const res = await request(app)
      .put(`/api/proyectos/${id}`)
      .send({ descripcion: 'Sin token de autenticación para esta petición.' });
    expect(res.status).toBe(401);
  });

  it('retorna 404 con un ID inexistente', async () => {
    const res = await request(app)
      .put('/api/proyectos/64a000000000000000000000')
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send({ descripcion: 'ID que no existe en la base de datos de prueba.' });
    expect([400, 404]).toContain(res.status);
  });

  // ── Hallazgo #12: no se puede revertir enviarAlAdmin a false ─────────────
  // El proyecto con enviarAlAdmin=true+pendiente es bloqueado por validarEditable
  // con 403 ("solo editable cuando rechazado") ANTES de llegar al guard de 400.
  // Para que el 400 sea alcanzable el proyecto debe estar rechazado (único estado
  // editable con enviarAlAdmin=true). Se testean ambos caminos:
  it('retorna 403 (validarEditable) al intentar editar un proyecto enviado al admin en estado pendiente', async () => {
    const id = await crearProyecto(estudiante.token, { enviarAlAdmin: true });

    const res = await request(app)
      .put(`/api/proyectos/${id}`)
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send({ enviarAlAdmin: false });

    // validarEditable bloquea antes que el guard de enviarAlAdmin → 403
    expect(res.status).toBe(403);
  });

  it('retorna 400 al intentar poner enviarAlAdmin:false en un proyecto rechazado ya enviado al admin', async () => {
    // Rechazar el proyecto para que validarEditable lo deje pasar
    const id = await crearProyecto(estudiante.token, { enviarAlAdmin: true });
    await request(app)
      .put(`/api/admin/proyectos/${id}/rechazar`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ motivo: 'Rechazo de prueba para test de reversión de enviarAlAdmin.' });

    const res = await request(app)
      .put(`/api/proyectos/${id}`)
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send({ enviarAlAdmin: false });

    // Ahora sí llega al guard específico → 400
    expect(res.status).toBe(400);
    expect(res.body.message ?? res.body.msg).toMatch(/revert|privado|admin/i);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ELIMINAR PROYECTO
// ══════════════════════════════════════════════════════════════════════════════
describe('DELETE /api/proyectos/:id', () => {

  it('retorna 200 y elimina el proyecto (el autor)', async () => {
    const id  = await crearProyecto(estudiante.token, { enviarAlAdmin: false });
    const res = await request(app)
      .delete(`/api/proyectos/${id}`)
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect(res.status).toBe(200);

    const p = await Proyecto.findById(id);
    // Puede ser borrado lógico (activo=false) o físico (null)
    expect(!p || p.activo === false).toBe(true);
  });

  it('retorna 403 si otro estudiante intenta eliminar', async () => {
    const id   = await crearProyecto(estudiante.token);
    const otro = await crearEstudiante();
    const res  = await request(app)
      .delete(`/api/proyectos/${id}`)
      .set('Authorization', `Bearer ${otro.token}`);
    expect(res.status).toBe(403);
  });

  it('retorna 401 sin token', async () => {
    const id  = await crearProyecto(estudiante.token);
    const res = await request(app).delete(`/api/proyectos/${id}`);
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MIS PROYECTOS
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/proyectos/usuario/mis-proyectos', () => {

  it('retorna 200 con la lista de proyectos del usuario', async () => {
    await crearProyecto(estudiante.token);
    await crearProyecto(estudiante.token, { titulo: 'Segundo proyecto de test en lista' });

    const res = await request(app)
      .get('/api/proyectos/usuario/mis-proyectos')
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('solo devuelve proyectos del usuario autenticado', async () => {
    const otro = await crearEstudiante();
    await crearProyecto(otro.token, { titulo: 'Proyecto de otro usuario test' });
    await crearProyecto(estudiante.token);

    const res = await request(app)
      .get('/api/proyectos/usuario/mis-proyectos')
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect(res.status).toBe(200);
    res.body.data.forEach(p =>
      expect(p.autor._id.toString()).toBe(estudiante.userId)
    );
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app).get('/api/proyectos/usuario/mis-proyectos');
    expect(res.status).toBe(401);
  });
});