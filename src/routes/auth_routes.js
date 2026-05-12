import { Router } from 'express';
import {
  comprobarTokenPasword,
  confirmarMail,
  crearNuevoPassword,
  recuperarPassword,
  registro,
  login,
  cerrarSesion,
  perfil,
  actualizarPerfil,
  actualizarPassword,
  getUnsplashImage,
  fetchQuoteController,
  cambiarRol,
} from '../controllers/auth_controller.js';
import { verificarTokenJWT, verificarAdmin } from '../middlewares/JWT.js';
import { validarRegistro, validarActualizarPerfil } from '../validators/auth_validators.js';
import { manejarErroresValidacion } from '../middlewares/validaciones.js';

const router = Router();

// ===== RUTAS PÚBLICAS =====

/**
 * POST /api/auth/registro
 * Body obligatorio: nombre, apellido, cedula, correoInstitucional, contraseña, rol
 * Body también acepta: email (alias de correoInstitucional), password (alias de contraseña)
 */
router.post(
  '/registro',
  validarRegistro,
  manejarErroresValidacion,
  registro
);

/**
 * POST /api/auth/login
 * Body: correoInstitucional (o email), contraseña (o password)
 */
router.post('/login', login);

// Confirmar correo institucional
router.get('/confirm/:token', confirmarMail);

// Recuperación de contraseña
router.post('/recuperarpassword', recuperarPassword);
router.get('/recuperarpassword/:token', comprobarTokenPasword);
router.post('/nuevopassword/:token', crearNuevoPassword);

// Servicios adicionales
router.get('/random-image', getUnsplashImage);
router.get('/frases', fetchQuoteController);

// ===== RUTAS PROTEGIDAS (requieren JWT) =====

// Cerrar sesión — HU-001
router.post('/logout', verificarTokenJWT, cerrarSesion);

// Ver perfil propio
router.get('/perfil', verificarTokenJWT, perfil);

// Actualizar perfil — el ID se extrae del token, no de la URL
router.put(
  '/perfil',
  verificarTokenJWT,
  validarActualizarPerfil,
  manejarErroresValidacion,
  actualizarPerfil
);

// Cambiar contraseña — el ID se extrae del token, no de la URL
router.put('/password', verificarTokenJWT, actualizarPassword);

// ===== RUTAS DE ADMINISTRADOR =====

// Cambiar rol de cualquier usuario — solo admin, no puede cambiarse a sí mismo
router.patch('/usuarios/:id/rol', verificarTokenJWT, verificarAdmin, cambiarRol);

export default router;
