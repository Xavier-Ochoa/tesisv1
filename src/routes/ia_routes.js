import { Router } from 'express';
import { generarTitulosProyecto } from '../controllers/ia_controller.js';
import { verificarTokenJWT } from '../middlewares/JWT.js';

const router = Router();

// POST /api/ia/generar-titulo
// Body: { descripcion: string }
// Retorna: { success: boolean, data: { titulos: string[], modelo: string } }
router.post('/generar-titulo', verificarTokenJWT, generarTitulosProyecto);

export default router;
