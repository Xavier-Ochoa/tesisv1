import { Router } from 'express';
import {
  listarEstudiantes,
  obtenerEstudiante,
  estadisticasEstudiantes,
  cambiarEstadoUsuario,
} from '../controllers/estudiante_controller.js';
import { verificarTokenJWT, verificarAdmin } from '../middlewares/JWT.js';

const router = Router();

/**
 * Todas las rutas requieren:
 * 1. Token JWT válido (verificarTokenJWT)
 * 2. Rol de administrador (verificarAdmin)
 */

/**
 * GET /api/admin/estudiantes
 * Listar todos los usuarios con filtros opcionales.
 *
 * Query params opcionales:
 * - rol:      "estudiante" | "docente" | "admin"  → filtra por rol
 * - carrera:  String  → filtro exacto
 * - semestre: Number (0-5) → filtro exacto
 * - apellido: String → búsqueda parcial (case insensitive)
 *
 * Ejemplos:
 * - /api/admin/estudiantes                          → todos los usuarios
 * - /api/admin/estudiantes?rol=docente              → solo docentes
 * - /api/admin/estudiantes?rol=estudiante&semestre=3
 * - /api/admin/estudiantes?apellido=Per
 */
router.get(
  '/',
  verificarTokenJWT,
  verificarAdmin,
  listarEstudiantes
);

/**
 * GET /api/admin/estudiantes/estadisticas
 * Totales globales + desglose por rol, carrera y semestre.
 */
router.get(
  '/estadisticas',
  verificarTokenJWT,
  verificarAdmin,
  estadisticasEstudiantes
);

/**
 * GET /api/admin/estudiantes/:id
 * Obtener un usuario específico por ID.
 */
router.get(
  '/:id',
  verificarTokenJWT,
  verificarAdmin,
  obtenerEstudiante
);

/**
 * PATCH /api/admin/estudiantes/:id/estado
 * Cambiar el estado de un usuario a "activo" o "inactivo".
 * El admin NO puede cambiar su propio estado → 400.
 *
 * Body esperado:
 * {
 *   "estado": "activo" | "inactivo"
 * }
 */
router.patch(
  '/:id/estado',
  verificarTokenJWT,
  verificarAdmin,
  cambiarEstadoUsuario
);


export default router;
