/**
 * Sprint 2 — Chat (Pusher)
 *
 * Pusher se mockea completamente: los tests verifican la lógica HTTP
 * y la persistencia en BD sin depender del servicio externo.
 *
 * Endpoints cubiertos:
 *   POST  /api/chat/mensaje                  (usuario envía mensaje)
 *   GET   /api/chat/mensajes                 (usuario ve su conversación)
 *   POST  /api/chat/admin/responder          (admin responde)
 *   GET   /api/chat/admin/conversaciones     (admin lista conversaciones)
 *   GET   /api/chat/admin/mensajes/:userId   (admin ve conv. de un usuario)
 */

import { jest } from '@jest/globals';

// ── Mock de Pusher — debe declararse antes de cualquier import de src ─────────
// En ESM puro (--experimental-vm-modules) se usa unstable_mockModule en vez
// de jest.mock(), y los imports de los módulos mockeados/dependientes deben
// hacerse de forma dinámica DESPUÉS de registrar el mock.
jest.unstable_mockModule('../../../src/services/pusherService.js', () => ({
  notificarNuevoMensaje:   jest.fn().mockResolvedValue(true),
  notificarRespuestaAdmin: jest.fn().mockResolvedValue(true),
  CHANNELS: { ADMIN_CHAT: 'admin-chat', USER_CHAT: (id) => `chat-user-${id}` },
  EVENTS:   { NEW_MESSAGE: 'new-message', ADMIN_REPLY: 'admin-reply' },
}));

const request    = (await import('supertest')).default;
const { conectarBD, desconectarBD, limpiarBD } = await import('../../dbHelper.js');
const ChatMensaje = (await import('../../../src/models/ChatMensaje.js')).default;
const Estudiante  = (await import('../../../src/models/Estudiante.js')).default;
const app         = (await import('../../../src/server.js')).default;
const { crearEstudiante, crearAdmin } = await import('../../helpers.js');

// ─── Setup / Teardown ─────────────────────────────────────────────────────────
let estudiante;
let admin;

beforeAll(async () => {
  await conectarBD();
  estudiante = await crearEstudiante();
  admin      = await crearAdmin();
});

afterAll(async () => {
  await ChatMensaje.deleteMany({});
  await Estudiante.deleteMany({});
  await desconectarBD();
});

afterEach(async () => {
  await ChatMensaje.deleteMany({});
});
// ─────────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// ENVIAR MENSAJE (usuario → admin)
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/chat/mensaje', () => {

  it('retorna 201 y guarda el mensaje en BD', async () => {
    const res = await request(app)
      .post('/api/chat/mensaje')
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send({ texto: 'Hola, tengo una consulta sobre mi proyecto.' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id).toBeDefined();
    expect(res.body.data.texto).toBe('Hola, tengo una consulta sobre mi proyecto.');
    expect(res.body.data.esAdmin).toBe(false);

    const enBD = await ChatMensaje.findById(res.body.data._id);
    expect(enBD).not.toBeNull();
  });

  it('retorna 400 si el texto está vacío', async () => {
    const res = await request(app)
      .post('/api/chat/mensaje')
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send({ texto: '   ' });
    expect(res.status).toBe(400);
  });

  it('retorna 400 si no se envía texto', async () => {
    const res = await request(app)
      .post('/api/chat/mensaje')
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app)
      .post('/api/chat/mensaje')
      .send({ texto: 'Mensaje sin autenticar.' });
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// VER MI CONVERSACIÓN (usuario)
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/chat/mensajes', () => {

  it('retorna 200 con la conversación del usuario', async () => {
    await ChatMensaje.create({
      usuario:   estudiante.userId,
      remitente: estudiante.userId,
      texto:     'Primer mensaje de test.',
      esAdmin:   false,
    });
    await ChatMensaje.create({
      usuario:   estudiante.userId,
      remitente: admin.userId,
      texto:     'Respuesta del admin.',
      esAdmin:   true,
    });

    const res = await request(app)
      .get('/api/chat/mensajes')
      .set('Authorization', `Bearer ${estudiante.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.mensajes)).toBe(true);
    expect(res.body.data.mensajes.length).toBe(2);
  });

  it('solo devuelve mensajes del usuario autenticado', async () => {
    const otro = await crearEstudiante();
    await ChatMensaje.create({
      usuario:   otro.userId,
      remitente: otro.userId,
      texto:     'Mensaje de otro usuario, no debe aparecer.',
      esAdmin:   false,
    });
    await ChatMensaje.create({
      usuario:   estudiante.userId,
      remitente: estudiante.userId,
      texto:     'Mensaje propio que sí debe aparecer.',
      esAdmin:   false,
    });

    const res = await request(app)
      .get('/api/chat/mensajes')
      .set('Authorization', `Bearer ${estudiante.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.mensajes.length).toBe(1);
    expect(res.body.data.mensajes[0].texto).toBe('Mensaje propio que sí debe aparecer.');
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app).get('/api/chat/mensajes');
    expect(res.status).toBe(401);
  });

  it('soporta paginación con query params', async () => {
    for (let i = 1; i <= 5; i++) {
      await ChatMensaje.create({
        usuario:   estudiante.userId,
        remitente: estudiante.userId,
        texto:     `Mensaje ${i}`,
        esAdmin:   false,
      });
    }

    const res = await request(app)
      .get('/api/chat/mensajes?limite=2&pagina=1')
      .set('Authorization', `Bearer ${estudiante.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.mensajes.length).toBeLessThanOrEqual(2);
    expect(res.body.data.paginacion.totalPaginas).toBeGreaterThan(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN RESPONDE A USUARIO
// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/chat/admin/responder', () => {

  it('retorna 201 y guarda la respuesta con esAdmin=true', async () => {
    const res = await request(app)
      .post('/api/chat/admin/responder')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        userId: estudiante.userId,
        texto:  'Hola, te respondemos a tu consulta.',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.esAdmin).toBe(true);

    const enBD = await ChatMensaje.findById(res.body.data._id);
    expect(enBD.esAdmin).toBe(true);
  });

  it('retorna 400 si no se envía texto', async () => {
    const res = await request(app)
      .post('/api/chat/admin/responder')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ userId: estudiante.userId });
    expect(res.status).toBe(400);
  });

  it('retorna 400 si no se envía userId', async () => {
    const res = await request(app)
      .post('/api/chat/admin/responder')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ texto: 'Respuesta sin destinatario.' });
    expect(res.status).toBe(400);
  });

  it('retorna 404 si el userId no existe', async () => {
    const res = await request(app)
      .post('/api/chat/admin/responder')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ userId: '64a000000000000000000000', texto: 'Respuesta a nadie.' });
    expect(res.status).toBe(404);
  });

  it('retorna 403 si lo llama un estudiante', async () => {
    const res = await request(app)
      .post('/api/chat/admin/responder')
      .set('Authorization', `Bearer ${estudiante.token}`)
      .send({ userId: estudiante.userId, texto: 'Intento de responder siendo estudiante.' });
    expect(res.status).toBe(403);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app)
      .post('/api/chat/admin/responder')
      .send({ userId: estudiante.userId, texto: 'Sin autenticar.' });
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN LISTA CONVERSACIONES
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/chat/admin/conversaciones', () => {

  it('retorna 200 con la lista de conversaciones', async () => {
    await ChatMensaje.create({
      usuario:   estudiante.userId,
      remitente: estudiante.userId,
      texto:     'Mensaje para generar conversación.',
      esAdmin:   false,
    });

    const res = await request(app)
      .get('/api/chat/admin/conversaciones')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('cada conversación tiene userId, ultimoMensaje y sinLeer', async () => {
    await ChatMensaje.create({
      usuario:   estudiante.userId,
      remitente: estudiante.userId,
      texto:     'Otro mensaje de test.',
      esAdmin:   false,
    });

    const res = await request(app)
      .get('/api/chat/admin/conversaciones')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    const conv = res.body.data[0];
    expect(conv.userId).toBeDefined();
    expect(conv.ultimoMensaje).toBeDefined();
    expect(conv.sinLeer).toBeDefined();
  });

  it('retorna 403 si lo llama un estudiante', async () => {
    const res = await request(app)
      .get('/api/chat/admin/conversaciones')
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect(res.status).toBe(403);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app).get('/api/chat/admin/conversaciones');
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN VE CONVERSACIÓN DE UN USUARIO
// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/chat/admin/mensajes/:userId', () => {

  it('retorna 200 con el historial del usuario solicitado', async () => {
    await ChatMensaje.create({
      usuario:   estudiante.userId,
      remitente: estudiante.userId,
      texto:     'Mensaje del historial.',
      esAdmin:   false,
    });

    const res = await request(app)
      .get(`/api/chat/admin/mensajes/${estudiante.userId}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.usuario._id.toString()).toBe(estudiante.userId);
    expect(Array.isArray(res.body.data.mensajes)).toBe(true);
  });

  it('retorna 404 si el userId no existe', async () => {
    const res = await request(app)
      .get('/api/chat/admin/mensajes/64a000000000000000000000')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(404);
  });

  it('retorna 403 si lo llama un estudiante', async () => {
    const res = await request(app)
      .get(`/api/chat/admin/mensajes/${estudiante.userId}`)
      .set('Authorization', `Bearer ${estudiante.token}`);
    expect(res.status).toBe(403);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app)
      .get(`/api/chat/admin/mensajes/${estudiante.userId}`);
    expect(res.status).toBe(401);
  });
});