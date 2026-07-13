import { Router } from "express";
import { donarPlataforma } from "../controllers/donacion_controller.js";
import { verificarTokenJWT, verificarEstudianteODocente } from "../middlewares/JWT.js";

const router = Router();

// Ruta de donaciones a la plataforma — solo estudiantes o docentes autenticados
router.post("/", verificarTokenJWT, verificarEstudianteODocente, donarPlataforma);

export default router;
