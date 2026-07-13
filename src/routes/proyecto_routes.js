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
  agregarLike,
  quitarLike,
  agregarComentario,
  eliminarComentario,
  proyectosDestacados,
  agregarColaborador,
  eliminarColaborador,
  listarColaboradores,
  eliminarImagenProyecto,
  actualizarProyectoColaborador,
  eliminarImagenColaborador,
  dondeColabora,
  misProyectosConColaboradores,
  publicarProyecto,
  subirDocumentoProyecto,
  eliminarDocumentoProyecto,
  descargarDocumentoProyecto,
} from '../controllers/proyecto_controller.js';
import { verificarTokenJWT, verificarDocente, verificarTokenOpcional, verificarEstudianteODocente } from '../middlewares/JWT.js';
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
router.get('/categoria/:tipo',       listarProyectosPorCategoria);
router.get('/estudiante/:id',        listarProyectosPorEstudiante);

// ── MIS PROYECTOS ─────────────────────────────────────────────────────────────
router.get('/usuario/mis-proyectos', verificarTokenJWT, misProyectos);

// ── RUTAS ESTÁTICAS (deben ir ANTES de /:id para evitar conflictos) ───────────
router.get('/donde-colaboro',                  verificarTokenJWT, dondeColabora);
router.get('/mis-proyectos-con-colaboradores', verificarTokenJWT, misProyectosConColaboradores);
// FIX: /versiones/:proyectoId estaba después de /:id y era interceptado por él
router.get('/versiones/:proyectoId',           verificarTokenJWT, historialVersiones);

// ── DETALLE ───────────────────────────────────────────────────────────────────
router.get('/:id', verificarTokenOpcional, obtenerProyecto);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.post('/', verificarTokenJWT, fileUploadMiddleware, validarCrearProyecto, manejarErroresValidacion, crearProyecto);
router.put('/:id', verificarTokenJWT, fileUploadMiddleware, validarActualizarProyecto, manejarErroresValidacion, actualizarProyecto);
router.delete('/:id', verificarTokenJWT, eliminarProyecto);

// ── PUBLICAR (autor) — solo si aprobado ───────────────────────────────────────
router.put('/:id/publicar', verificarTokenJWT, publicarProyecto);

// ── VERSIONADO (POST) ─────────────────────────────────────────────────────────
router.post('/:id/versiones', verificarTokenJWT, fileUploadMiddleware, validarActualizarProyecto, manejarErroresValidacion, crearNuevaVersion);

// ── IMÁGENES ──────────────────────────────────────────────────────────────────
router.delete('/:id/imagenes', verificarTokenJWT, eliminarImagenProyecto);

// ── DOCUMENTO PDF (GridFS) ────────────────────────────────────────────────────
// PUT  /:id/documento  → subir/reemplazar PDF (campo form-data: "documento")
// GET  /:id/documento  → descargar/ver PDF en el navegador
// DELETE /:id/documento → eliminar PDF
router.put('/:id/documento',    verificarTokenJWT, fileUploadMiddleware, subirDocumentoProyecto);
router.get('/:id/documento',    verificarTokenOpcional, descargarDocumentoProyecto);
router.delete('/:id/documento', verificarTokenJWT, eliminarDocumentoProyecto);

// ── LIKES ─────────────────────────────────────────────────────────────────────
router.post('/:id/like',   verificarTokenJWT, verificarEstudianteODocente, agregarLike);
router.delete('/:id/like', verificarTokenJWT, verificarEstudianteODocente, quitarLike);

// ── COMENTARIOS ───────────────────────────────────────────────────────────────
router.post('/:id/comentarios', verificarTokenJWT, validarAgregarComentario, manejarErroresValidacion, agregarComentario);
router.delete('/:id/comentarios/:comentarioId', verificarTokenJWT, eliminarComentario);

// ── COLABORADORES ─────────────────────────────────────────────────────────────
router.get('/:id/colaboradores',                   verificarTokenJWT, listarColaboradores);
router.post('/:id/colaboradores',                  verificarTokenJWT, verificarDocente, agregarColaborador);
router.delete('/:id/colaboradores/:colaboradorId', verificarTokenJWT, verificarDocente, eliminarColaborador);

// ── EDICIÓN POR COLABORADOR ───────────────────────────────────────────────────
router.put('/:id/colaborador',             verificarTokenJWT, fileUploadMiddleware, actualizarProyectoColaborador);
router.delete('/:id/colaborador/imagenes', verificarTokenJWT, eliminarImagenColaborador);

export default router;
