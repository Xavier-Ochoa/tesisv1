/**
 * Sprint 2 — IA (Hugging Face) + Likes y Comentarios
 *
 * La llamada a Hugging Face se mockea para no depender de la API externa.
 * Se verifica que el endpoint valide inputs y formatee bien la respuesta.
 *
 * Endpoints cubiertos:
 *   POST    /api/ia/generar-titulo
 *   POST    /api/proyectos/:id/like
 *   DELETE  /api/proyectos/:id/like
 *   POST    /api/proyectos/:id/comentarios
 *   DELETE  /api/proyectos/:id/comentarios/:comentarioId
 */

import { jest } from '@jest/globals';

// ── Mock de node-fetch para la llamada a Hugging Face ────────────────────────
// En ESM (sin babel), jest.mock() no se hoistea por encima de los imports
// estáticos. Usamos jest.unstable_mockModule + import() dinámico para que
// el mock esté activo ANTES de que se cargue src/server.js (y, con él,
// ia_controller.js, que importa 'node-fetch').
jest.unstable_mockModule('node-fetch', () => ({
  default: jest.fn(() =>
    Promise.resolve({
      ok:   true,
      json: () =>
        Promise.resolve({
          choices: [{
            message: {
              content: '{"titulos":["Sistema de Gestión Inteligente","Plataforma de Monitoreo Adaptativo","Herramienta de Análisis Automatizado"]}'
            }
          }]
        })
    })
  ),
}));

const request    = (await import('supertest')).default;
const { conectarBD, desconectarBD, limpiarBD } = await import('../../dbHelper.js');
const Proyecto   = (await import('../../../src/models/Proyecto.js')).default;
const Estudiante = (await import('../../../src/models/Estudiante.js')).default;
const app        = (await import('../../../src/server.js')).default;
const { crearEstudiante, crearAdmin, bodyProyectoValido } = await import('../../helpers.js');

// ─── Setup / Teardown ─────────────────────────────────────────────────────────
let estudiante;
let admin;
let proyectoId;

beforeAll(async () => {
  await conectarBD();
  estudiante = await crearEstudiante();
  admin      = await crearAdmin();

  // Crear y publicar un proyecto para los tests de likes/comentarios
  const res = await request(app)
    .post('/api/proyectos')
    .set('Authorization', `Bearer ${estudiante.token}`)
    .send(bodyProyectoValido);
  proyectoId = res.body.data._id;

  await request(app)
    .put(`/api/admin/proyectos/${proyectoId}/aprobar`)
    .set('Authorization', `Bearer ${admin.token}`);

  await request(app)
    .put(`/api/proyectos/${proyectoId}/publicar`)
    .set('Authorization', `Bearer ${estudiante.token}`);
});

afterAll(async () => {
  await Proyecto.deleteMany({});
  await Estudiante.deleteMany({});
  await desconectarBD();
});
// ─────────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// SUGERENCIA DE TÍTULOS CON IA
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/ia/generar-titulo', () => {

  it('retorna 200 con un array de 3 títulos sugeridos', async () => {
    // HF_API_TOKEN necesario para pasar la validación del controlador
    process.env.HF_API_TOKEN = 'token-mock-para-tests';

    const res = await request(app)
      .post('/api/ia/generar-titulo')
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send({ descripcion: 'Sistema web para gestionar proyectos académicos de estudiantes universitarios con seguimiento en tiempo real.' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.titulos)).toBe(true);
    expect(res.body.data.titulos.length).toBe(3);
    expect(res.body.data.modelo).toBeDefined();
  });

  it('retorna 400 si la descripción tiene menos de 15 caracteres', async () => {
    const res = await request(app)
      .post('/api/ia/generar-titulo')
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send({ descripcion: 'Muy corta' });
    expect(res.status).toBe(400);
  });

  it('retorna 400 si no se envía descripción', async () => {
    const res = await request(app)
      .post('/api/ia/generar-titulo')
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app)
      .post('/api/ia/generar-titulo')
      .send({ descripcion: 'Descripción suficientemente larga para pasar la validación del endpoint.' });
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DAR LIKE
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/proyectos/:id/like', () => {

  afterEach(async () => {
    // Limpiar likes entre tests
    await Proyecto.findByIdAndUpdate(proyectoId, { $set: { likes: [] } });
  });

  it('retorna 200 y agrega el like correctamente', async () => {
    const otro = await crearEstudiante();
    const res  = await request(app)
      .post(`/api/proyectos/${proyectoId}/like`)
      .set('Authorization', `Bearer ${otro.token}`);

    expect(res.status).toBe(200);
    const p = await Proyecto.findById(proyectoId);
    expect(p.likes).toContainEqual(expect.objectContaining({ toString: expect.any(Function) }));
  });

  it('retorna 200 si el usuario ya dio like (idempotente, no duplica)', async () => {
    const otro = await crearEstudiante();
    await request(app).post(`/api/proyectos/${proyectoId}/like`)
      .set('Authorization', `Bearer ${otro.token}`);

    const res = await request(app)
      .post(`/api/proyectos/${proyectoId}/like`)
      .set('Authorization', `Bearer ${otro.token}`);
    expect(res.status).toBe(200);

    const p = await Proyecto.findById(proyectoId);
    const likeIds = p.likes.map(id => id.toString());
    const ocurrencias = likeIds.filter(id => id === otro.userId).length;
    expect(ocurrencias).toBe(1);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app).post(`/api/proyectos/${proyectoId}/like`);
    expect(res.status).toBe(401);
  });

  it('retorna 404 con ID de proyecto inexistente', async () => {
    const res = await request(app)
      .post('/api/proyectos/64a000000000000000000000/like')
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect(res.status).toBe(404);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// QUITAR LIKE
// ══════════════════════════════════════════════════════════════════════════════
describe('DELETE /api/proyectos/:id/like', () => {

  it('retorna 200 y quita el like correctamente', async () => {
    const otro = await crearEstudiante();
    await request(app).post(`/api/proyectos/${proyectoId}/like`)
      .set('Authorization', `Bearer ${otro.token}`);

    const res = await request(app)
      .delete(`/api/proyectos/${proyectoId}/like`)
      .set('Authorization', `Bearer ${otro.token}`);
    expect(res.status).toBe(200);

    const p = await Proyecto.findById(proyectoId);
    const likeIds = p.likes.map(id => id.toString());
    expect(likeIds).not.toContain(otro.userId);
  });

  it('retorna 200 si el usuario no había dado like (idempotente)', async () => {
    const otro = await crearEstudiante();
    const res  = await request(app)
      .delete(`/api/proyectos/${proyectoId}/like`)
      .set('Authorization', `Bearer ${otro.token}`);
    expect(res.status).toBe(200);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app).delete(`/api/proyectos/${proyectoId}/like`);
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AGREGAR COMENTARIO
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/proyectos/:id/comentarios', () => {

  it('retorna 201 y agrega el comentario', async () => {
    const res = await request(app)
      .post(`/api/proyectos/${proyectoId}/comentarios`)
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send({ texto: 'Excelente proyecto, muy bien documentado.' });

    expect(res.status).toBe(201);

    const p = await Proyecto.findById(proyectoId);
    expect(p.comentarios.length).toBeGreaterThanOrEqual(1);
  });

  it('retorna 400 si el texto está vacío', async () => {
    const res = await request(app)
      .post(`/api/proyectos/${proyectoId}/comentarios`)
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send({ texto: '' });
    expect(res.status).toBe(400);
  });

  it('retorna 400 si no se envía texto', async () => {
    const res = await request(app)
      .post(`/api/proyectos/${proyectoId}/comentarios`)
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app)
      .post(`/api/proyectos/${proyectoId}/comentarios`)
      .send({ texto: 'Comentario sin autenticar.' });
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// VERIFICAR ACCESO INTERACCIÓN — colaborador en proyecto no público
// Hallazgo #14: verificarAccesoInteraccion solo permite autor o proyecto público.
// Un colaborador que no es autor queda excluido de like/comentario en proyectos
// no publicados; este comportamiento no estaba documentado ni testeado.
// ══════════════════════════════════════════════════════════════════════════════
describe('verificarAccesoInteraccion — colaborador en proyecto no público (hallazgo #14)', () => {

  let docenteAutor;
  let colaboradorEstudiante;
  let proyectoPrivadoId;

  beforeAll(async () => {
    const { crearUsuarioYToken } = await import('../../helpers.js');

    docenteAutor = await crearUsuarioYToken({
      nombre:  'DocenteInteraccion', apellido: 'Test',
      cedula:  '1756600001',
      email:   'docente.interaccion@epn.edu.ec',
      rol:     'docente',
      carrera: 'Desarrollo de Software',
    });
    colaboradorEstudiante = await crearUsuarioYToken({
      nombre:  'ColabInteraccion', apellido: 'Test',
      cedula:  '1756600002',
      email:   'colab.interaccion@epn.edu.ec',
      rol:     'estudiante',
      carrera: 'Desarrollo de Software',
    });

    // Crear proyecto cuyo autor es el docente — no publicado (privado)
    const resProyecto = await request(app)
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${docenteAutor.token}`)
      .send({ ...bodyProyectoValido, titulo: 'Proyecto privado para test de interaccion colaborador', enviarAlAdmin: false });
    proyectoPrivadoId = resProyecto.body.data._id;

    // Agregar al colaborador al proyecto
    await request(app)
      .post(`/api/proyectos/${proyectoPrivadoId}/colaboradores`)
      .set('Authorization', `Bearer ${docenteAutor.token}`)
      .send({ email: colaboradorEstudiante.usuario.email });
  });

  afterAll(async () => {
    await Proyecto.findByIdAndDelete(proyectoPrivadoId);
    await Estudiante.deleteOne({ email: 'docente.interaccion@epn.edu.ec' });
    await Estudiante.deleteOne({ email: 'colab.interaccion@epn.edu.ec' });
  });

  it('el colaborador (no autor) recibe 403 al intentar dar like en proyecto no público', async () => {
    const res = await request(app)
      .post(`/api/proyectos/${proyectoPrivadoId}/like`)
      .set('Authorization', `Bearer ${colaboradorEstudiante.token}`);
    // verificarAccesoInteraccion solo permite autor o publico=true;
    // el colaborador no cae en ninguno de los dos casos → 403
    expect(res.status).toBe(403);
  });

  it('el colaborador (no autor) recibe 403 al intentar comentar en proyecto no público', async () => {
    const res = await request(app)
      .post(`/api/proyectos/${proyectoPrivadoId}/comentarios`)
      .set('Authorization', `Bearer ${colaboradorEstudiante.token}`)
      .send({ texto: 'Intento de comentario de colaborador en proyecto privado.' });
    expect(res.status).toBe(403);
  });

  it('el autor sí puede dar like en su propio proyecto no público', async () => {
    const res = await request(app)
      .post(`/api/proyectos/${proyectoPrivadoId}/like`)
      .set('Authorization', `Bearer ${docenteAutor.token}`);
    // El autor siempre tiene acceso → 200
    expect(res.status).toBe(200);
    // Limpiar el like
    await Proyecto.findByIdAndUpdate(proyectoPrivadoId, { $set: { likes: [] } });
  });
});
describe('DELETE /api/proyectos/:id/comentarios/:comentarioId', () => {

  it('retorna 200 y elimina el comentario propio', async () => {
    const otro = await crearEstudiante();
    // Agregar comentario
    await request(app)
      .post(`/api/proyectos/${proyectoId}/comentarios`)
      .set('Authorization', `Bearer ${otro.token}`)
      .send({ texto: 'Comentario que será eliminado en el test.' });

    const p           = await Proyecto.findById(proyectoId);
    const comentarioId = p.comentarios[p.comentarios.length - 1]._id.toString();

    const res = await request(app)
      .delete(`/api/proyectos/${proyectoId}/comentarios/${comentarioId}`)
      .set('Authorization', `Bearer ${otro.token}`);
    expect(res.status).toBe(200);

    const actualizado = await Proyecto.findById(proyectoId);
    const ids = actualizado.comentarios.map(c => c._id.toString());
    expect(ids).not.toContain(comentarioId);
  });

  it('retorna 403 si otro usuario intenta eliminar el comentario ajeno', async () => {
    const autorComentario = await crearEstudiante();
    const otroUsuario     = await crearEstudiante();

    await request(app)
      .post(`/api/proyectos/${proyectoId}/comentarios`)
      .set('Authorization', `Bearer ${autorComentario.token}`)
      .send({ texto: 'Comentario ajeno que no puede borrar otro usuario.' });

    const p           = await Proyecto.findById(proyectoId);
    const comentarioId = p.comentarios[p.comentarios.length - 1]._id.toString();

    const res = await request(app)
      .delete(`/api/proyectos/${proyectoId}/comentarios/${comentarioId}`)
      .set('Authorization', `Bearer ${otroUsuario.token}`);
    expect(res.status).toBe(403);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app)
      .delete(`/api/proyectos/${proyectoId}/comentarios/64a000000000000000000000`);
    expect(res.status).toBe(401);
  });
});