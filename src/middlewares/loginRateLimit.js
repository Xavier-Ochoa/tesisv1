import rateLimit from 'express-rate-limit';

/**
 * Protección contra fuerza bruta en el endpoint de login.
 *
 * CAPA 1 — Rate limiting por IP (express-rate-limit):
 *   - Máximo 10 intentos por IP en una ventana de 15 minutos.
 *   - Si se supera el límite, la IP queda bloqueada hasta que expire la ventana.
 *   - Responde con HTTP 429 y un mensaje claro.
 *
 * Este middleware solo se aplica a la ruta POST /api/auth/login.
 * No afecta ningún otro endpoint.
 */
export const loginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // ventana de 15 minutos
    max: 10,                   // máximo 10 intentos por IP en esa ventana
    standardHeaders: true,     // envía cabeceras RateLimit-* estándar (RFC 6585)
    legacyHeaders: false,      // desactiva cabeceras X-RateLimit-* antiguas

    // Mensaje de respuesta cuando se supera el límite
    message: {
        msg: 'Demasiados intentos de inicio de sesión desde esta IP. Por favor, intenta de nuevo en 15 minutos.',
    },

    // Clave de identificación: usa la IP real incluso detrás de un proxy/Vercel
    keyGenerator: (req) => {
        return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
            || req.ip
            || 'unknown';
    },

    // Solo cuenta como intento fallido si la respuesta fue un error (4xx/5xx)
    // Las respuestas 200 (login exitoso) no penalizan el contador
    skipSuccessfulRequests: true,

    // Log opcional para monitoreo en desarrollo
    handler: (req, res, next, options) => {
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
        console.warn(`🚫 [Rate Limit] IP bloqueada por exceso de intentos en /login: ${ip}`);
        res.status(options.statusCode).json(options.message);
    },
});
