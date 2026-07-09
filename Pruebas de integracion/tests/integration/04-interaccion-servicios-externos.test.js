/**
 * PRUEBA 4 — Interacción y servicios externos
 *
 * Fusiona los antiguos archivos:
 *   09-chat-tiempo-real.test.js
 *   10-generacion-titulos-ia.test.js
 *   11-donaciones.test.js
 *
 * Chat, generación de títulos con IA y donaciones son dominios
 * independientes entre sí (no comparten estado), así que la fusión aquí
 * es puramente cosmética: un archivo, tres `describe` hermanos, un solo
 * `afterAll`. No se fuerza ninguna relación entre los tres bloques.
 *
 * Se preservan tal cual los flags/condiciones ya documentados:
 *   - Chat usa Pusher con credenciales reales (evento emitido sin error).
 *   - El caso feliz de IA (Hugging Face) solo corre si
 *     RUN_IA_LIVE_TEST=true; el resto siempre valida sin llamar a HF.
 *   - Donaciones usa PaymentMethod de prueba de Stripe en modo sandbox
 *     (pm_card_visa, pm_card_chargeDeclined).
 * Jest corre estos tests en serie (--runInBand), así que no hay
 * condiciones de carrera entre el bloque de chat y los otros dos.
 *
 * Todo contra el backend REAL en Vercel y la MongoDB REAL.
 */
import { api } from './helpers/apiClient.js';
import { crearUsuarioActivo } from './helpers/usuarios.js';
import { registrar, limpiarTodo, desconectarDB, obtenerDonacionPorPaymentIntent, ChatMensaje, conectarDB } from './helpers/dbDirect.js';
import { RUN_IA_LIVE_TEST } from './helpers/env.js';

afterAll(async () => {
  await limpiarTodo();
  await desconectarDB();
});

describe('9. Chat en tiempo real (usuario <-> admin, Pusher)', () => {
  let usuario;
  let admin;

  beforeAll(async () => {
    usuario = await crearUsuarioActivo({ prefijo: 'chatuser' });
    admin = await crearUsuarioActivo({ prefijo: 'chatadmin', forzarAdmin: true });
  });

  test('el usuario envía un mensaje: se guarda en MongoDB y el evento Pusher se emite sin error', async () => {
    const res = await api
      .post('/api/chat/mensaje')
      .set('Authorization', `Bearer ${usuario.token}`)
      .send({ texto: 'Hola, tengo una consulta sobre mi proyecto (prueba de integración).' });

    expect(res.status).toBe(201);
    registrar('ChatMensaje', res.body.data._id);

    await conectarDB();
    const mensajeDB = await ChatMensaje.findById(res.body.data._id);
    expect(mensajeDB).not.toBeNull();
    expect(mensajeDB.esAdmin).toBe(false);
  });

  test('el admin responde al usuario: se guarda en MongoDB', async () => {
    const res = await api
      .post('/api/chat/admin/responder')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ userId: usuario.id, texto: 'Buenas, ¿en qué puedo ayudarte? (prueba de integración)' });

    expect(res.status).toBe(201);
    registrar('ChatMensaje', res.body.data._id);
    expect(res.body.data.esAdmin).toBe(true);
  });

  test('el usuario recupera su conversación completa', async () => {
    const res = await api.get('/api/chat/mensajes').set('Authorization', `Bearer ${usuario.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.mensajes.length).toBeGreaterThanOrEqual(2);
  });

  test('el admin puede ver la conversación de ese usuario', async () => {
    const res = await api
      .get(`/api/chat/admin/mensajes/${usuario.id}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.usuario._id).toBe(usuario.id);
  });

  test('un usuario normal no puede responder como admin', async () => {
    const res = await api
      .post('/api/chat/admin/responder')
      .set('Authorization', `Bearer ${usuario.token}`)
      .send({ userId: usuario.id, texto: 'Intento no autorizado' });

    expect(res.status).toBe(403);
  });
});

describe('10. Generación de títulos con IA', () => {
  let usuario;

  beforeAll(async () => {
    usuario = await crearUsuarioActivo({ prefijo: 'iauser' });
  });

  test('rechaza (sin llamar a la IA) una descripción demasiado corta', async () => {
    const res = await api
      .post('/api/ia/generar-titulo')
      .set('Authorization', `Bearer ${usuario.token}`)
      .send({ descripcion: 'muy corta' });

    expect(res.status).toBe(400);
  });

  test('rechaza sin autenticación', async () => {
    const res = await api.post('/api/ia/generar-titulo').send({ descripcion: 'Una descripción de prueba suficientemente larga' });
    expect(res.status).toBe(401);
  });

  const maybeTest = RUN_IA_LIVE_TEST ? test : test.skip;
  maybeTest('[LIVE] consume la API real de Hugging Face y devuelve 3 títulos', async () => {
    const res = await api
      .post('/api/ia/generar-titulo')
      .set('Authorization', `Bearer ${usuario.token}`)
      .send({
        descripcion:
          'Sistema web para la gestión y publicación de proyectos de titulación de estudiantes de ingeniería, con control de roles y colaboración entre autores.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.titulos)).toBe(true);
    expect(res.body.data.titulos.length).toBeGreaterThan(0);
  }, 30000);
});

describe('11. Donaciones (Stripe, modo test)', () => {
  test('un pago exitoso (tarjeta de prueba) crea el registro de donación en MongoDB', async () => {
    const res = await api.post('/api/donaciones').send({
      paymentMethodId: 'pm_card_visa',
      monto: 5,
      nombre: 'Donante QA',
      mensaje: 'Donación de prueba de integración',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stripePaymentIntentId).toEqual(expect.any(String));

    const donacionDB = await obtenerDonacionPorPaymentIntent(res.body.data.stripePaymentIntentId);
    registrar('Donacion', donacionDB._id);
    expect(donacionDB).not.toBeNull();
    expect(donacionDB.estado).toBe('exitosa');
    expect(donacionDB.monto).toBe(5);
  });

  test('una tarjeta de prueba rechazada no crea una donación exitosa', async () => {
    const res = await api.post('/api/donaciones').send({
      paymentMethodId: 'pm_card_chargeDeclined',
      monto: 5,
      nombre: 'Donante QA Rechazado',
    });

    // Stripe rechaza el cobro -> el endpoint no debe reportar éxito
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
  });

  test('rechaza (sin llamar a Stripe) si falta el monto o el método de pago', async () => {
    const res = await api.post('/api/donaciones').send({ nombre: 'Sin monto' });
    expect(res.status).toBe(400);
  });

  test('rechaza (sin llamar a Stripe) un monto fuera de rango', async () => {
    const res = await api.post('/api/donaciones').send({ paymentMethodId: 'pm_card_visa', monto: 1 });
    expect(res.status).toBe(400);
  });
});
