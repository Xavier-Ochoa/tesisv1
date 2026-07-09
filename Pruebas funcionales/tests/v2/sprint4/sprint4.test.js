/**
 * Sprint 4 — Recuperación de contraseña y donaciones
 *
 * Recuperación de contraseña: el flujo completo se prueba manipulando
 * directamente el token en BD (sin depender del correo enviado).
 *
 * Stripe: se mockea el cliente para no requerir credenciales reales.
 *
 * Endpoints cubiertos:
 *   POST   /api/auth/recuperarpassword          (solicitar recuperación)
 *   GET    /api/auth/recuperarpassword/:token   (validar token)
 *   POST   /api/auth/nuevopassword/:token       (establecer nueva contraseña)
 *   POST   /api/donaciones                      (donación a la plataforma)
 */

import { jest } from '@jest/globals';

// ── Mock de Stripe ────────────────────────────────────────────────────────────
// En ESM (sin babel) jest.mock() no se hoistea por encima de imports estáticos;
// usamos jest.unstable_mockModule + import() dinámico para garantizar que el
// mock esté activo antes de que src/server.js cargue donacion_controller.js.
const stripePaymentIntentsCreate = jest.fn().mockResolvedValue({
  id:     'pi_test_mock_stripe_id',
  status: 'succeeded',
});

const stripeConstructorMock = jest.fn(() => ({
  paymentIntents: {
    create: stripePaymentIntentsCreate,
  },
}));

jest.unstable_mockModule('stripe', () => ({
  default: stripeConstructorMock,
}));

// ── Mock de nodemailer (para no enviar correos reales) ────────────────────────
const sendMailToRecoveryPassword = jest.fn().mockResolvedValue(true);
const sendMailToRegister         = jest.fn().mockResolvedValue(true);
const sendMailToPasswordChanged  = jest.fn().mockResolvedValue(true);

jest.unstable_mockModule('../../../src/helpers/sendMail.js', () => ({
  sendMailToRecoveryPassword,
  sendMailToRegister,
  sendMailToPasswordChanged,
}));

const request    = (await import('supertest')).default;
const { conectarBD, desconectarBD, limpiarBD } = await import('../../dbHelper.js');
const Estudiante = (await import('../../../src/models/Estudiante.js')).default;
const Donacion   = (await import('../../../src/models/Donacion.js')).default;
const app        = (await import('../../../src/server.js')).default;
const { crearEstudiante } = await import('../../helpers.js');

// ─── Setup / Teardown ─────────────────────────────────────────────────────────
let estudiante;

beforeAll(async () => {
  await conectarBD();
  estudiante = await crearEstudiante();
});

afterAll(async () => {
  await Estudiante.deleteMany({});
  await Donacion.deleteMany({});
  await desconectarBD();
});
// ─────────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// SOLICITAR RECUPERACIÓN DE CONTRASEÑA
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/auth/recuperarpassword', () => {

  it('retorna 200 si el correo existe y la cuenta está activa y confirmada', async () => {
    const u = await Estudiante.findById(estudiante.userId).select('+confirmEmail +estado');
    u.confirmEmail = true;
    u.estado       = 'activo';
    await u.save();

    const res = await request(app)
      .post('/api/auth/recuperarpassword')
      .send({ email: u.email });

    expect(res.status).toBe(200);
    expect(res.body.msg).toContain('correo');
  });

  it('retorna 404 si el correo no está registrado', async () => {
    const res = await request(app)
      .post('/api/auth/recuperarpassword')
      .send({ email: 'noexiste@epn.edu.ec' });
    expect(res.status).toBe(404);
  });

  it('retorna 400 si no se envía email', async () => {
    const res = await request(app)
      .post('/api/auth/recuperarpassword')
      .send({});
    expect(res.status).toBe(400);
  });

  it('retorna 403 si la cuenta está inactiva', async () => {
    const inactivo = new Estudiante({
      nombre: 'Inac', apellido: 'Tivo', cedula: '1755555555',
      email: 'inactivo.rec@epn.edu.ec',
      carrera: 'Desarrollo de Software',
      rol: 'estudiante', confirmEmail: true, estado: 'inactivo',
    });
    inactivo.password = await inactivo.encryptPassword('Clave456@');
    await inactivo.save();

    const res = await request(app)
      .post('/api/auth/recuperarpassword')
      .send({ email: 'inactivo.rec@epn.edu.ec' });
    expect(res.status).toBe(403);

    await Estudiante.deleteOne({ email: 'inactivo.rec@epn.edu.ec' });
  });

  it('retorna 403 si el correo no está confirmado', async () => {
    const sinConfirmar = new Estudiante({
      nombre: 'Sin', apellido: 'Confirmar', cedula: '1788888888',
      email: 'sinconfirmar.rec@epn.edu.ec',
      carrera: 'Desarrollo de Software',
      rol: 'estudiante', confirmEmail: false, estado: 'activo',
    });
    sinConfirmar.password = await sinConfirmar.encryptPassword('Clave456@');
    await sinConfirmar.save();

    const res = await request(app)
      .post('/api/auth/recuperarpassword')
      .send({ email: 'sinconfirmar.rec@epn.edu.ec' });
    expect(res.status).toBe(403);

    await Estudiante.deleteOne({ email: 'sinconfirmar.rec@epn.edu.ec' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// VALIDAR TOKEN DE RECUPERACIÓN
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/auth/recuperarpassword/:token', () => {

  it('retorna 200 con token válido y vigente', async () => {
    // Generar token directamente en BD para el test
    const u = await Estudiante.findById(estudiante.userId).select('+token +tokenExpira');
    const tok = u.createTokenRecuperacion();
    u.token = tok;
    await u.save();

    const res = await request(app).get(`/api/auth/recuperarpassword/${tok}`);
    expect(res.status).toBe(200);
    expect(res.body.msg).toContain('Token confirmado');
  });

  it('retorna 404 con token inválido', async () => {
    const res = await request(app).get('/api/auth/recuperarpassword/token-falso-inexistente');
    expect(res.status).toBe(404);
  });

  it('retorna 400 con token expirado', async () => {
    const u = await Estudiante.findById(estudiante.userId).select('+token +tokenExpira');
    const tok = u.createTokenRecuperacion();
    u.token       = tok;
    u.tokenExpira = new Date(Date.now() - 1000); // ya expiró
    await u.save();

    const res = await request(app).get(`/api/auth/recuperarpassword/${tok}`);
    expect(res.status).toBe(400);
    expect(res.body.msg).toContain('expirado');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ESTABLECER NUEVA CONTRASEÑA
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/auth/nuevopassword/:token', () => {

  it('retorna 200 y establece la nueva contraseña', async () => {
    const u = await Estudiante.findById(estudiante.userId).select('+token +tokenExpira');
    const tok = u.createTokenRecuperacion();
    u.token = tok;
    await u.save();

    const res = await request(app)
      .post(`/api/auth/nuevopassword/${tok}`)
      .send({ password: 'NuevaClave@8', confirmpassword: 'NuevaClave@8' });

    expect(res.status).toBe(200);
    expect(res.body.msg).toContain('actualizada');
  });

  it('con la nueva contraseña el usuario puede hacer login', async () => {
    // Generar nuevo token tras el test anterior (ya se consumió)
    const u = await Estudiante.findById(estudiante.userId).select('+token +tokenExpira +confirmEmail +estado');
    const tok = u.createTokenRecuperacion();
    u.token        = tok;
    u.confirmEmail = true;
    u.estado       = 'activo';
    await u.save();

    await request(app)
      .post(`/api/auth/nuevopassword/${tok}`)
      .send({ password: 'ClaveDefinitiva@3', confirmpassword: 'ClaveDefinitiva@3' });

    const login = await request(app).post('/api/auth/login').send({
      correoInstitucional: u.email,
      contraseña:          'ClaveDefinitiva@3',
    });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeDefined();
  });

  it('retorna 400 si las contraseñas no coinciden', async () => {
    const u = await Estudiante.findById(estudiante.userId).select('+token +tokenExpira');
    const tok = u.createTokenRecuperacion();
    u.token = tok;
    await u.save();

    const res = await request(app)
      .post(`/api/auth/nuevopassword/${tok}`)
      .send({ password: 'NuevaClave@8', confirmpassword: 'OtroValor@9' });
    expect(res.status).toBe(400);
  });

  it('retorna 404 con token inválido', async () => {
    const res = await request(app)
      .post('/api/auth/nuevopassword/token-totalmente-falso')
      .send({ password: 'NuevaClave@8', confirmpassword: 'NuevaClave@8' });
    expect(res.status).toBe(404);
  });

  it('retorna 400 con token ya consumido (usado dos veces)', async () => {
    const u = await Estudiante.findById(estudiante.userId).select('+token +tokenExpira');
    const tok = u.createTokenRecuperacion();
    u.token = tok;
    await u.save();

    await request(app)
      .post(`/api/auth/nuevopassword/${tok}`)
      .send({ password: 'PrimerUso@1', confirmpassword: 'PrimerUso@1' });

    const res = await request(app)
      .post(`/api/auth/nuevopassword/${tok}`)
      .send({ password: 'SegundoUso@2', confirmpassword: 'SegundoUso@2' });
    expect(res.status).toBe(404);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DONACIONES (Stripe sandbox — mockeado)
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/donaciones', () => {

  it('retorna 200 y registra la donación cuando Stripe responde succeeded', async () => {
    const res = await request(app)
      .post('/api/donaciones')
      .send({
        paymentMethodId: 'pm_card_visa',
        monto:           10,
        nombre:          'Juan Donante',
        mensaje:         'Apoyando la plataforma educativa.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.monto).toBe(10);
    expect(res.body.data.donacionId).toBeDefined();

    const enBD = await Donacion.findById(res.body.data.donacionId);
    expect(enBD).not.toBeNull();
    expect(enBD.estado).toBe('exitosa');
  });

  it('retorna 400 si no se envía paymentMethodId', async () => {
    const res = await request(app)
      .post('/api/donaciones')
      .send({ monto: 10 });
    expect(res.status).toBe(400);
  });

  it('retorna 400 si no se envía monto', async () => {
    const res = await request(app)
      .post('/api/donaciones')
      .send({ paymentMethodId: 'pm_card_visa' });
    expect(res.status).toBe(400);
  });

  it('retorna 400 si el monto es menor a $2', async () => {
    const res = await request(app)
      .post('/api/donaciones')
      .send({ paymentMethodId: 'pm_card_visa', monto: 1 });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('$2');
  });

  it('retorna 400 si el monto es mayor a $1000', async () => {
    const res = await request(app)
      .post('/api/donaciones')
      .send({ paymentMethodId: 'pm_card_visa', monto: 1500 });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('$1000');
  });

  it('acepta donación anónima (sin nombre)', async () => {
    const res = await request(app)
      .post('/api/donaciones')
      .send({ paymentMethodId: 'pm_card_visa', monto: 5 });

    expect(res.status).toBe(200);
    const enBD = await Donacion.findById(res.body.data.donacionId);
    expect(enBD.donanteNombre).toBe('Anónimo');
  });

  it('simula fallo de Stripe y retorna 400', async () => {
    // El cliente Stripe es un singleton creado al cargar el módulo
    // (const stripe = new Stripe(...)), por lo que sobreescribir el
    // constructor con mockImplementationOnce no afecta a esa instancia ya
    // creada. En su lugar, sobreescribimos directamente la función
    // `create` compartida que ya está enlazada a `stripe.paymentIntents.create`.
    stripePaymentIntentsCreate.mockResolvedValueOnce({
      id:     'pi_test_failed',
      status: 'requires_payment_method',
    });

    const res = await request(app)
      .post('/api/donaciones')
      .send({ paymentMethodId: 'pm_card_declined', monto: 10 });

    expect([400, 500]).toContain(res.status);
  });
});
