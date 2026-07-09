/**
 * PRUEBA 2 — Gestión de proyectos y colaboración
 *
 * Fusiona los antiguos archivos:
 *   05-crear-proyecto.test.js
 *   06-colaboradores.test.js
 *
 * Todo gira alrededor del proyecto: crear proyecto -> agregar colaboradores
 * -> editar como colaborador -> ver proyectos donde colabora.
 *
 * Todo contra el backend REAL en Vercel y la MongoDB REAL.
 */
import { api } from './helpers/apiClient.js';
import { crearUsuarioActivo } from './helpers/usuarios.js';
import { registrar, limpiarTodo, desconectarDB, obtenerProyectoPorId } from './helpers/dbDirect.js';
import { proyectoValido } from './helpers/fixtures.js';

afterAll(async () => {
  await limpiarTodo();
  await desconectarDB();
});

describe('5. Crear proyecto (POST /api/proyectos)', () => {
  test('un usuario autenticado crea un proyecto y queda asociado a él como autor', async () => {
    const usuario = await crearUsuarioActivo({ prefijo: 'autor' });
    const payload = proyectoValido();

    const res = await api
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${usuario.token}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.titulo).toBe(payload.titulo);
    expect(res.body.data.autor._id).toBe(usuario.id);
    expect(res.body.data.estado).toBe('pendiente');

    registrar('Proyecto', res.body.data._id);

    const proyectoDB = await obtenerProyectoPorId(res.body.data._id);
    expect(proyectoDB).not.toBeNull();
    expect(proyectoDB.autor.toString()).toBe(usuario.id);
    expect(proyectoDB.titulo).toBe(payload.titulo);
  });

  test('rechaza crear proyecto sin autenticación', async () => {
    const res = await api.post('/api/proyectos').send(proyectoValido());
    expect(res.status).toBe(401);
  });

  test('rechaza crear proyecto con datos inválidos (título muy corto)', async () => {
    const usuario = await crearUsuarioActivo({ prefijo: 'invalido' });
    const payload = proyectoValido({ titulo: 'abc' });

    const res = await api
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${usuario.token}`)
      .send(payload);

    expect(res.status).toBe(400);
  });
});

describe('6. Gestión de colaboradores', () => {
  let docente;
  let estudianteColaborador;
  let proyectoId;

  beforeAll(async () => {
    docente = await crearUsuarioActivo({ rol: 'docente', prefijo: 'docente' });
    estudianteColaborador = await crearUsuarioActivo({ rol: 'estudiante', prefijo: 'colaborador' });

    const resProyecto = await api
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${docente.token}`)
      .send(proyectoValido());
    proyectoId = resProyecto.body.data._id;
    registrar('Proyecto', proyectoId);
  });

  test('el docente (autor) agrega al estudiante como colaborador', async () => {
    const res = await api
      .post(`/api/proyectos/${proyectoId}/colaboradores`)
      .set('Authorization', `Bearer ${docente.token}`)
      .send({ email: estudianteColaborador.email });

    expect(res.status).toBe(200);
    const idsColaboradores = res.body.colaboradores.map((c) => c._id);
    expect(idsColaboradores).toContain(estudianteColaborador.id);

    const proyectoDB = await obtenerProyectoPorId(proyectoId);
    expect(proyectoDB.colaboradores.map((c) => c.toString())).toContain(estudianteColaborador.id);
  });

  test('el colaborador puede editar el proyecto', async () => {
    const res = await api
      .put(`/api/proyectos/${proyectoId}/colaborador`)
      .set('Authorization', `Bearer ${estudianteColaborador.token}`)
      .send({ descripcion: 'Descripción actualizada por el colaborador durante la prueba de integración.' });

    expect(res.status).toBe(200);
  });

  test('el proyecto aparece en "mis colaboraciones" (donde-colaboro) del colaborador', async () => {
    const res = await api
      .get('/api/proyectos/donde-colaboro')
      .set('Authorization', `Bearer ${estudianteColaborador.token}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.map((p) => p._id);
    expect(ids).toContain(proyectoId);
  });

  test('un estudiante que no es colaborador no puede editar el proyecto', async () => {
    const otroEstudiante = await crearUsuarioActivo({ rol: 'estudiante', prefijo: 'ajeno' });

    const res = await api
      .put(`/api/proyectos/${proyectoId}/colaborador`)
      .set('Authorization', `Bearer ${otroEstudiante.token}`)
      .send({ descripcion: 'Intento no autorizado' });

    expect(res.status).toBe(403);
  });

  test('solo un docente puede agregar colaboradores (un estudiante autor no puede)', async () => {
    const estudianteAutor = await crearUsuarioActivo({ rol: 'estudiante', prefijo: 'autorest' });
    const resProyectoEst = await api
      .post('/api/proyectos')
      .set('Authorization', `Bearer ${estudianteAutor.token}`)
      .send(proyectoValido());
    registrar('Proyecto', resProyectoEst.body.data._id);

    const otroColaborador = await crearUsuarioActivo({ rol: 'estudiante', prefijo: 'colab2' });

    const res = await api
      .post(`/api/proyectos/${resProyectoEst.body.data._id}/colaboradores`)
      .set('Authorization', `Bearer ${estudianteAutor.token}`)
      .send({ email: otroColaborador.email });

    expect(res.status).toBe(403);
  });
});
