import rateLimit from 'express-rate-limit';

/**
 * Protección contra fuerza bruta en el endpoint de login.
 */
export const loginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10,                 // 10 intentos
    standardHeaders: true,
    legacyHeaders: false,

    message: {
        msg: 'Demasiados intentos de inicio de sesión desde esta IP. Por favor, intenta de nuevo en 15 minutos.',
    },

    // ✅ FORMA CORRECTA (compatible con IPv4 e IPv6)
    keyGenerator: (req, res) => {
        return rateLimit.ipKeyGenerator(req, res);
    },

    skipSuccessfulRequests: true,

    handler: (req, res, next, options) => {
        const ip = rateLimit.ipKeyGenerator(req, res);
        console.warn(`🚫 [Rate Limit] IP bloqueada por exceso de intentos en /login: ${ip}`);
        res.status(options.statusCode).json(options.message);
    },
});
