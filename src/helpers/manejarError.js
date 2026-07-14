/**
 * helpers/manejarError.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Responde un error de forma centralizada, sin exponer detalles internos
 * (mensajes de Mongo/Mongoose, rutas del servidor, librerías de terceros, etc.)
 * cuando la app corre en producción.
 *
 * En desarrollo (NODE_ENV=development) sí incluye error.message, igual que
 * ya hacía el manejador global de errores en server.js.
 */
export const manejarError = (res, status, message, error) => {
  if (error) console.error(`❌ ${message}:`, error);
  return res.status(status).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? error?.message : undefined,
  });
};
