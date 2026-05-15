import { Router } from 'express';
import {
  listarTodosProyectos,
  obtenerProyectoAdmin,
  actualizarProyectoAdmin,
  eliminarProyectoAdmin,
  aprobarProyecto,
  rechazarProyecto,
  listarProyectosPorCategoriaAdmin,
  buscarProyectosAdmin,
  proyectosDestacadosAdmin,
} from '../controllers/proyectoadmin_controller.js';
import { verificarTokenJWT, verificarAdmin } from '../middlewares/JWT.js';

const router = Router();

// Todos los endpoints admin requieren token + rol admin
router.use(verificarTokenJWT, verificarAdmin);

// ===== LISTAR / BUSCAR =====
router.get('/',                         listarTodosProyectos);          // ?estado=&publico=&categoria=&carrera=&autor=&q=&page=&limit=&sort=
router.get('/buscar',                   buscarProyectosAdmin);           // ?q=&estado=&publico=
router.get('/destacados',               proyectosDestacadosAdmin);
router.get('/categoria/:tipo',          listarProyectosPorCategoriaAdmin);

// ===== CRUD =====
router.get('/:id',                      obtenerProyectoAdmin);
router.put('/:id',                      actualizarProyectoAdmin);
router.delete('/:id',                   eliminarProyectoAdmin);

// ===== CAMBIAR ESTADO — solo admin =====
router.put('/:id/aprobar',              aprobarProyecto);
router.put('/:id/rechazar',             rechazarProyecto);              // body: { motivo: "..." }

export default router;
