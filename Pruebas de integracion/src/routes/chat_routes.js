/**
 * routes/chat_routes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Rutas del módulo de chat en tiempo real (usuario ↔ admin).
 *
 * Base path montado en server.js: /api/chat
 *
 * ┌─────────────────────────────────────────────┬────────────────────────────┐
 * │ Endpoint                                    │ Descripción                │
 * ├─────────────────────────────────────────────┼────────────────────────────┤
 * │ POST   /api/chat/mensaje                    │ Usuario envía mensaje      │
 * │ GET    /api/chat/mensajes                   │ Usuario ve su conversación │
 * │ POST   /api/chat/admin/responder            │ Admin responde a usuario   │
 * │ GET    /api/chat/admin/conversaciones       │ Admin ve todas las convs.  │
 * │ GET    /api/chat/admin/mensajes/:userId     │ Admin ve conv. de 1 usuario│
 * └─────────────────────────────────────────────┴────────────────────────────┘
 */

import { Router } from 'express';
import { verificarTokenJWT, verificarAdmin } from '../middlewares/JWT.js';
import {
  enviarMensaje,
  responderComoAdmin,
  obtenerMiConversacion,
  obtenerConversacionDeUsuario,
  listarConversaciones,
} from '../controllers/chat_controller.js';

const router = Router();

// ── Rutas de USUARIO (cualquier usuario autenticado) ──────────────────────────

/** Enviar un mensaje al admin */
router.post('/mensaje', verificarTokenJWT, enviarMensaje);

/** Obtener el historial de la propia conversación */
router.get('/mensajes', verificarTokenJWT, obtenerMiConversacion);

// ── Rutas de ADMIN ────────────────────────────────────────────────────────────

/** Responder a un usuario específico */
router.post('/admin/responder', verificarTokenJWT, verificarAdmin, responderComoAdmin);

/** Listar todas las conversaciones activas */
router.get('/admin/conversaciones', verificarTokenJWT, verificarAdmin, listarConversaciones);

/** Ver la conversación completa de un usuario */
router.get('/admin/mensajes/:userId', verificarTokenJWT, verificarAdmin, obtenerConversacionDeUsuario);

export default router;
