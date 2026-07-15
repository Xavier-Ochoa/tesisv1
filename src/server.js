// server.js
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth_routes.js";
import proyectoRoutes from "./routes/proyecto_routes.js";
import proyectoAdminRoutes from "./routes/proyectoadmin_routes.js";
import estudianteRoutes from "./routes/estudiante_routes.js";
import donacionRoutes from "./routes/donacion_routes.js";
import dashboardRoutes from "./routes/dashboard_routes.js";
import iaRoutes from "./routes/ia_routes.js";
import chatRoutes from "./routes/chat_routes.js";
import { v2 as cloudinary } from "cloudinary";

// ===== CONFIGURACIÓN DE CLOUDINARY =====
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();

// ===== MIDDLEWARES =====

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
if (!process.env.URL_FRONTEND) {
  console.warn(
    "⚠️  URL_FRONTEND no está definida — CORS solo aceptará los orígenes fijos del array (no hay comodín de respaldo)."
  );
}

app.use(
  cors({
    origin: [
      "https://poliexpo-esfot.vercel.app",
      "http://localhost",
      "https://localhost",
      "capacitor://localhost",
      "http://localhost:4200",
      "http://localhost:3000",
      "http://127.0.0.1:5500",
      "https://tesisfrontend2.vercel.app",
      "https://examen-back-v1.vercel.app",
      process.env.URL_FRONTEND,
    ].filter(Boolean), // limpia el elemento undefined si URL_FRONTEND no está definida
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);

// ===== PÁGINA PRINCIPAL =====

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="es">

<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>API REST - PoliExpo ESFOT</title>

<style>

*{
    margin:0;
    padding:0;
    box-sizing:border-box;
}

body{

    font-family:Segoe UI, Arial, sans-serif;

    background:linear-gradient(135deg,#003B71,#005A9C);

    min-height:100vh;

    display:flex;

    justify-content:center;

    align-items:center;

    color:#333;

    padding:25px;

}

.card{

    width:100%;
    max-width:850px;

    background:#ffffff;

    border-radius:18px;

    overflow:hidden;

    box-shadow:0 18px 40px rgba(0,0,0,.25);

}

.header{

    background:#003B71;

    color:white;

    padding:35px;

    text-align:center;

}

.header h1{

    font-size:38px;

    margin-bottom:10px;

}

.header h2{

    font-size:22px;

    font-weight:400;

}

.content{

    padding:35px;

}

.content p{

    font-size:18px;

    line-height:1.8;

    margin-bottom:18px;

}

.info{

    display:grid;

    grid-template-columns:repeat(auto-fit,minmax(220px,1fr));

    gap:18px;

    margin-top:25px;

}

.box{

    background:#f5f7fa;

    border-left:5px solid #003B71;

    padding:18px;

    border-radius:10px;

}

.box h3{

    color:#003B71;

    margin-bottom:10px;

}

.button{

    display:inline-block;

    margin-top:30px;

    padding:14px 28px;

    background:#003B71;

    color:white;

    text-decoration:none;

    border-radius:8px;

    font-weight:bold;

    transition:.3s;

}

.button:hover{

    background:#005A9C;

}

.footer{

    background:#f3f3f3;

    text-align:center;

    padding:18px;

    color:#555;

    font-size:14px;

}

.status{

    color:#28a745;

    font-weight:bold;

}

</style>

</head>

<body>

<div class="card">

<div class="header">

<h1>🚀 API REST PoliExpo</h1>

<h2>Escuela de Formación de Tecnólogos - ESFOT</h2>

</div>

<div class="content">

<p>

Bienvenido a la API oficial del sistema <strong>PoliExpo</strong>,
desarrollado como parte del Trabajo de Integración Curricular de la
Escuela de Formación de Tecnólogos (ESFOT) de la
Escuela Politécnica Nacional.

</p>

<p>

Esta API permite gestionar proyectos académicos y extracurriculares,
usuarios, estudiantes, donaciones, chat en tiempo real y servicios de
inteligencia artificial mediante una arquitectura REST segura.

</p>

<div class="info">

<div class="box">

<h3>⚙️ Tecnologías</h3>

Node.js<br>
Express.js<br>
MongoDB Atlas<br>
JWT<br>
Cloudinary

</div>

<div class="box">

<h3>📡 Estado</h3>

Servidor:
<span class="status">● En línea</span>

</div>

<div class="box">

<h3>🔒 Seguridad</h3>

Autenticación JWT<br>
Control de Roles<br>
CORS<br>
Validación de Datos

</div>

</div>

<a
class="button"
href="https://documenter.getpostman.com/view/49837957/2sBY4LS36G"
target="_blank">

📘 Ver documentación de la API

</a>

</div>

<div class="footer">

PoliExpo API • ESFOT - Escuela Politécnica Nacional • Versión 1.0

</div>

</div>

</body>

</html>
  `);
});

// ===== RUTAS =====

app.use("/api/auth", authRoutes);
app.use("/api/proyectos", proyectoRoutes);
app.use("/api/admin/proyectos", proyectoAdminRoutes);
app.use("/api/admin/estudiantes", estudianteRoutes);
app.use("/api/donaciones", donacionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/ia", iaRoutes);
app.use("/api/chat", chatRoutes);

// ===== MANEJO DE ERRORES =====

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint no encontrado - 404",
  });
});

app.use((err, req, res, next) => {
  console.error("❌ Error:", err);

  res.status(500).json({
    success: false,
    message: "Error interno del servidor",
    error:
      process.env.NODE_ENV === "development"
        ? err.message
        : undefined,
  });
});

export default app;
