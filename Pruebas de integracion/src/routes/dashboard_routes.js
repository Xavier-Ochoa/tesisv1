import { Router } from 'express';
import { getEstadisticasAdmin, getEstadisticasUsuario } from '../controllers/dashboard_controller.js';
import { verificarTokenJWT, verificarAdmin } from '../middlewares/JWT.js';

const router = Router();

// Solo admin puede ver estadísticas globales
router.get('/admin',   verificarTokenJWT, verificarAdmin, getEstadisticasAdmin);

// Cualquier usuario logueado ve sus propios datos
router.get('/usuario', verificarTokenJWT, getEstadisticasUsuario);

export default router;
