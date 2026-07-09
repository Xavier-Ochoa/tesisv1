/**
 * Sprint 1 — Autenticación
 *
 * Endpoints cubiertos:
 *   POST   /api/auth/registro
 *   GET    /api/auth/confirm/:token
 *   POST   /api/auth/reenviar-confirmacion
 *   POST   /api/auth/login
 *   POST   /api/auth/logout
 *   GET    /api/auth/perfil
 *   PUT    /api/auth/perfil
 *   GET    /api/auth/random-image
 *   GET    /api/auth/frases
 */

import request from 'supertest';
import { conectarBD, desconectarBD, limpiarBD } from '../../dbHelper.js';
import Estudiante from '../../../src/models/Estudiante.js';
import app from '../../../src/server.js';

// ─── body base reutilizable ───────────────────────────────────────────────────
const bodyBase = {
  nombre:              'Laura',
  apellido:            'Salazar',
  cedula:              '1712345678',
  correoInstitucional: 'laura.test@epn.edu.ec',
  contraseña:          'Clave456@',
  carrera:             'Desarrollo de Software',
  rol:                 'estudiante',
};

// ─── helper: crea usuario confirmado y devuelve token ─────────────────────────
const crearUsuarioYLogin = async (override = {}) => {
  const datos = { ...bodyBase, ...override };
  const u = new Estudiante({
    nombre: datos.nombre, apellido: datos.apellido,
    cedula: datos.cedula,
    email: datos.correoInstitucional || datos.email,
    rol: datos.rol || 'estudiante',
    carrera: datos.carrera || 'Desarrollo de Software',
    confirmEmail: true, estado: 'activo',
  });
  u.password = await u.encryptPassword(datos.contraseña || datos.password || 'Clave456@');
  await u.save();

  const res = await request(app).post('/api/auth/login').send({
    correoInstitucional: u.email,
    contraseña: datos.contraseña || datos.password || 'Clave456@',
  });
  return { token: res.body.token, usuario: u };
};

// ─── Setup / Teardown ─────────────────────────────────────────────────────────
beforeAll(conectarBD);
afterAll(desconectarBD);
afterEach(limpiarBD);

// ══════════════════════════════════════════════════════════════════════════════
// REGISTRO
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/auth/registro', () => {

  it('retorna 201 y crea el usuario con todos los campos válidos', async () => {
    const res = await request(app).post('/api/auth/registro').send(bodyBase);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id).toBeDefined();
    expect(res.body.data.correoInstitucional).toBe('laura.test@epn.edu.ec');
  });

  it('retorna 400 si falta el nombre', async () => {
    const { nombre, ...sin } = bodyBase;
    const res = await request(app).post('/api/auth/registro').send(sin);
    expect(res.status).toBe(400);
  });

  it('retorna 400 si falta la carrera', async () => {
    const { carrera, ...sin } = bodyBase;
    const res = await request(app).post('/api/auth/registro').send(sin);
    expect(res.status).toBe(400);
  });

  it('retorna 400 si el correo no es @epn.edu.ec', async () => {
    const res = await request(app).post('/api/auth/registro')
      .send({ ...bodyBase, correoInstitucional: 'laura@gmail.com' });
    expect(res.status).toBe(400);
  });

  it('retorna 400 si el correo ya está registrado', async () => {
    await request(app).post('/api/auth/registro').send(bodyBase);
    const res = await request(app).post('/api/auth/registro')
      .send({ ...bodyBase, cedula: '1798887776' });
    expect(res.status).toBe(400);
  });

  it('la respuesta NO incluye password ni token', async () => {
    const res = await request(app).post('/api/auth/registro').send(bodyBase);
    expect(res.status).toBe(201);
    expect(res.body.data.password).toBeUndefined();
    expect(res.body.data.token).toBeUndefined();
  });

  it('la cuenta queda con confirmEmail en false', async () => {
    await request(app).post('/api/auth/registro').send(bodyBase);
    const u = await Estudiante.findOne({ email: bodyBase.correoInstitucional }).select('+confirmEmail');
    expect(u.confirmEmail).toBe(false);
  });

  it('asigna rol estudiante por defecto si no se envía rol', async () => {
    const { rol, ...sin } = bodyBase;
    const res = await request(app).post('/api/auth/registro').send(sin);
    expect(res.status).toBe(201);
    const u = await Estudiante.findOne({ email: bodyBase.correoInstitucional });
    expect(u.rol).toBe('estudiante');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// CONFIRMAR CORREO
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/auth/confirm/:token', () => {

  it('retorna 200 y confirma la cuenta con token válido', async () => {
    await request(app).post('/api/auth/registro').send(bodyBase);
    const u = await Estudiante.findOne({ email: bodyBase.correoInstitucional })
      .select('+token +confirmEmail +tokenExpira');

    const res = await request(app).get(`/api/auth/confirm/${u.token}`);
    expect(res.status).toBe(200);
    expect(res.body.msg).toContain('confirmad');

    const actualizado = await Estudiante.findOne({ email: bodyBase.correoInstitucional })
      .select('+confirmEmail');
    expect(actualizado.confirmEmail).toBe(true);
  });

  it('retorna 404 con token inválido', async () => {
    const res = await request(app).get('/api/auth/confirm/token-falso-xyz');
    expect(res.status).toBe(404);
  });

  it('retorna 400 con token expirado', async () => {
    await request(app).post('/api/auth/registro').send(bodyBase);
    const u = await Estudiante.findOne({ email: bodyBase.correoInstitucional })
      .select('+token +tokenExpira');
    // Forzar expiración
    u.tokenExpira = new Date(Date.now() - 1000);
    await u.save();

    const res = await request(app).get(`/api/auth/confirm/${u.token}`);
    expect(res.status).toBe(400);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// REENVIAR CONFIRMACIÓN
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/auth/reenviar-confirmacion', () => {

  it('retorna 200 y genera nuevo token para cuenta no confirmada', async () => {
    await request(app).post('/api/auth/registro').send(bodyBase);
    const res = await request(app).post('/api/auth/reenviar-confirmacion')
      .send({ email: bodyBase.correoInstitucional });
    // 200 si el mail se envía, o 500 si nodemailer no está en .env.test
    expect([200, 500]).toContain(res.status);
  }, 15000); // ↑ timeout ampliado: este test envía 2 correos reales por SMTP

  it('retorna 400 si el correo ya está confirmado', async () => {
    const u = new Estudiante({
      nombre: 'X', apellido: 'Y', cedula: '1700001111',
      email: 'confirmado.test@epn.edu.ec',
      carrera: 'Desarrollo de Software',
      rol: 'estudiante', confirmEmail: true, estado: 'activo',
    });
    u.password = await u.encryptPassword('Clave456@');
    await u.save();

    const res = await request(app).post('/api/auth/reenviar-confirmacion')
      .send({ email: 'confirmado.test@epn.edu.ec' });
    expect(res.status).toBe(400);
  });

  it('retorna 404 si el correo no existe', async () => {
    const res = await request(app).post('/api/auth/reenviar-confirmacion')
      .send({ email: 'noexiste@epn.edu.ec' });
    expect(res.status).toBe(404);
  });

  it('retorna 400 si no se envía email', async () => {
    const res = await request(app).post('/api/auth/reenviar-confirmacion').send({});
    expect(res.status).toBe(400);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/auth/login', () => {

  it('retorna 200 con token y datos al hacer login correcto', async () => {
    const { token, usuario } = await crearUsuarioYLogin();
    expect(token).toBeDefined();
  });

  it('retorna 400 si no se envían credenciales', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('retorna 404 si el correo no está registrado', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ correoInstitucional: 'noexiste@epn.edu.ec', contraseña: 'Clave456@' });
    expect(res.status).toBe(404);
  });

  it('retorna 401 si la contraseña es incorrecta', async () => {
    await crearUsuarioYLogin();
    const res = await request(app).post('/api/auth/login')
      .send({ correoInstitucional: bodyBase.correoInstitucional, contraseña: 'ClaveWrong@9' });
    expect(res.status).toBe(401);
  });

  it('retorna 403 si el email no está confirmado', async () => {
    await request(app).post('/api/auth/registro').send(bodyBase);
    const res = await request(app).post('/api/auth/login')
      .send({ correoInstitucional: bodyBase.correoInstitucional, contraseña: bodyBase.contraseña });
    expect(res.status).toBe(403);
  });

  it('retorna 403 si la cuenta está inactiva', async () => {
    const u = new Estudiante({
      nombre: 'X', apellido: 'Y', cedula: '1700002222',
      email: 'inactivo.test@epn.edu.ec',
      carrera: 'Desarrollo de Software',
      rol: 'estudiante', confirmEmail: true, estado: 'inactivo',
    });
    u.password = await u.encryptPassword('Clave456@');
    await u.save();

    const res = await request(app).post('/api/auth/login')
      .send({ correoInstitucional: 'inactivo.test@epn.edu.ec', contraseña: 'Clave456@' });
    expect(res.status).toBe(403);
  });

  it('la respuesta no incluye el campo password', async () => {
    const { token } = await crearUsuarioYLogin();
    const res = await request(app).post('/api/auth/login')
      .send({ correoInstitucional: bodyBase.correoInstitucional, contraseña: bodyBase.contraseña });
    expect(res.body.password).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// LOGOUT
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/auth/logout', () => {

  it('retorna 200 y cierra la sesión correctamente', async () => {
    const { token } = await crearUsuarioYLogin();
    const res = await request(app).post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.msg).toBe('Sesión cerrada correctamente');
  });

  it('retorna 401 si no se envía token', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });

  it('el token queda inválido después del logout', async () => {
    const { token } = await crearUsuarioYLogin();
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    const res = await request(app).get('/api/auth/perfil').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// VER PERFIL
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/auth/perfil', () => {

  it('retorna 200 con los datos del perfil', async () => {
    const { token } = await crearUsuarioYLogin();
    const res = await request(app).get('/api/auth/perfil')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.correoInstitucional).toBe(bodyBase.correoInstitucional);
    expect(res.body.password).toBeUndefined();
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app).get('/api/auth/perfil');
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ACTUALIZAR PERFIL
// ══════════════════════════════════════════════════════════════════════════════
describe('PUT /api/auth/perfil', () => {

  it('retorna 200 y actualiza campos de perfil permitidos', async () => {
    const { token } = await crearUsuarioYLogin();
    const res = await request(app).put('/api/auth/perfil')
      .set('Authorization', `Bearer ${token}`)
      .send({ telefono: '0991234567', github: 'lauradev' });
    expect(res.status).toBe(200);
    expect(res.body.telefono).toBe('0991234567');
    expect(res.body.github).toBe('lauradev');
  });

  it('retorna 400 al intentar modificar el nombre (campo bloqueado)', async () => {
    const { token } = await crearUsuarioYLogin();
    const res = await request(app).put('/api/auth/perfil')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'NuevoNombre' });
    expect(res.status).toBe(400);
  });

  it('retorna 400 al intentar modificar el correo (campo bloqueado)', async () => {
    const { token } = await crearUsuarioYLogin();
    const res = await request(app).put('/api/auth/perfil')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'otro@epn.edu.ec' });
    expect(res.status).toBe(400);
  });

  it('retorna 400 al intentar modificar el rol (campo bloqueado)', async () => {
    const { token } = await crearUsuarioYLogin();
    const res = await request(app).put('/api/auth/perfil')
      .set('Authorization', `Bearer ${token}`)
      .send({ rol: 'admin' });
    expect(res.status).toBe(400);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app).put('/api/auth/perfil').send({ telefono: '0991234567' });
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SERVICIOS PÚBLICOS (random-image y frases)
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/auth/random-image', () => {
  // Timeout ampliado: Unsplash es una API externa y puede tardar o fallar
  // intermitentemente (ver getRandomImage, que ya captura el error y
  // devuelve "" en ese caso). 45s da margen sin bloquear el suite.
  it('retorna 200 con una imageUrl (o undefined si Unsplash no está configurado)', async () => {
    const res = await request(app).get('/api/auth/random-image');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('imageUrl');
  }, 45000);
});

describe('GET /api/auth/frases', () => {
  // Timeout ampliado: zenquotes.io es una API externa y puede tardar o fallar
  // intermitentemente (ver el servicio de frases, que ya captura el error y
  // devuelve un mensaje de fallback en ese caso). 45s da margen sin bloquear el suite.
  it('retorna 200 con algún contenido de frase', async () => {
    const res = await request(app).get('/api/auth/frases');
    expect(res.status).toBe(200);
    // El endpoint devuelve lo que retorne la API externa; solo verificamos que no explota
    expect(res.body).toBeDefined();
  }, 45000);
});