/**
 * PRUEBA 1 — Autenticación, usuarios y control de acceso
 *
 * Fusiona los antiguos archivos:
 *   01-registro.test.js
 *   02-verificacion-cuenta.test.js
 *   03-login-logout.test.js
 *   04-recuperacion-password.test.js
 *   12-control-acceso-roles.test.js
 *
 * Flujo único y coherente de acceso:
 *   registro -> verificación de cuenta -> login/logout -> recuperación de
 *   contraseña -> control de acceso por roles.
 *
 * Todo contra el backend REAL en Vercel y la MongoDB REAL (ver
 * tests/integration/README.md para el detalle de cómo se manejan los
 * correos reales, el bypass de rol admin, etc.).
 */
import bcrypt from 'bcryptjs';
import { api } from './helpers/apiClient.js';
import {
  obtenerUsuarioCompleto,
  registrar,
  limpiarTodo,
  desconectarDB,
  tokenEstaEnBlacklist,
} from './helpers/dbDirect.js';
import { payloadRegistro, cedulaUnica, PASSWORD_VALIDA_2 } from './helpers/fixtures.js';
import { crearUsuarioActivo } from './helpers/usuarios.js';

afterAll(async () => {
  await limpiarTodo();
  await desconectarDB();
});

describe('1. Registro de usuario (POST /api/auth/registro)', () => {
  test('crea el usuario, cifra la contraseña con bcrypt y genera un token de verificación', async () => {
    const payload = payloadRegistro({ prefijo: 'registro' });

    const res = await api.post('/api/auth/registro').send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.correoInstitucional).toBe(payload.email);
    expect(res.body.data.confirmEmail).toBe(false);
    // La respuesta nunca debe filtrar password ni token
    expect(res.body.data.password).toBeUndefined();
    expect(res.body.data.token).toBeUndefined();

    // Verificación directa en MongoDB real
    const usuarioDB = await obtenerUsuarioCompleto(payload.email);
    registrar('Estudiante', usuarioDB._id);

    expect(usuarioDB).not.toBeNull();
    expect(usuarioDB.confirmEmail).toBe(false);

    // La contraseña debe estar cifrada con bcrypt (nunca en texto plano)
    expect(usuarioDB.password).not.toBe(payload.password);
    const coincide = await bcrypt.compare(payload.password, usuarioDB.password);
    expect(coincide).toBe(true);

    // Debe existir un token de verificación con expiración a futuro
    expect(usuarioDB.token).toEqual(expect.any(String));
    expect(usuarioDB.token.length).toBeGreaterThan(0);
    expect(new Date(usuarioDB.tokenExpira).getTime()).toBeGreaterThan(Date.now());
  });

  test('rechaza el registro si el correo no es institucional (@epn.edu.ec)', async () => {
    const payload = payloadRegistro({ prefijo: 'nogov' });
    payload.email = 'correo.no.institucional@gmail.com';

    const res = await api.post('/api/auth/registro').send(payload);

    expect(res.status).toBe(400);
  });

  test('rechaza el registro si la cédula ya está en uso', async () => {
    const cedula = cedulaUnica();
    const primero = payloadRegistro({ prefijo: 'ced1' });
    primero.cedula = cedula;

    const res1 = await api.post('/api/auth/registro').send(primero);
    expect(res1.status).toBe(201);
    const doc1 = await obtenerUsuarioCompleto(primero.email);
    registrar('Estudiante', doc1._id);

    const segundo = payloadRegistro({ prefijo: 'ced2' });
    segundo.cedula = cedula; // misma cédula

    const res2 = await api.post('/api/auth/registro').send(segundo);
    expect(res2.status).toBe(400);
  });

  test('rechaza el registro si falta un campo obligatorio', async () => {
    const payload = payloadRegistro({ prefijo: 'faltante' });
    delete payload.carrera;

    const res = await api.post('/api/auth/registro').send(payload);
    expect(res.status).toBe(400);
  });
});

describe('2. Verificación de cuenta (GET /api/auth/confirm/:token)', () => {
  test('activa la cuenta con un token válido y luego permite iniciar sesión', async () => {
    const payload = payloadRegistro({ prefijo: 'verif' });
    const resRegistro = await api.post('/api/auth/registro').send(payload);
    expect(resRegistro.status).toBe(201);

    const usuarioAntes = await obtenerUsuarioCompleto(payload.email);
    registrar('Estudiante', usuarioAntes._id);
    expect(usuarioAntes.confirmEmail).toBe(false);
    const token = usuarioAntes.token;

    // Antes de confirmar, el login debe rechazar
    const loginAntes = await api.post('/api/auth/login').send({ email: payload.email, password: payload.password });
    expect(loginAntes.status).toBe(403);

    const resConfirmar = await api.get(`/api/auth/confirm/${token}`);
    expect(resConfirmar.status).toBe(200);

    const usuarioDespues = await obtenerUsuarioCompleto(payload.email);
    expect(usuarioDespues.confirmEmail).toBe(true);
    expect(usuarioDespues.token).toBeNull();

    // Ya puede iniciar sesión
    const loginDespues = await api.post('/api/auth/login').send({ email: payload.email, password: payload.password });
    expect(loginDespues.status).toBe(200);
    expect(loginDespues.body.token).toEqual(expect.any(String));
  });

  test('rechaza un token de verificación inexistente', async () => {
    const res = await api.get('/api/auth/confirm/token-que-no-existe-12345');
    expect(res.status).toBe(404);
  });

  test('no permite confirmar dos veces con el mismo token (ya fue invalidado)', async () => {
    const payload = payloadRegistro({ prefijo: 'verif2' });
    await api.post('/api/auth/registro').send(payload);
    const usuario = await obtenerUsuarioCompleto(payload.email);
    registrar('Estudiante', usuario._id);
    const token = usuario.token;

    const primera = await api.get(`/api/auth/confirm/${token}`);
    expect(primera.status).toBe(200);

    const segunda = await api.get(`/api/auth/confirm/${token}`);
    expect(segunda.status).toBe(404);
  });
});

describe('3. Login, JWT y logout', () => {
  test('login correcto devuelve un JWT y permite acceder a un endpoint protegido', async () => {
    const usuario = await crearUsuarioActivo({ prefijo: 'login' });

    expect(usuario.token).toEqual(expect.any(String));

    const resPerfil = await api.get('/api/auth/perfil').set('Authorization', `Bearer ${usuario.token}`);
    expect(resPerfil.status).toBe(200);
    expect(resPerfil.body.correoInstitucional).toBe(usuario.email);
  });

  test('login con contraseña incorrecta es rechazado', async () => {
    const usuario = await crearUsuarioActivo({ prefijo: 'badpass' });

    const res = await api.post('/api/auth/login').send({ email: usuario.email, password: 'ContraseñaIncorrecta123!' });
    expect(res.status).toBe(401);
  });

  test('un endpoint protegido rechaza peticiones sin token', async () => {
    const res = await api.get('/api/auth/perfil');
    expect(res.status).toBe(401);
  });

  test('logout invalida el token: pasa a la blacklist y ya no sirve para endpoints protegidos', async () => {
    const usuario = await crearUsuarioActivo({ prefijo: 'logout' });

    const resLogout = await api.post('/api/auth/logout').set('Authorization', `Bearer ${usuario.token}`);
    expect(resLogout.status).toBe(200);

    const enBlacklist = await tokenEstaEnBlacklist(usuario.token);
    expect(enBlacklist).toBe(true);

    const resPerfilTrasLogout = await api
      .get('/api/auth/perfil')
      .set('Authorization', `Bearer ${usuario.token}`);
    expect(resPerfilTrasLogout.status).toBe(401);
  });
});

describe('4. Recuperación de contraseña', () => {
  test('flujo completo: token creado -> correo (real) enviado -> password actualizado -> login exitoso', async () => {
    const usuario = await crearUsuarioActivo({ prefijo: 'recuperar' });

    // 1. Solicitar recuperación -> genera token y (según el controlador) manda el correo real
    const resSolicitar = await api.post('/api/auth/recuperarpassword').send({ email: usuario.email });
    expect(resSolicitar.status).toBe(200);

    const usuarioConToken = await obtenerUsuarioCompleto(usuario.email);
    expect(usuarioConToken.token).toEqual(expect.any(String));
    const token = usuarioConToken.token;

    // 2. Comprobar que el token es válido antes de usarlo (endpoint que consulta el link del correo)
    const resComprobar = await api.get(`/api/auth/recuperarpassword/${token}`);
    expect(resComprobar.status).toBe(200);

    // 3. Restablecer contraseña
    const resNuevaPassword = await api
      .post(`/api/auth/nuevopassword/${token}`)
      .send({ password: PASSWORD_VALIDA_2, confirmpassword: PASSWORD_VALIDA_2 });
    expect(resNuevaPassword.status).toBe(200);

    // El token debe quedar invalidado tras usarse
    const usuarioTrasCambio = await obtenerUsuarioCompleto(usuario.email);
    expect(usuarioTrasCambio.token).toBeNull();

    // 4. Login exitoso con la nueva contraseña
    const resLogin = await api.post('/api/auth/login').send({ email: usuario.email, password: PASSWORD_VALIDA_2 });
    expect(resLogin.status).toBe(200);
    expect(resLogin.body.token).toEqual(expect.any(String));

    // La contraseña anterior ya no debe funcionar
    const resLoginViejo = await api.post('/api/auth/login').send({ email: usuario.email, password: usuario.password });
    expect(resLoginViejo.status).toBe(401);
  });

  test('rechaza recuperar contraseña para un correo no registrado', async () => {
    const res = await api.post('/api/auth/recuperarpassword').send({ email: 'no.existe.qa@epn.edu.ec' });
    expect(res.status).toBe(404);
  });

  test('rechaza restablecer contraseña con un token inválido', async () => {
    const res = await api
      .post('/api/auth/nuevopassword/token-invalido-xyz')
      .send({ password: PASSWORD_VALIDA_2, confirmpassword: PASSWORD_VALIDA_2 });
    expect(res.status).toBe(404);
  });
});

describe('12. Control de acceso por roles (GET /api/admin/estudiantes)', () => {
  let admin;
  let docente;
  let estudiante;

  beforeAll(async () => {
    admin = await crearUsuarioActivo({ prefijo: 'rolAdmin', forzarAdmin: true });
    docente = await crearUsuarioActivo({ rol: 'docente', prefijo: 'rolDocente' });
    estudiante = await crearUsuarioActivo({ rol: 'estudiante', prefijo: 'rolEstudiante' });
  });

  test('el administrador puede acceder al endpoint de admin', async () => {
    const res = await api.get('/api/admin/estudiantes').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
  });

  test('un docente es rechazado en el endpoint de admin', async () => {
    const res = await api.get('/api/admin/estudiantes').set('Authorization', `Bearer ${docente.token}`);
    expect(res.status).toBe(403);
  });

  test('un estudiante es rechazado en el endpoint de admin', async () => {
    const res = await api.get('/api/admin/estudiantes').set('Authorization', `Bearer ${estudiante.token}`);
    expect(res.status).toBe(403);
  });

  test('sin token, se rechaza antes de evaluar el rol', async () => {
    const res = await api.get('/api/admin/estudiantes');
    expect(res.status).toBe(401);
  });
});
