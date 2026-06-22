import { Router } from 'express';
import {
  listarTodosProyectos,
  obtenerProyectoAdmin,
  actualizarProyectoAdmin,
  desactivarProyectoAdmin,
  reactivarProyectoAdmin,
  aprobarProyecto,
  rechazarProyecto,
  proyectosDestacadosAdmin,
  historialVersionesAdmin,
} from '../controllers/proyectoadmin_controller.js';
import { verificarTokenJWT, verificarAdmin } from '../middlewares/JWT.js';

const router = Router();

// Todos los endpoints admin requieren token + rol admin
router.use(verificarTokenJWT, verificarAdmin);

// ── LISTAR / BUSCAR ───────────────────────────────────────────────────────────
// Soporta query params: ?categoria=academico|extracurricular  ?q=texto  ?estado=  ?autor=  ?sort=  ?page=  ?limit=
router.get('/',                         listarTodosProyectos);
router.get('/destacados',               proyectosDestacadosAdmin);

// ── HISTORIAL DE VERSIONES ────────────────────────────────────────────────────
// GET /admin/proyectos/versiones/:proyectoId
router.get('/versiones/:proyectoId',    historialVersionesAdmin);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.get('/:id',                      obtenerProyectoAdmin);
router.put('/:id',                      actualizarProyectoAdmin);

// ── BORRADO LÓGICO / REACTIVACIÓN ─────────────────────────────────────────────
// El admin NO puede borrar permanentemente, solo desactivar/reactivar
router.put('/:id/desactivar',           desactivarProyectoAdmin);
router.put('/:id/reactivar',            reactivarProyectoAdmin);

// ── CAMBIAR ESTADO ────────────────────────────────────────────────────────────
router.put('/:id/aprobar',              aprobarProyecto);
router.put('/:id/rechazar',             rechazarProyecto);

export default router;
