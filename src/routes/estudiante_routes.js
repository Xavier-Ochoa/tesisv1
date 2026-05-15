import { Router } from 'express';
import {
  listarEstudiantes,
  obtenerEstudiante,
  estadisticasEstudiantes,
  eliminarUsuario,
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
 * - semestre: Number (1-8) → filtro exacto
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
 * DELETE /api/admin/estudiantes/:id
 * Eliminar cualquier usuario (estudiante o docente).
 * El admin NO puede eliminarse a sí mismo → 400.
 */
router.delete(
  '/:id',
  verificarTokenJWT,
  verificarAdmin,
  eliminarUsuario
);

export default router;
