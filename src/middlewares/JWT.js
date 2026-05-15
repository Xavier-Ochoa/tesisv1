import jwt from "jsonwebtoken"
import Estudiante from "../models/Estudiante.js"
import TokenBlacklist from "../models/TokenBlacklist.js"

/**
 * Crear token JWT (expira en 1 día).
 * @param {string} id  - ID del usuario
 * @param {string} rol - Rol del usuario
 * @returns {string} token JWT firmado
 */
const crearTokenJWT = (id, rol) => {
    return jwt.sign({ id, rol }, process.env.JWT_SECRET, { expiresIn: "1d" })
}

/**
 * Devuelve la fecha de expiración embebida en un JWT ya firmado.
 * Se usa en el controlador de logout para fijar el TTL del documento
 * en la blacklist.
 * @param {string} token - JWT firmado
 * @returns {Date} fecha de expiración
 */
const obtenerExpiracionToken = (token) => {
    const { exp } = jwt.decode(token)
    return new Date(exp * 1000) // exp está en segundos, Date espera milisegundos
}

/**
 * Middleware de verificación JWT.
 * Rechaza la solicitud si:
 *   - No hay token en el header Authorization
 *   - El token está en la blacklist (sesión cerrada)
 *   - El token es inválido o expiró
 */
const verificarTokenJWT = async (req, res, next) => {
    const { authorization } = req.headers

    if (!authorization) {
        return res.status(401).json({ msg: "Acceso denegado: token no proporcionado" })
    }

    try {
        const token = authorization.split(" ")[1]

        // ── Verificar si el token fue invalidado por cierre de sesión ──
        const tokenInvalidado = await TokenBlacklist.findOne({ token })
        if (tokenInvalidado) {
            return res.status(401).json({ msg: "Sesión cerrada. Por favor inicia sesión nuevamente." })
        }

        // ── Verificar firma y expiración ──
        const { id, rol } = jwt.verify(token, process.env.JWT_SECRET)

        // ── Buscar al usuario en la base de datos ──
        const estudianteBDD = await Estudiante.findById(id).lean().select("-password +estado +confirmEmail")

        if (!estudianteBDD) {
            return res.status(401).json({ msg: "Usuario no encontrado" })
        }

        // Verificar que la cuenta esté activa
        if (estudianteBDD.estado === 'inactivo') {
            return res.status(403).json({ msg: 'Tu cuenta ha sido suspendida. Contacta con el administrador.' })
        }

        // Adjuntar usuario y token a la request (el token se necesita en logout)
        req.estudianteHeader = estudianteBDD
        req.estudianteBDD    = estudianteBDD
        req.tokenActual      = token

        next()

    } catch (error) {
        console.error("Error JWT:", error.message)
        return res.status(401).json({ msg: `Token inválido o expirado: ${error.message}` })
    }
}

/**
 * Middleware para rutas exclusivas de administrador.
 * Debe usarse DESPUÉS de verificarTokenJWT.
 */
const verificarAdmin = (req, res, next) => {
    if (req.estudianteBDD.rol !== 'admin') {
        return res.status(403).json({
            msg: "Acceso denegado: se requieren permisos de administrador"
        })
    }
    next()
}

/**
 * Middleware para rutas exclusivas de docente.
 * Debe usarse DESPUÉS de verificarTokenJWT.
 */
const verificarDocente = (req, res, next) => {
    if (req.estudianteBDD.rol !== 'docente') {
        return res.status(403).json({
            msg: "Acceso denegado: se requieren permisos de docente"
        })
    }
    next()
}

/**
 * Middleware para rutas accesibles tanto por docentes como por admins.
 * Debe usarse DESPUÉS de verificarTokenJWT.
 */
const verificarDocenteOAdmin = (req, res, next) => {
    const rolesPermitidos = ['docente', 'admin']
    if (!rolesPermitidos.includes(req.estudianteBDD.rol)) {
        return res.status(403).json({
            msg: "Acceso denegado: se requieren permisos de docente o administrador"
        })
    }
    next()
}

/**
 * Middleware de token OPCIONAL.
 * Si hay token válido lo decodifica y adjunta req.estudianteBDD.
 * Si no hay token (o es inválido) simplemente continúa sin bloquear.
 * Útil para rutas públicas que necesitan saber si el usuario es el autor.
 */
const verificarTokenOpcional = async (req, res, next) => {
    const { authorization } = req.headers
    if (!authorization) return next()

    try {
        const token = authorization.split(' ')[1]
        if (!token) return next()

        const enBlacklist = await TokenBlacklist.findOne({ token })
        if (enBlacklist) return next()

        const { id } = jwt.verify(token, process.env.JWT_SECRET)
        const estudianteBDD = await Estudiante.findById(id).lean().select('-password +estado +confirmEmail')
        if (estudianteBDD) {
            req.estudianteBDD    = estudianteBDD
            req.estudianteHeader = estudianteBDD
            req.tokenActual      = token
        }
    } catch {
        // Token inválido o expirado — simplemente ignorar y continuar
    }
    next()
}

export {
    crearTokenJWT,
    obtenerExpiracionToken,
    verificarTokenJWT,
    verificarTokenOpcional,
    verificarAdmin,
    verificarDocente,
    verificarDocenteOAdmin,
}
