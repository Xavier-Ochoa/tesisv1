/**
 * services/pusherService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Helpers centralizados para emitir eventos de Pusher.
 *
 * Toda la lógica de trigger() vive aquí para mantener los controladores
 * desacoplados de Pusher. Si en el futuro se cambia el proveedor de realtime
 * (Socket.io, Ably, etc.) solo hay que tocar este archivo.
 *
 * Canales usados:
 *   ┌─────────────────────────┬──────────────────────────────────────────────┐
 *   │ Canal                   │ Descripción                                  │
 *   ├─────────────────────────┼──────────────────────────────────────────────┤
 *   │ admin-chat              │ El admin se suscribe para ver todos los msgs  │
 *   │ chat-user-{userId}      │ Canal privado por usuario para recibir reply  │
 *   └─────────────────────────┴──────────────────────────────────────────────┘
 *
 * Eventos usados:
 *   ┌──────────────┬───────────────────────────────────────────────────────┐
 *   │ Evento       │ Descripción                                           │
 *   ├──────────────┼───────────────────────────────────────────────────────┤
 *   │ new-message  │ Usuario envía mensaje → notifica al admin              │
 *   │ admin-reply  │ Admin responde → notifica al usuario específico        │
 *   └──────────────┴───────────────────────────────────────────────────────┘
 */

import pusher from '../config/pusher.js';

// ── Constantes de canales y eventos ───────────────────────────────────────────

export const CHANNELS = {
  /** Canal global que escucha el admin */
  ADMIN_CHAT: 'admin-chat',

  /**
   * Canal privado por usuario.
   * @param {string} userId - MongoDB ObjectId del usuario como string
   * @returns {string} nombre del canal
   */
  USER_CHAT: (userId) => `chat-user-${userId}`,
};

export const EVENTS = {
  /** Mensaje nuevo de usuario al admin */
  NEW_MESSAGE:  'new-message',

  /** Respuesta del admin al usuario */
  ADMIN_REPLY:  'admin-reply',
};

// ── Helper interno con manejo de errores ──────────────────────────────────────

/**
 * Emite un evento Pusher con manejo de errores no bloqueante.
 * Si Pusher falla, el flujo HTTP principal continúa normalmente.
 *
 * @param {string} channel  - Nombre del canal Pusher
 * @param {string} event    - Nombre del evento
 * @param {object} payload  - Datos a enviar
 * @returns {Promise<boolean>} true si fue exitoso, false si falló
 */
async function emitirEvento(channel, event, payload) {
  try {
    await pusher.trigger(channel, event, payload);
    return true;
  } catch (error) {
    // El error de Pusher NO debe interrumpir la respuesta HTTP.
    // El mensaje ya fue guardado en MongoDB; solo el realtime falla.
    console.error(`❌ [Pusher] Error al emitir "${event}" en canal "${channel}":`, error.message);
    return false;
  }
}

// ── Funciones públicas del servicio ───────────────────────────────────────────

/**
 * Notifica al admin que un usuario envió un nuevo mensaje.
 *
 * Canal destino : admin-chat
 * Evento        : new-message
 *
 * @param {object} params
 * @param {string} params.mensajeId   - MongoDB _id del mensaje
 * @param {string} params.userId      - MongoDB _id del remitente
 * @param {string} params.userName    - Nombre completo del remitente
 * @param {string} params.texto       - Contenido del mensaje
 * @param {string} params.fecha       - ISO string de la fecha
 * @returns {Promise<boolean>}
 *
 * @example
 * await notificarNuevoMensaje({
 *   mensajeId: '665abc...',
 *   userId:    '664def...',
 *   userName:  'Juan Pérez',
 *   texto:     '¿Cuándo se aprueban los proyectos?',
 *   fecha:     new Date().toISOString(),
 * });
 */
export async function notificarNuevoMensaje({ mensajeId, userId, userName, texto, fecha }) {
  const payload = {
    mensajeId,
    userId,
    userName,
    texto,
    fecha,
    canal: CHANNELS.USER_CHAT(userId),  // El admin sabe a qué canal responder
  };
  return emitirEvento(CHANNELS.ADMIN_CHAT, EVENTS.NEW_MESSAGE, payload);
}

/**
 * Notifica al usuario que el admin respondió su mensaje.
 *
 * Canal destino : chat-user-{userId}
 * Evento        : admin-reply
 *
 * @param {object} params
 * @param {string} params.mensajeId  - MongoDB _id del mensaje de respuesta
 * @param {string} params.userId     - MongoDB _id del usuario destinatario
 * @param {string} params.texto      - Contenido de la respuesta
 * @param {string} params.fecha      - ISO string de la fecha
 * @returns {Promise<boolean>}
 *
 * @example
 * await notificarRespuestaAdmin({
 *   mensajeId: '665xyz...',
 *   userId:    '664def...',
 *   texto:     'Los proyectos se aprueban en un plazo de 5 días hábiles.',
 *   fecha:     new Date().toISOString(),
 * });
 */
export async function notificarRespuestaAdmin({ mensajeId, userId, texto, fecha }) {
  const payload = {
    mensajeId,
    adminNombre: 'Administrador',
    texto,
    fecha,
  };
  return emitirEvento(CHANNELS.USER_CHAT(userId), EVENTS.ADMIN_REPLY, payload);
}
