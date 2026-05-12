import { Router } from 'express';
import {
  listarProyectos,
  misProyectos,
  obtenerProyecto,
  crearProyecto,
  actualizarProyecto,
  publicarProyecto,
  despublicarProyecto,
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
import { validarCrearProyecto, validarActualizarProyecto, validarAgregarComentario } from '../validators/proyecto_validators.js';
import { manejarErroresValidacion } from '../middlewares/validaciones.js';

const router = Router();

// ===== RUTAS PÚBLICAS — landing, solo aprobado+publico =====
router.get('/',                     listarProyectos);
router.get('/destacados',           proyectosDestacados);
router.get('/buscar',               buscarProyectos);
router.get('/categoria/:tipo',      listarProyectosPorCategoria);
router.get('/carrera/:carrera',     listarProyectosPorCarrera);
router.get('/estudiante/:id',       listarProyectosPorEstudiante);
router.get('/:id',                  verificarTokenOpcional, obtenerProyecto);

// ===== MIS PROYECTOS — usuario logueado ve solo los suyos =====
router.get('/usuario/mis-proyectos', verificarTokenJWT, misProyectos);

// ===== CRUD — usuario logueado =====
router.post('/',
  verificarTokenJWT,
  validarCrearProyecto,
  manejarErroresValidacion,
  crearProyecto
);

router.put('/:id',
  verificarTokenJWT,
  validarActualizarProyecto,
  manejarErroresValidacion,
  actualizarProyecto
);

router.delete('/:id', verificarTokenJWT, eliminarProyecto);

// ===== PUBLICAR / DESPUBLICAR — solo el autor =====
router.put('/:id/publicar',     verificarTokenJWT, publicarProyecto);
router.put('/:id/despublicar',  verificarTokenJWT, despublicarProyecto);

// ===== LIKES =====
router.post('/:id/like',    verificarTokenJWT, agregarLike);
router.delete('/:id/like',  verificarTokenJWT, quitarLike);

// ===== COMENTARIOS =====
router.post('/:id/comentarios',
  verificarTokenJWT,
  validarAgregarComentario,
  manejarErroresValidacion,
  agregarComentario
);
router.delete('/:id/comentarios/:comentarioId', verificarTokenJWT, eliminarComentario);

// ===== COLABORADORES — solo docentes =====
router.get('/:id/colaboradores',                        verificarTokenJWT, listarColaboradores);
router.post('/:id/colaboradores',                       verificarTokenJWT, verificarDocente, agregarColaborador);
router.delete('/:id/colaboradores/:colaboradorId',      verificarTokenJWT, verificarDocente, eliminarColaborador);

export default router;
