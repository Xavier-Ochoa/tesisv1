/**
 * models/ChatMensaje.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Modelo Mongoose para los mensajes del chat entre usuarios y el admin.
 *
 * Cada documento representa un mensaje (de usuario→admin o de admin→usuario).
 * La conversación se identifica por el campo `usuario` (ObjectId del usuario
 * no-admin implicado en el chat), sin importar quién envió el mensaje.
 */

import { Schema, model } from 'mongoose';

const chatMensajeSchema = new Schema(
  {
    /**
     * Usuario (no admin) dueño de la conversación.
     * Permite recuperar toda la conversación con una sola query:
     *   ChatMensaje.find({ usuario: userId })
     */
    usuario: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: [true, 'El campo usuario es obligatorio'],
      index: true,
    },

    /**
     * Quién escribió este mensaje.
     * Puede ser el mismo usuario o un admin.
     */
    remitente: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: [true, 'El campo remitente es obligatorio'],
    },

    /** Texto del mensaje */
    texto: {
      type: String,
      required: [true, 'El texto del mensaje es obligatorio'],
      trim: true,
      maxlength: [2000, 'El mensaje no puede superar los 2000 caracteres'],
    },

    /** true si fue enviado por el admin, false si fue enviado por el usuario */
    esAdmin: {
      type: Boolean,
      default: false,
    },

    /** true cuando el destinatario lo ha leído */
    leido: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,  // createdAt + updatedAt automáticos
    versionKey: false,
  }
);

// ── Índice compuesto para recuperar conversaciones ordenadas eficientemente ──
chatMensajeSchema.index({ usuario: 1, createdAt: 1 });

const ChatMensaje = model('ChatMensaje', chatMensajeSchema);

export default ChatMensaje;
