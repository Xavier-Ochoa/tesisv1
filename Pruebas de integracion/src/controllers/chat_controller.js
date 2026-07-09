/**
 * controllers/chat_controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Controlador de chat en tiempo real (usuario ↔ admin).
 *
 * Flujo de cada acción:
 *   1. Validar inputs / permisos
 *   2. Guardar mensaje en MongoDB
 *   3. Emitir evento Pusher (no bloqueante — si falla, el HTTP responde igual)
 *   4. Retornar respuesta HTTP
 *
 * NOTA: La lógica de Pusher está completamente delegada a pusherService.js.
 *       Este controlador NO importa pusher directamente.
 */

import ChatMensaje from '../models/ChatMensaje.js';
import Estudiante  from '../models/Estudiante.js';
import { notificarNuevoMensaje, notificarRespuestaAdmin } from '../services/pusherService.js';

// ─────────────────────────────────────────────────────────────────────────────
// USUARIO: Enviar mensaje al admin
// POST /api/chat/mensaje
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Permite a cualquier usuario autenticado enviar un mensaje al admin.
 *
 * Body esperado:
 *   { "texto": "Hola, tengo una consulta..." }
 *
 * Evento Pusher emitido:
 *   Canal : admin-chat
 *   Evento: new-message
 *   Payload: { mensajeId, userId, userName, texto, fecha, canal }
 */
export const enviarMensaje = async (req, res) => {
  try {
    const { texto } = req.body;

    if (!texto?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El texto del mensaje es obligatorio',
      });
    }

    const usuario   = req.estudianteBDD;
    const usuarioId = usuario._id.toString();

    // 1. Guardar en MongoDB
    const mensaje = await ChatMensaje.create({
      usuario:  usuarioId,
      remitente: usuarioId,
      texto:    texto.trim(),
      esAdmin:  false,
    });

    // 2. Emitir evento Pusher (no bloqueante)
    await notificarNuevoMensaje({
      mensajeId: mensaje._id.toString(),
      userId:    usuarioId,
      userName:  `${usuario.nombre} ${usuario.apellido}`,
      texto:     mensaje.texto,
      fecha:     mensaje.createdAt.toISOString(),
    });

    // 3. Responder
    return res.status(201).json({
      success: true,
      message: 'Mensaje enviado correctamente',
      data: {
        _id:      mensaje._id,
        texto:    mensaje.texto,
        esAdmin:  mensaje.esAdmin,
        leido:    mensaje.leido,
        fecha:    mensaje.createdAt,
      },
    });
  } catch (error) {
    console.error('❌ [chat] Error al enviar mensaje:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error al enviar el mensaje',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Responder a un usuario
// POST /api/chat/admin/responder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Permite al admin responder al chat de un usuario específico.
 *
 * Body esperado:
 *   { "userId": "664abc...", "texto": "Buenos días, te informamos que..." }
 *
 * Evento Pusher emitido:
 *   Canal : chat-user-{userId}
 *   Evento: admin-reply
 *   Payload: { mensajeId, adminNombre, texto, fecha }
 */
export const responderComoAdmin = async (req, res) => {
  try {
    const { userId, texto } = req.body;

    if (!userId?.trim()) {
      return res.status(400).json({ success: false, message: 'El campo userId es obligatorio' });
    }
    if (!texto?.trim()) {
      return res.status(400).json({ success: false, message: 'El texto del mensaje es obligatorio' });
    }

    // Verificar que el usuario destinatario existe
    const usuarioDestinatario = await Estudiante.findById(userId).lean().select('nombre apellido email');
    if (!usuarioDestinatario) {
      return res.status(404).json({ success: false, message: 'Usuario destinatario no encontrado' });
    }

    const adminId = req.estudianteBDD._id.toString();

    // 1. Guardar en MongoDB
    const mensaje = await ChatMensaje.create({
      usuario:   userId,
      remitente: adminId,
      texto:     texto.trim(),
      esAdmin:   true,
    });

    // 2. Emitir evento Pusher (no bloqueante)
    await notificarRespuestaAdmin({
      mensajeId: mensaje._id.toString(),
      userId:    userId,
      texto:     mensaje.texto,
      fecha:     mensaje.createdAt.toISOString(),
    });

    // 3. Responder
    return res.status(201).json({
      success: true,
      message: 'Respuesta enviada correctamente',
      data: {
        _id:           mensaje._id,
        texto:         mensaje.texto,
        esAdmin:       mensaje.esAdmin,
        usuarioNombre: `${usuarioDestinatario.nombre} ${usuarioDestinatario.apellido}`,
        fecha:         mensaje.createdAt,
      },
    });
  } catch (error) {
    console.error('❌ [chat] Error al responder como admin:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error al enviar la respuesta',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// USUARIO: Obtener su historial de conversación con el admin
// GET /api/chat/mensajes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve todos los mensajes de la conversación del usuario autenticado
 * con el admin, ordenados por fecha ascendente.
 *
 * Query params opcionales:
 *   ?limite=50    → máximo de mensajes (default: 50, max: 200)
 *   ?pagina=1     → paginación (default: 1)
 */
export const obtenerMiConversacion = async (req, res) => {
  try {
    const usuarioId = req.estudianteBDD._id.toString();

    const limite = Math.min(parseInt(req.query.limite) || 50, 200);
    const pagina = Math.max(parseInt(req.query.pagina) || 1, 1);
    const skip   = (pagina - 1) * limite;

    const [mensajes, total] = await Promise.all([
      ChatMensaje.find({ usuario: usuarioId })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limite)
        .lean(),
      ChatMensaje.countDocuments({ usuario: usuarioId }),
    ]);

    // Marcar como leídos los mensajes del admin que el usuario aún no leyó
    await ChatMensaje.updateMany(
      { usuario: usuarioId, esAdmin: true, leido: false },
      { $set: { leido: true } }
    );

    return res.status(200).json({
      success: true,
      data: {
        mensajes,
        paginacion: {
          total,
          pagina,
          limite,
          totalPaginas: Math.ceil(total / limite),
        },
      },
    });
  } catch (error) {
    console.error('❌ [chat] Error al obtener conversación:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener la conversación',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Obtener conversación de un usuario específico
// GET /api/chat/admin/mensajes/:userId
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve el historial completo de un usuario para el panel de admin.
 */
export const obtenerConversacionDeUsuario = async (req, res) => {
  try {
    const { userId } = req.params;

    const usuario = await Estudiante.findById(userId).lean().select('nombre apellido email rol');
    if (!usuario) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const limite = Math.min(parseInt(req.query.limite) || 100, 200);
    const pagina = Math.max(parseInt(req.query.pagina) || 1, 1);
    const skip   = (pagina - 1) * limite;

    const [mensajes, total] = await Promise.all([
      ChatMensaje.find({ usuario: userId })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limite)
        .lean(),
      ChatMensaje.countDocuments({ usuario: userId }),
    ]);

    // Marcar como leídos los mensajes del usuario que el admin aún no leyó
    await ChatMensaje.updateMany(
      { usuario: userId, esAdmin: false, leido: false },
      { $set: { leido: true } }
    );

    return res.status(200).json({
      success: true,
      data: {
        usuario: {
          _id:      usuario._id,
          nombre:   usuario.nombre,
          apellido: usuario.apellido,
          email:    usuario.email,
          rol:      usuario.rol,
        },
        mensajes,
        paginacion: {
          total,
          pagina,
          limite,
          totalPaginas: Math.ceil(total / limite),
        },
      },
    });
  } catch (error) {
    console.error('❌ [chat] Error al obtener conversación de usuario:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener la conversación',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Listar todas las conversaciones con mensajes sin leer
// GET /api/chat/admin/conversaciones
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve un resumen de todas las conversaciones activas para el panel admin.
 * Incluye: datos del usuario, último mensaje y cantidad de mensajes sin leer.
 */
export const listarConversaciones = async (req, res) => {
  try {
    // Agrupar por usuario, obtener último mensaje y count de no leídos
    const conversaciones = await ChatMensaje.aggregate([
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id:             '$usuario',
          ultimoMensaje:   { $first: '$texto' },
          ultimaFecha:     { $first: '$createdAt' },
          sinLeer:         {
            $sum: {
              $cond: [{ $and: [{ $eq: ['$esAdmin', false] }, { $eq: ['$leido', false] }] }, 1, 0],
            },
          },
        },
      },
      {
        $sort: { ultimaFecha: -1 },
      },
      {
        $lookup: {
          from:         'usuarios',
          localField:   '_id',
          foreignField: '_id',
          as:           'usuarioInfo',
        },
      },
      {
        $unwind: '$usuarioInfo',
      },
      {
        $project: {
          _id:           0,
          userId:        '$_id',
          nombre:        '$usuarioInfo.nombre',
          apellido:      '$usuarioInfo.apellido',
          email:         '$usuarioInfo.email',
          ultimoMensaje: 1,
          ultimaFecha:   1,
          sinLeer:       1,
          canalPusher:   { $concat: ['chat-user-', { $toString: '$_id' }] },
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: conversaciones,
    });
  } catch (error) {
    console.error('❌ [chat] Error al listar conversaciones:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error al listar las conversaciones',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
