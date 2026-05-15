import { validationResult } from 'express-validator';

/**
 * Middleware para manejar los errores de validación
 * Este middleware se ejecuta después de las reglas de validación
 */
export const manejarErroresValidacion = (req, res, next) => {
  const errores = validationResult(req);
  
  if (!errores.isEmpty()) {
    return res.status(400).json({
      success: false,
      mensaje: 'Errores de validación',
      errores: errores.array().map(error => ({
        campo: error.path || error.param,
        mensaje: error.msg,
        valor: error.value
      }))
    });
  }
  
  // Si no hay errores, continúa con el siguiente middleware o controlador
  next();
};