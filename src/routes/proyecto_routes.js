import { Router } from 'express';
import {
  listarProyectos,
  obtenerProyecto,
  crearProyecto,
  actualizarProyecto,
  eliminarProyecto,
  listarProyectosPorCategoria,
  listarProyectosPorEstudiante,
  buscarProyectos,
  agregarLike,
  quitarLike,
  agregarComentario,
  eliminarComentario,
  proyectosDestacados,
  listarProyectosPorCarrera,
  agregarColaborador,
  eliminarColaborador,
  listarColaboradores,
} from '../controllers/proyecto_controller.js';
import { verificarTokenJWT, verificarDocente, verificarTokenOpcional } from '../middlewares/JWT.js';

import { 
  validarCrearProyecto, 
  validarActualizarProyecto,
  validarAgregarComentario 
} from '../validators/proyecto_validators.js';
import { manejarErroresValidacion } from '../middlewares/validaciones.js';

const router = Router();

// ===== RUTAS PÚBLICAS =====
router.get('/', verificarTokenOpcional, listarProyectos);
router.get('/destacados', proyectosDestacados);
router.get('/buscar', buscarProyectos);
router.get('/categoria/:tipo', listarProyectosPorCategoria);
router.get('/carrera/:carrera', listarProyectosPorCarrera);
router.get('/estudiante/:id', verificarTokenOpcional, listarProyectosPorEstudiante);
router.get('/:id', verificarTokenOpcional, obtenerProyecto);

// ===== RUTAS PROTEGIDAS =====

// Crear proyecto
router.post(
  '/', 
  verificarTokenJWT,
  validarCrearProyecto,
  manejarErroresValidacion,
  crearProyecto
);

// Actualizar proyecto
router.put(
  '/:id', 
  verificarTokenJWT,
  validarActualizarProyecto,
  manejarErroresValidacion,
  actualizarProyecto
);

// Eliminar proyecto
router.delete('/:id', verificarTokenJWT, eliminarProyecto);

// Likes
router.post('/:id/like', verificarTokenJWT, agregarLike);
router.delete('/:id/like', verificarTokenJWT, quitarLike);

// Comentarios
router.post(
  '/:id/comentarios', 
  verificarTokenJWT,
  validarAgregarComentario,
  manejarErroresValidacion,
  agregarComentario
);
router.delete('/:id/comentarios/:comentarioId', verificarTokenJWT, eliminarComentario);

// ===== RUTAS DE COLABORADORES (solo docentes) =====
// BUG FIX: Estas rutas estaban definidas DESPUÉS del export default router,
// lo que es un error estructural. Movidas aquí, antes del export.

// Listar colaboradores (cualquier usuario autenticado)
router.get('/:id/colaboradores', verificarTokenJWT, listarColaboradores);

// Agregar colaborador (solo docente autor)
router.post('/:id/colaboradores', verificarTokenJWT, verificarDocente, agregarColaborador);

// Eliminar colaborador (solo docente autor)
router.delete('/:id/colaboradores/:colaboradorId', verificarTokenJWT, verificarDocente, eliminarColaborador);

export default router;
