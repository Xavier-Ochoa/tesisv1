import { Router } from "express";
import { donarPlataforma } from "../controllers/donacion_controller.js";

const router = Router();

// Ruta pública única para donaciones a la plataforma
router.post("/", donarPlataforma);

export default router;