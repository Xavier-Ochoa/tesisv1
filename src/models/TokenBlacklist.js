import { Schema, model } from 'mongoose';

/**
 * Modelo para la lista negra de tokens JWT invalidados.
 * Cuando un usuario cierra sesión, su token se registra aquí
 * y el middleware de verificación lo rechazará aunque sea válido.
 *
 * TTL: MongoDB elimina automáticamente el documento cuando
 * la fecha `expiresAt` ya pasó, por lo que la colección no
 * crece indefinidamente.
 */
const tokenBlacklistSchema = new Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Fecha en que el token expira naturalmente (1 día, igual que el JWT).
    // El índice TTL de Mongo limpia el documento en ese momento.
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // 0 = eliminar exactamente en expiresAt
    },
  },
  {
    timestamps: false, // No necesitamos createdAt/updatedAt aquí
  }
);

export default model('TokenBlacklist', tokenBlacklistSchema);
