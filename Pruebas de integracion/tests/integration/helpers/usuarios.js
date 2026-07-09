/**
 * tests/integration/helpers/usuarios.js
 *
 * Flujo reutilizable para dejar un usuario "activo y confirmado" usando
 * SIEMPRE los endpoints reales (register, confirm, login) -> por lo tanto
 * cada llamada de este helper manda un correo real a través de Nodemailer,
 * tal como se acordó (nada de bypass del registro para otras suites).
 *
 * La única parte que no pasa por "leer el correo real" es obtener el token
 * de verificación: como no tenemos acceso a la bandeja de Gmail desde el
 * test runner, el token se lee directo de Mongo (mismo valor que el correo
 * real contiene) y se usa contra el endpoint real de confirmación.
 */
import { api } from './apiClient.js';
import { obtenerUsuarioCompleto, forzarRol, registrar } from './dbDirect.js';
import { payloadRegistro, PASSWORD_VALIDA } from './fixtures.js';

/**
 * Registra un usuario real, confirma su correo (token leído de Mongo) y
 * hace login real. Devuelve { email, password, id, token (JWT) }.
 *
 * @param {object} opts
 * @param {'estudiante'|'docente'} opts.rol
 * @param {string} opts.prefijo - para identificar el correo en los logs
 * @param {boolean} opts.forzarAdmin - si true, sube el rol a "admin" directo
 *        en Mongo (la API pública no permite crear admins) y vuelve a
 *        loguearse para obtener un JWT con el rol actualizado.
 */
export const crearUsuarioActivo = async ({ rol = 'estudiante', prefijo = 'user', forzarAdmin = false } = {}) => {
  const payload = payloadRegistro({ rol, prefijo });

  const resRegistro = await api.post('/api/auth/registro').send(payload);
  if (resRegistro.status !== 201) {
    throw new Error(
      `No se pudo registrar usuario de prueba (${payload.email}): ${resRegistro.status} - ${JSON.stringify(resRegistro.body)}`
    );
  }

  const usuarioDoc = await obtenerUsuarioCompleto(payload.email);
  if (!usuarioDoc) throw new Error(`Usuario recién registrado no se encontró en Mongo: ${payload.email}`);
  registrar('Estudiante', usuarioDoc._id);

  const tokenVerificacion = usuarioDoc.token;
  const resConfirmar = await api.get(`/api/auth/confirm/${tokenVerificacion}`);
  if (resConfirmar.status !== 200) {
    throw new Error(`No se pudo confirmar la cuenta de ${payload.email}: ${JSON.stringify(resConfirmar.body)}`);
  }

  if (forzarAdmin) {
    await forzarRol(usuarioDoc._id, 'admin');
  }

  const resLogin = await api.post('/api/auth/login').send({ email: payload.email, password: payload.password });
  if (resLogin.status !== 200 || !resLogin.body?.token) {
    throw new Error(`No se pudo iniciar sesión con ${payload.email}: ${JSON.stringify(resLogin.body)}`);
  }

  return {
    id: usuarioDoc._id.toString(),
    email: payload.email,
    password: payload.password,
    token: resLogin.body.token,
  };
};

export { PASSWORD_VALIDA };
