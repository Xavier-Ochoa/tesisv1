import { Router } from 'express';
import { fileUploadMiddleware } from '../middlewares/upload.js';
import {
  listarProyectos,
  misProyectos,
  obtenerProyecto,
  crearProyecto,
  actualizarProyecto,
  crearNuevaVersion,
  eliminarProyecto,
  historialVersiones,
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
  eliminarImagenProyecto,
  actualizarProyectoColaborador,
  eliminarImagenColaborador,
  dondeColabora,
  misProyectosConColaboradores,
} from '../controllers/proyecto_controller.js';
import { verificarTokenJWT, verificarDocente, verificarTokenOpcional } from '../middlewares/JWT.js';
import {
  validarCrearProyecto,
  validarActualizarProyecto,
  validarAgregarComentario,
} from '../validators/proyecto_validators.js';
import { manejarErroresValidacion } from '../middlewares/validaciones.js';

const router = Router();

// ── LANDING (públicas) ────────────────────────────────────────────────────────
router.get('/',                      listarProyectos);
router.get('/destacados',            proyectosDestacados);
router.get('/buscar',                buscarProyectos);
router.get('/categoria/:tipo',       listarProyectosPorCategoria);
router.get('/carrera/:carrera',      listarProyectosPorCarrera);
router.get('/estudiante/:id',        listarProyectosPorEstudiante);

// ── MIS PROYECTOS ─────────────────────────────────────────────────────────────
router.get('/usuario/mis-proyectos', verificarTokenJWT, misProyectos);

// ── DETALLE ───────────────────────────────────────────────────────────────────
router.get('/donde-colaboro',                    verificarTokenJWT, dondeColabora);
router.get('/mis-proyectos-con-colaboradores', verificarTokenJWT, misProyectosConColaboradores);
router.get('/:id',                   verificarTokenOpcional, obtenerProyecto);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.post('/',
  verificarTokenJWT,
  fileUploadMiddleware,
  validarCrearProyecto,
  manejarErroresValidacion,
  crearProyecto
);

router.put('/:id',
  verificarTokenJWT,
  fileUploadMiddleware,
  validarActualizarProyecto,
  manejarErroresValidacion,
  actualizarProyecto
);

router.delete('/:id', verificarTokenJWT, eliminarProyecto);

// ── VERSIONADO ────────────────────────────────────────────────────────────────
// GET  /proyectos/versiones/:proyectoId  → historial de versiones por proyecto_id
// POST /proyectos/:id/versiones          → crear nueva versión a partir del _id actual
router.get('/versiones/:proyectoId',  verificarTokenJWT, historialVersiones);
router.post('/:id/versiones',
  verificarTokenJWT,
  fileUploadMiddleware,
  validarActualizarProyecto,
  manejarErroresValidacion,
  crearNuevaVersion
);

// ── IMÁGENES ──────────────────────────────────────────────────────────────────
router.delete('/:id/imagenes', verificarTokenJWT, eliminarImagenProyecto);

// ── LIKES ─────────────────────────────────────────────────────────────────────
router.post('/:id/like',   verificarTokenJWT, agregarLike);
router.delete('/:id/like', verificarTokenJWT, quitarLike);

// ── COMENTARIOS ───────────────────────────────────────────────────────────────
router.post('/:id/comentarios',
  verificarTokenJWT,
  validarAgregarComentario,
  manejarErroresValidacion,
  agregarComentario
);
router.delete('/:id/comentarios/:comentarioId', verificarTokenJWT, eliminarComentario);

// ── COLABORADORES ─────────────────────────────────────────────────────────────
router.get('/:id/colaboradores',                   verificarTokenJWT, listarColaboradores);
router.post('/:id/colaboradores',                  verificarTokenJWT, verificarDocente, agregarColaborador);
router.delete('/:id/colaboradores/:colaboradorId', verificarTokenJWT, verificarDocente, eliminarColaborador);

// ── EDICIÓN POR COLABORADOR ───────────────────────────────────────────────────
router.put('/:id/colaborador',             verificarTokenJWT, actualizarProyectoColaborador);
router.delete('/:id/colaborador/imagenes', verificarTokenJWT, eliminarImagenColaborador);

export default router;
