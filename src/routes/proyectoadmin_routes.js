import { Router } from 'express';
import {
  listarTodosProyectos,
  obtenerProyectoAdmin,
  actualizarProyectoAdmin,
  eliminarProyectoAdmin,
  publicarProyecto,
  despublicarProyecto,
  listarProyectosPorCategoriaAdmin,
  listarProyectosPorCarreraAdmin,
  buscarProyectosAdmin,
  proyectosDestacadosAdmin,
} from '../controllers/proyectoadmin_controller.js';
import { verificarTokenJWT, verificarAdmin } from '../middlewares/JWT.js';

const router = Router();

/**
 * TODAS LAS RUTAS REQUIEREN AUTENTICACIÓN Y ROL DE ADMIN
 */

// ===== RUTAS PRINCIPALES =====
router.get('/', verificarTokenJWT, verificarAdmin, listarTodosProyectos);
router.get('/destacados', verificarTokenJWT, verificarAdmin, proyectosDestacadosAdmin);
router.get('/buscar', verificarTokenJWT, verificarAdmin, buscarProyectosAdmin);
router.get('/categoria/:tipo', verificarTokenJWT, verificarAdmin, listarProyectosPorCategoriaAdmin);
router.get('/carrera/:carrera', verificarTokenJWT, verificarAdmin, listarProyectosPorCarreraAdmin);

// ===== GESTIÓN DE PROYECTOS =====
router.get('/:id', verificarTokenJWT, verificarAdmin, obtenerProyectoAdmin);
router.put('/:id', verificarTokenJWT, verificarAdmin, actualizarProyectoAdmin);
router.delete('/:id', verificarTokenJWT, verificarAdmin, eliminarProyectoAdmin);

// ===== GESTIÓN DE ESTADOS =====
router.put('/:id/publicar', verificarTokenJWT, verificarAdmin, publicarProyecto);
router.put('/:id/despublicar', verificarTokenJWT, verificarAdmin, despublicarProyecto);

export default router;
