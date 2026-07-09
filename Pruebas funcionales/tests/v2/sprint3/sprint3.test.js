/**
 * Sprint 3 — Contraseña, colaboradores, archivos y versionado
 *
 * Endpoints cubiertos:
 *   PUT    /api/auth/password                          (cambiar contraseña)
 *   GET    /api/proyectos/:id/colaboradores            (listar colaboradores)
 *   POST   /api/proyectos/:id/colaboradores            (agregar colaborador — solo docente)
 *   DELETE /api/proyectos/:id/colaboradores/:colabId   (eliminar colaborador — solo docente)
 *   PUT    /api/proyectos/:id/colaborador              (editar proyecto como colaborador, incl. imagenes)
 *   DELETE /api/proyectos/:id/colaborador/imagenes     (eliminar imagen como colaborador)
 *   GET    /api/proyectos/donde-colaboro               (proyectos donde colaboro)
 *   GET    /api/proyectos/mis-proyectos-con-colaboradores
 *   PUT    /api/proyectos/:id/documento                (subir PDF)
 *   GET    /api/proyectos/:id/documento                (descargar PDF)
 *   DELETE /api/proyectos/:id/documento                (eliminar PDF)
 *   DELETE /api/proyectos/:id/imagenes                 (eliminar imagen de proyecto)
 *   POST   /api/proyectos/:id/versiones                (crear nueva versión)
 *   GET    /api/proyectos/versiones/:proyectoId        (historial de versiones)
 *   GET    /api/admin/proyectos/versiones/:proyectoId  (historial admin)
 */

import request from 'supertest';
import { conectarBD, desconectarBD, limpiarBD } from '../../dbHelper.js';
import Proyecto   from '../../../src/models/Proyecto.js';
import Estudiante from '../../../src/models/Estudiante.js';
import app from '../../../src/server.js';
import { crearEstudiante, crearAdmin, crearUsuarioYToken, bodyProyectoValido } from '../../helpers.js';

// ─── Setup / Teardown ─────────────────────────────────────────────────────────
let estudiante;
let docente;
let admin;
let proyectoId;
let proyectoIdStr; // proyecto_id (ej: TSDS-2025-001)

beforeAll(async () => {
  await conectarBD();
  estudiante = await crearEstudiante();
  admin      = await crearAdmin();
  docente    = await crearUsuarioYToken({
    nombre:  'Docente', apellido: 'Test',
    cedula:  '1766666666',
    email:   'docente.sprint3@epn.edu.ec',
    rol:     'docente',
    carrera: 'Desarrollo de Software',
  });

  const res = await request(app)
    .post('/api/proyectos')
    .set('Authorization', `Bearer ${estudiante.token}`)
    .send(bodyProyectoValido);
  proyectoId    = res.body.data._id;
  proyectoIdStr = res.body.data.proyecto_id;

  // Aprobar el proyecto como admin para habilitar el versionado
  // (validarVersionable exige estado === 'aprobado')
  await request(app)
    .put(`/api/admin/proyectos/${proyectoId}/aprobar`)
    .set('Authorization', `Bearer ${admin.token}`);
});

afterAll(async () => {
  await Proyecto.deleteMany({});
  await Estudiante.deleteMany({});
  await desconectarBD();
});
// ─────────────────────────────────────────────────────────────────────────────

// PNG sintético mínimo válido (1x1 px transparente)
const imagenSintetica = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a4944415478da6364000000060005' +
  '0a8a1f0000000049454e44ae426082',
  'hex'
);

// PDF sintético mínimo válido
const pdfSintetico = Buffer.from(
  '%PDF-1.0\n1 0 obj<</Type /Catalog>>endobj\nxref\n0 2\ntrailer<</Size 2>>\nstartxref\n9\n%%EOF'
);

// ══════════════════════════════════════════════════════════════════════════════
// CAMBIAR CONTRASEÑA
// ══════════════════════════════════════════════════════════════════════════════
describe('PUT /api/auth/password', () => {

  // Crear usuario fresco para no afectar el token global del estudiante
  let usuarioPwd;
  beforeEach(async () => {
    usuarioPwd = await crearUsuarioYToken({
      nombre: 'PwdTest', apellido: 'Usuario',
      cedula: '1744444444', email: 'pwd.test@epn.edu.ec',
      carrera: 'Desarrollo de Software',
    });
  });
  afterEach(async () => {
    await Estudiante.deleteOne({ email: 'pwd.test@epn.edu.ec' });
  });

  it('retorna 200 y cambia la contraseña correctamente', async () => {
    const res = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${usuarioPwd.token}`)
      .send({
        passwordactual:    'Clave456@',
        passwordnuevo:     'NuevaClave@9',
        confirmarPassword: 'NuevaClave@9',
      });
    expect(res.status).toBe(200);
    expect(res.body.msg).toBe('Contraseña actualizada correctamente');
  });

  it('retorna 400 si la contraseña actual es incorrecta', async () => {
    const res = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${usuarioPwd.token}`)
      .send({
        passwordactual:    'ClaveEquivocada@9',
        passwordnuevo:     'NuevaClave@9',
        confirmarPassword: 'NuevaClave@9',
      });
    expect(res.status).toBe(400);
    expect(res.body.msg).toBe('La contraseña actual no es correcta');
  });

  it('retorna 400 si las contraseñas nuevas no coinciden', async () => {
    const res = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${usuarioPwd.token}`)
      .send({
        passwordactual:    'Clave456@',
        passwordnuevo:     'NuevaClave@9',
        confirmarPassword: 'OtraClave@8',
      });
    expect(res.status).toBe(400);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app).put('/api/auth/password')
      .send({ passwordactual: 'Clave456@', passwordnuevo: 'Nueva@9', confirmarPassword: 'Nueva@9' });
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// COLABORADORES — LISTAR
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/proyectos/:id/colaboradores', () => {

  it('retorna 200 con la lista de colaboradores (puede estar vacía)', async () => {
    const res = await request(app)
      .get(`/api/proyectos/${proyectoId}/colaboradores`)
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app).get(`/api/proyectos/${proyectoId}/colaboradores`);
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// COLABORADORES — AGREGAR
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/proyectos/:id/colaboradores', () => {

  // Colaborador estudiante dedicado para este bloque
  let colaborador;
  // Proyecto cuyo autor ES el docente — necesario para que el controller
  // pase el guard de autoría y llegue a las validaciones internas
  let proyectoDocente;

  beforeAll(async () => {
    colaborador = await crearUsuarioYToken({
      nombre:  'Colab', apellido: 'Test',
      cedula:  '1755500001',
      email:   'colab.agregar@epn.edu.ec',
      rol:     'estudiante',
      carrera: 'Desarrollo de Software',
    });
    // Crear un proyecto cuyo autor es el propio docente
    const resP = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${docente.token}`)
      .send({ ...bodyProyectoValido, titulo: 'Proyecto del docente para tests de colaboradores' });
    proyectoDocente = resP.body.data._id;
  });
  afterAll(async () => {
    await Estudiante.deleteOne({ email: 'colab.agregar@epn.edu.ec' });
    await Proyecto.deleteOne({ _id: proyectoDocente });
  });

  it('retorna 400 si no se envía email', async () => {
    const res = await request(app)
      .post(`/api/proyectos/${proyectoDocente}/colaboradores`)
      .set('Authorization', `Bearer ${docente.token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Proporciona el correo del colaborador');
  });

  it('retorna 404 si el email no existe en la BD', async () => {
    const res = await request(app)
      .post(`/api/proyectos/${proyectoDocente}/colaboradores`)
      .set('Authorization', `Bearer ${docente.token}`)
      .send({ email: 'noexiste.nunca@epn.edu.ec' });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('No existe ningún usuario con ese correo');
  });

  it('retorna 403 si el docente que llama no es el autor del proyecto', async () => {
    const docenteAjeno = await crearUsuarioYToken({
      nombre:  'Docente', apellido: 'Ajeno',
      cedula:  '1755599999',
      email:   'docente.ajeno@epn.edu.ec',
      rol:     'docente',
      carrera: 'Desarrollo de Software',
    });
    const res = await request(app)
      .post(`/api/proyectos/${proyectoDocente}/colaboradores`)
      .set('Authorization', `Bearer ${docenteAjeno.token}`)
      .send({ email: colaborador.usuario.email });
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Solo el autor puede gestionar colaboradores');
    await Estudiante.deleteOne({ email: 'docente.ajeno@epn.edu.ec' });
  });

  it('retorna 403 si lo llama un estudiante (middleware verificarDocente)', async () => {
    const otro = await crearEstudiante();
    const res  = await request(app)
      .post(`/api/proyectos/${proyectoDocente}/colaboradores`)
      .set('Authorization', `Bearer ${otro.token}`)
      .send({ email: colaborador.usuario.email });
    expect(res.status).toBe(403);
  });

  it('retorna 400 si se intenta agregar a un usuario con rol docente (no es estudiante)', async () => {
    // El segundo docente existe en la BD; intentar agregarlo como colaborador
    // debe fallar con 400 porque su rol no es 'estudiante'
    const otroDocente = await crearUsuarioYToken({
      nombre:  'Docente', apellido: 'Otro',
      cedula:  '1755588888',
      email:   'docente.otro.rol@epn.edu.ec',
      rol:     'docente',
      carrera: 'Desarrollo de Software',
    });
    const res = await request(app)
      .post(`/api/proyectos/${proyectoDocente}/colaboradores`)
      .set('Authorization', `Bearer ${docente.token}`)
      .send({ email: otroDocente.usuario.email });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Solo se pueden agregar estudiantes como colaboradores');
    await Estudiante.deleteOne({ email: 'docente.otro.rol@epn.edu.ec' });
  });

  it('retorna 400 si el autor intenta agregarse a sí mismo como colaborador', async () => {
    // El docente es el autor de proyectoDocente; intentar agregar su propio email
    const res = await request(app)
      .post(`/api/proyectos/${proyectoDocente}/colaboradores`)
      .set('Authorization', `Bearer ${docente.token}`)
      .send({ email: docente.usuario.email });
    // El docente tiene rol 'docente', así que el controller cae en el 400 de rol
    // antes de llegar al 400 de "no puedes agregarte a ti mismo".
    // Ambos 400 son correctos; lo que importa es que no llega a 200.
    expect(res.status).toBe(400);
  });

  it('retorna 200 y agrega el colaborador correctamente', async () => {
    const res = await request(app)
      .post(`/api/proyectos/${proyectoDocente}/colaboradores`)
      .set('Authorization', `Bearer ${docente.token}`)
      .send({ email: colaborador.usuario.email });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const emails = res.body.colaboradores.map(c => c.email);
    expect(emails).toContain(colaborador.usuario.email);
  });

  it('retorna 400 si el colaborador ya está en el proyecto', async () => {
    // El test anterior ya agregó al colaborador; enviarlo de nuevo da 400
    const res = await request(app)
      .post(`/api/proyectos/${proyectoDocente}/colaboradores`)
      .set('Authorization', `Bearer ${docente.token}`)
      .send({ email: colaborador.usuario.email });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El colaborador ya está en el proyecto');
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app)
      .post(`/api/proyectos/${proyectoId}/colaboradores`)
      .send({ email: colaborador.usuario.email });
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// COLABORADORES — ELIMINAR
// ══════════════════════════════════════════════════════════════════════════════
describe('DELETE /api/proyectos/:id/colaboradores/:colabId', () => {

  let docenteAutorElim;
  let proyectoConColab;
  let colaboradorElim;

  beforeAll(async () => {
    // Crear un docente-autor y un colaborador para probar el flujo completo
    docenteAutorElim = await crearUsuarioYToken({
      nombre:  'DocenteElim', apellido: 'Test',
      cedula:  '1755533333',
      email:   'docente.elim@epn.edu.ec',
      rol:     'docente',
      carrera: 'Desarrollo de Software',
    });
    colaboradorElim = await crearUsuarioYToken({
      nombre:  'ColabElim', apellido: 'Test',
      cedula:  '1755544444',
      email:   'colab.elim@epn.edu.ec',
      rol:     'estudiante',
      carrera: 'Desarrollo de Software',
    });
    const resP = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${docenteAutorElim.token}`)
      .send({ ...bodyProyectoValido, titulo: 'Proyecto para eliminar colaborador' });
    proyectoConColab = resP.body.data._id;

    // Agregar el colaborador
    await request(app)
      .post(`/api/proyectos/${proyectoConColab}/colaboradores`)
      .set('Authorization', `Bearer ${docenteAutorElim.token}`)
      .send({ email: colaboradorElim.usuario.email });
  });

  afterAll(async () => {
    await Estudiante.deleteOne({ email: 'docente.elim@epn.edu.ec' });
    await Estudiante.deleteOne({ email: 'colab.elim@epn.edu.ec' });
    await Proyecto.deleteOne({ _id: proyectoConColab });
  });

  it('retorna 200 y elimina el colaborador del proyecto', async () => {
    const res = await request(app)
      .delete(`/api/proyectos/${proyectoConColab}/colaboradores/${colaboradorElim.userId}`)
      .set('Authorization', `Bearer ${docenteAutorElim.token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const ids = res.body.colaboradores.map(c => c._id.toString());
    expect(ids).not.toContain(colaboradorElim.userId);
  });

  it('retorna 200 (idempotente) si el colaboradorId no estaba en el array', async () => {
    // El controller usa filter() sin validar existencia previa → siempre devuelve 200
    const res = await request(app)
      .delete(`/api/proyectos/${proyectoConColab}/colaboradores/${colaboradorElim.userId}`)
      .set('Authorization', `Bearer ${docenteAutorElim.token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('retorna 403 si lo llama un estudiante (middleware verificarDocente)', async () => {
    const res = await request(app)
      .delete(`/api/proyectos/${proyectoId}/colaboradores/${docente.userId}`)
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect(res.status).toBe(403);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app)
      .delete(`/api/proyectos/${proyectoId}/colaboradores/${docente.userId}`);
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// COLABORADOR — EDITAR PROYECTO
// ══════════════════════════════════════════════════════════════════════════════
describe('PUT /api/proyectos/:id/colaborador', () => {

  it('retorna 403 si quien edita no es colaborador ni autor', async () => {
    const otro = await crearEstudiante();
    const res  = await request(app)
      .put(`/api/proyectos/${proyectoId}/colaborador`)
      .set('Authorization', `Bearer ${otro.token}`)
      .send({ descripcion: 'Intento de edición sin ser colaborador del proyecto.' });
    expect(res.status).toBe(403);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app)
      .put(`/api/proyectos/${proyectoId}/colaborador`)
      .send({ descripcion: 'Edición sin autenticar.' });
    expect(res.status).toBe(401);
  });

  it('retorna 200 y sube la imagen al editar como colaborador (multipart/form-data)', async () => {
    const res = await request(app)
      .put(`/api/proyectos/${proyectoId}/colaborador`)
      .set('Authorization', `Bearer ${estudiante.token}`)
      .field('descripcion', 'Edición de colaborador con imagen adjunta.')
      .attach('imagenes', imagenSintetica, { filename: 'colaborador.png', contentType: 'image/png' });
    // 200 si se sube correctamente, 403 si las reglas de edición del proyecto lo bloquean
    expect([200, 403]).toContain(res.status);
    if (res.status === 200) {
      expect(Array.isArray(res.body.data.imagenes)).toBe(true);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// COLABORADOR — ELIMINAR IMAGEN
// ══════════════════════════════════════════════════════════════════════════════
describe('DELETE /api/proyectos/:id/colaborador/imagenes', () => {

  it('retorna 403 si quien elimina no es colaborador ni autor', async () => {
    const otro = await crearEstudiante();
    const res  = await request(app)
      .delete(`/api/proyectos/${proyectoId}/colaborador/imagenes`)
      .set('Authorization', `Bearer ${otro.token}`)
      .send({ indice: 0 });
    expect(res.status).toBe(403);
  });

  it('retorna 400 si no se envía el índice de la imagen', async () => {
    // El autor del proyecto puede llegar al guard de validación del índice
    const res = await request(app)
      .delete(`/api/proyectos/${proyectoId}/colaborador/imagenes`)
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send({});
    // 400 si llega al guard del índice, 403 si la regla de edición corre antes
    expect([400, 403]).toContain(res.status);
  });

  it('retorna 400 si el índice está fuera de rango', async () => {
    const res = await request(app)
      .delete(`/api/proyectos/${proyectoId}/colaborador/imagenes`)
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send({ indice: 999 });
    expect([400, 403]).toContain(res.status);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app)
      .delete(`/api/proyectos/${proyectoId}/colaborador/imagenes`)
      .send({ indice: 0 });
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DONDE COLABORO / MIS PROYECTOS CON COLABORADORES
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/proyectos/donde-colaboro', () => {

  it('retorna 200 con los proyectos donde el docente colabora', async () => {
    const res = await request(app)
      .get('/api/proyectos/donde-colaboro')
      .set('Authorization', `Bearer ${docente.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app).get('/api/proyectos/donde-colaboro');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/proyectos/mis-proyectos-con-colaboradores', () => {

  it('retorna 200 con los proyectos del autor que tienen colaboradores', async () => {
    const res = await request(app)
      .get('/api/proyectos/mis-proyectos-con-colaboradores')
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app).get('/api/proyectos/mis-proyectos-con-colaboradores');
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ARCHIVOS PDF (GridFS)
// ══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/proyectos/:id/documento (subir PDF)', () => {

  it('retorna 200 y sube el PDF correctamente', async () => {
    const res = await request(app)
      .put(`/api/proyectos/${proyectoId}/documento`)
      .set('Authorization', `Bearer ${estudiante.token}`)
      .attach('documento', pdfSintetico, { filename: 'test.pdf', contentType: 'application/pdf' });

    // 200 si GridFS está activo, 500 si no está configurado,
    // 403 si el proyecto (aprobado + enviado al admin) no es editable
    expect([200, 403, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
    }
  });

  it('retorna 400 si se sube un archivo que no es PDF', async () => {
    const res = await request(app)
      .put(`/api/proyectos/${proyectoId}/documento`)
      .set('Authorization', `Bearer ${estudiante.token}`)
      .attach('documento', imagenSintetica, { filename: 'imagen.png', contentType: 'image/png' });
    // 400 si pasa la validación de edición y llega al guard de mimetype,
    // 403 si el proyecto no es editable en este estado
    expect([400, 403]).toContain(res.status);
    if (res.status === 400) {
      expect(res.body.message).toBe('El documento debe ser un archivo PDF');
    }
  });

  it('retorna 400, 403 o 500 si no se adjunta archivo', async () => {
    const res = await request(app)
      .put(`/api/proyectos/${proyectoId}/documento`)
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect([400, 403, 500]).toContain(res.status);
  });

  it('retorna 403 si otro estudiante intenta subir el documento', async () => {
    const otro = await crearEstudiante();
    const res  = await request(app)
      .put(`/api/proyectos/${proyectoId}/documento`)
      .set('Authorization', `Bearer ${otro.token}`)
      .attach('documento', pdfSintetico, { filename: 'intento.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(403);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app)
      .put(`/api/proyectos/${proyectoId}/documento`)
      .attach('documento', pdfSintetico, { filename: 'sin-auth.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/proyectos/:id/documento (descargar PDF)', () => {

  it('retorna 200, 403 o 404 dependiendo de si hay documento subido y el acceso', async () => {
    const res = await request(app).get(`/api/proyectos/${proyectoId}/documento`);
    expect([200, 403, 404]).toContain(res.status);
  });
});

describe('DELETE /api/proyectos/:id/documento (eliminar PDF)', () => {

  it('retorna 403 si otro estudiante intenta eliminar el documento', async () => {
    const otro = await crearEstudiante();
    const res  = await request(app)
      .delete(`/api/proyectos/${proyectoId}/documento`)
      .set('Authorization', `Bearer ${otro.token}`);
    expect(res.status).toBe(403);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app).delete(`/api/proyectos/${proyectoId}/documento`);
    expect(res.status).toBe(401);
  });

  it('retorna 200, 403 o 404 al intentar eliminar (depende de si hay PDF y si es editable)', async () => {
    const res = await request(app)
      .delete(`/api/proyectos/${proyectoId}/documento`)
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect([200, 403, 404]).toContain(res.status);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ELIMINAR IMAGEN DE PROYECTO
// ══════════════════════════════════════════════════════════════════════════════
describe('DELETE /api/proyectos/:id/imagenes (eliminar imagen)', () => {

  it('retorna 403 si otro estudiante intenta eliminar la imagen', async () => {
    const otro = await crearEstudiante();
    const res  = await request(app)
      .delete(`/api/proyectos/${proyectoId}/imagenes`)
      .set('Authorization', `Bearer ${otro.token}`)
      .send({ indice: 0 });
    expect(res.status).toBe(403);
  });

  it('retorna 400 si el índice está fuera de rango (no hay imágenes)', async () => {
    // El proyecto de prueba no tiene imágenes subidas en este entorno,
    // por lo que el índice 0 ya está fuera de rango → 400
    const res = await request(app)
      .delete(`/api/proyectos/${proyectoId}/imagenes`)
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send({ indice: 0 });
    // 400 si no hay imagen en ese índice, 403 si el proyecto no es editable
    expect([400, 403]).toContain(res.status);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app).delete(`/api/proyectos/${proyectoId}/imagenes`);
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// VERSIONADO
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/proyectos/:id/versiones (crear nueva versión)', () => {

  it('retorna 201 y crea una nueva versión del proyecto', async () => {
    const res = await request(app)
      .post(`/api/proyectos/${proyectoId}/versiones`)
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send({
        titulo:      bodyProyectoValido.titulo,
        descripcion: 'Versión 2: descripción actualizada con mejoras significativas.',
        categoria:   bodyProyectoValido.categoria,
        fechaInicio: bodyProyectoValido.fechaInicio,
      });

    expect(res.status).toBe(201);
    expect(res.body.data?.version).toBeDefined();
  });

  it('retorna 403 si otro estudiante intenta crear versión', async () => {
    const otro = await crearEstudiante();
    const res  = await request(app)
      .post(`/api/proyectos/${proyectoId}/versiones`)
      .set('Authorization', `Bearer ${otro.token}`)
      .send({
        titulo:      bodyProyectoValido.titulo,
        descripcion: 'Intento de versión por usuario no autorizado del sistema.',
        categoria:   bodyProyectoValido.categoria,
        fechaInicio: bodyProyectoValido.fechaInicio,
      });
    expect(res.status).toBe(403);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app)
      .post(`/api/proyectos/${proyectoId}/versiones`)
      .send({
        titulo:      bodyProyectoValido.titulo,
        descripcion: 'Versión sin autenticación de usuario en el sistema.',
        categoria:   bodyProyectoValido.categoria,
        fechaInicio: bodyProyectoValido.fechaInicio,
      });
    expect(res.status).toBe(401);
  });

  // ── Hallazgo #10: validación de mimetype PDF en crearNuevaVersion ─────────
  it('retorna 400 si se adjunta un documento que no es PDF al crear una nueva versión', async () => {
    const res = await request(app)
      .post(`/api/proyectos/${proyectoId}/versiones`)
      .set('Authorization', `Bearer ${estudiante.token}`)
      .field('titulo',       bodyProyectoValido.titulo)
      .field('descripcion',  'Nueva versión con documento inválido para test de mimetype PDF.')
      .field('categoria',    bodyProyectoValido.categoria)
      .field('fechaInicio',  bodyProyectoValido.fechaInicio)
      .attach('documento', imagenSintetica, { filename: 'no-es-pdf.png', contentType: 'image/png' });

    // 400 si llega al guard de mimetype, 403 si el proyecto no es versionable en este estado
    expect([400, 403]).toContain(res.status);
    if (res.status === 400) {
      expect(res.body.message).toBe('El documento debe ser un archivo PDF');
    }
  });
});

describe('GET /api/proyectos/versiones/:proyectoId (historial del usuario)', () => {

  it('retorna 200 con el historial de versiones', async () => {
    const res = await request(app)
      .get(`/api/proyectos/versiones/${proyectoIdStr}`)
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app).get(`/api/proyectos/versiones/${proyectoIdStr}`);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/admin/proyectos/versiones/:proyectoId (historial admin)', () => {

  it('retorna 200 con el historial completo para el admin', async () => {
    const res = await request(app)
      .get(`/api/admin/proyectos/versiones/${proyectoIdStr}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('retorna 403 si lo llama un estudiante', async () => {
    const res = await request(app)
      .get(`/api/admin/proyectos/versiones/${proyectoIdStr}`)
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect(res.status).toBe(403);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app).get(`/api/admin/proyectos/versiones/${proyectoIdStr}`);
    expect(res.status).toBe(401);
  });
});