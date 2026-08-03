LINK DEL BACKEND = https://tesisv1-two.vercel.app

# Sistema Web de Proyectos ESFOT - Backend (PoliExpo)

**Plataforma digital para centralizar, organizar y publicar proyectos académicos y extracurriculares de la ESFOT - EPN**

[Features](#features) • [Arquitectura](#arquitectura) • [Requisitos](#requisitos) • [Instalación](#instalación) • [Configuración](#configuración) • [Documentación de API](#documentación-de-api) • [Modelos de Datos](#modelos-de-datos) • [Seguridad](#seguridad) • [Despliegue](#despliegue)

---

## Descripción del Proyecto

Este backend (nombre interno de paquete `poli-expo`) implementa una API REST para la **Escuela de Formación de Tecnólogos (ESFOT)** de la Escuela Politécnica Nacional, que permite a estudiantes, docentes y administradores:

- **Registrar y gestionar** proyectos académicos y extracurriculares, con control de versiones.
- **Publicar contenido multimedia** (imágenes en Cloudinary y documentos PDF en GridFS).
- **Colaborar en proyectos** invitando a otros usuarios como colaboradores.
- **Interactuar** mediante likes y comentarios.
- **Chatear en tiempo real** con soporte/administración (Pusher).
- **Consultar estadísticas** desde un dashboard administrativo y personal.
- **Recibir donaciones** para la plataforma vía Stripe.

### Contexto y Problemática

Anteriormente, la ESFOT carecía de un sistema centralizado para almacenar y gestionar los proyectos estudiantiles, lo que causaba:
- ❌ Pérdida de registros históricos
- ❌ Baja visibilidad de logros estudiantiles
- ❌ Ausencia de repositorio formal para la comunidad académica
- ❌ Limitaciones en la colaboración docente-estudiante

### Solución

Un **backend en Node.js/Express** con MongoDB (Mongoose) que centraliza la gestión de proyectos, usuarios, comunicación y estadísticas, listo para desplegarse en Vercel.

---

## Features

### ✅ Autenticación y Autorización
- Registro (`/api/auth/registro`) y login (`/api/auth/login`) con correo institucional (`@epn.edu.ec`) y contraseña.
- JWT (expira en 1 día) para autorizar endpoints.
- Blacklist de tokens en MongoDB (TTL) para invalidar sesiones al hacer logout.
- Roles: `estudiante`, `docente`, `admin`.
- Confirmación de correo por token y reenvío de confirmación.
- Recuperación y cambio de contraseña por token (1 hora de vigencia).
- Cambio de rol de usuario (solo admin, no puede cambiar su propio rol).

### 📁 Gestión de Proyectos
- CRUD completo de proyectos, con **versionado** (`proyecto_id`, `version`, `esUltimaVersion`) e historial de versiones.
- Categorías: `academico` / `extracurricular`.
- Flujo de aprobación: `pendiente` → `aprobado` / `rechazado` (revisión del admin), y publicación posterior a landing (`publico`) solo por el autor.
- Borrado lógico (desactivar/reactivar) exclusivo del admin; el admin **no** puede editar el contenido del proyecto.
- Subida de imágenes (Cloudinary) y de un documento PDF por proyecto (GridFS, bucket `proyectos_docs`).
- Búsqueda por texto (índice `text` sobre título, descripción y palabras clave), filtros por categoría y estudiante, y listado de destacados.

### 👥 Colaboración
- Agregar/eliminar/listar colaboradores de un proyecto (gestionado por docentes).
- Edición del proyecto por parte de un colaborador (incluyendo imágenes).
- Endpoints para ver "dónde colaboro" y "mis proyectos con colaboradores".

### 💬 Chat en Tiempo Real
- Mensajería usuario ↔ admin persistida en MongoDB, con notificación en tiempo real vía **Pusher**.
- Endpoints separados para el usuario (enviar/ver su conversación) y para el admin (responder, listar conversaciones, ver conversación de un usuario).

### 🤖 Inteligencia Artificial
- Generación de 3 sugerencias de título de proyecto a partir de una descripción, usando la API de **Hugging Face** (`meta-llama/Llama-3.1-8B-Instruct`).

### 💳 Donaciones
- Donación única a la plataforma procesada con **Stripe** (`PaymentIntent`), con registro en MongoDB.

### 📊 Dashboard
- Estadísticas globales para el admin (proyectos por categoría/estado/carrera del autor, donaciones por mes, etc.).
- Estadísticas personales para cualquier usuario autenticado.

### 🎨 Otros servicios
- Imagen aleatoria vía **Unsplash** y frases motivacionales para pantallas de login/registro.
- Notificaciones por correo con **Nodemailer** (Mailtrap en desarrollo).

---

## Arquitectura

```
src/
├── config/
│   ├── nodemailer.js         # Transporte de correo (Mailtrap)
│   └── pusher.js             # Cliente de Pusher (chat en tiempo real)
├── controllers/
│   ├── auth_controller.js
│   ├── chat_controller.js
│   ├── dashboard_controller.js
│   ├── donacion_controller.js
│   ├── estudiante_controller.js
│   ├── ia_controller.js
│   ├── proyecto_controller.js
│   └── proyectoadmin_controller.js
├── helpers/
│   ├── generarProyectoId.js  # Generación de proyecto_id para versionado
│   ├── gridfs.js             # Subida/descarga/borrado de PDFs en GridFS
│   ├── reglasProyecto.js     # Reglas de negocio de proyectos
│   ├── sendMail.js           # Envío de correos (confirmación, recuperación)
│   └── uploadCloudinary.js   # Subida de imágenes a Cloudinary
├── middlewares/
│   ├── JWT.js                # verificarTokenJWT, verificarTokenOpcional, verificarAdmin, verificarDocente
│   ├── upload.js             # fileUploadMiddleware (express-fileupload)
│   └── validaciones.js       # manejarErroresValidacion (express-validator)
├── models/
│   ├── ChatMensaje.js
│   ├── Donacion.js
│   ├── Estudiante.js         # colección 'usuarios' (modelo Mongoose: Usuario)
│   ├── Proyecto.js
│   └── TokenBlacklist.js
├── routes/
│   ├── auth_routes.js
│   ├── chat_routes.js
│   ├── dashboard_routes.js
│   ├── donacion_routes.js
│   ├── estudiante_routes.js
│   ├── ia_routes.js
│   ├── proyecto_routes.js
│   └── proyectoadmin_routes.js
├── services/
│   ├── frases.js             # Frases motivacionales
│   ├── imagenFondo.js        # Imagen aleatoria (Unsplash)
│   ├── pusherService.js      # Envío de eventos por Pusher
│   └── translateApi.js
├── validators/
│   ├── auth_validators.js
│   └── proyecto_validators.js
├── server.js                 # Configuración de Express, CORS y montaje de rutas
└── index.js                  # Punto de entrada: conecta MongoDB y levanta el servidor
```

### Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Runtime** | Node.js (módulos ES, `"type": "module"`) |
| **Framework** | Express 5.1.0 |
| **Base de Datos** | MongoDB + Mongoose 8.19.2 (incluye GridFS para PDFs) |
| **Autenticación** | JWT (jsonwebtoken) + Bcryptjs |
| **Almacenamiento de imágenes** | Cloudinary |
| **Subida de archivos** | express-fileupload / multer |
| **Email** | Nodemailer (Mailtrap) |
| **Validación** | express-validator |
| **IA** | Hugging Face Router API |
| **Pagos** | Stripe |
| **Tiempo real** | Pusher |
| **Despliegue** | Vercel |

---

## Requisitos

### Mínimos del Sistema
- **Node.js** 18+ (el proyecto usa `import`/ESM y `node --watch` para desarrollo)
- **npm**
- **MongoDB** (local o Atlas, con soporte GridFS)

### Cuentas / Servicios Externos Requeridos
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) — base de datos
- [Cloudinary](https://cloudinary.com/) — almacenamiento de imágenes
- [Mailtrap](https://mailtrap.io/) (o cualquier SMTP compatible con Nodemailer) — envío de correos
- [Hugging Face](https://huggingface.co/) — generación de títulos con IA
- [Stripe](https://stripe.com/) — procesamiento de donaciones
- [Pusher](https://pusher.com/) — chat en tiempo real
- [Unsplash](https://unsplash.com/developers) — imágenes de fondo aleatorias

---

## Instalación

### 1️⃣ Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/tesisv1.git
cd tesisv1
```

### 2️⃣ Instalar dependencias

```bash
npm install
```

### 3️⃣ Configurar variables de entorno

Crear un archivo `.env` en la raíz del proyecto con las variables descritas en [Configuración](#configuración).

### 4️⃣ Ejecutar en desarrollo

```bash
npm run dev
```

Este comando ejecuta `node --watch src/index.js`, por lo que el servidor se reinicia automáticamente al detectar cambios.

### 5️⃣ Ejecutar en producción

```bash
npm start
```

Equivalente a `node src/index.js`. El servidor quedará disponible en `http://localhost:<PORT>` (por defecto `3000`).

---

## Configuración

### Variables de Entorno

Estas son **todas** las variables leídas por el código (`process.env`):

```env
# ========== BASE DE DATOS ==========
MONGODB_URI=mongodb+srv://usuario:contraseña@cluster.mongodb.net/esfot_db

# ========== SERVIDOR ==========
PORT=3000
NODE_ENV=development
URL_FRONTEND=http://localhost:5173

# ========== AUTENTICACIÓN ==========
JWT_SECRET=tu_clave_secreta_super_segura

# ========== CLOUDINARY ==========
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret

# ========== EMAIL (MAILTRAP / NODEMAILER) ==========
USER_MAILTRAP=tu_usuario_mailtrap
PASS_MAILTRAP=tu_password_mailtrap

# ========== STRIPE ==========
STRIPE_PRIVATE_KEY=sk_test_tu_clave_secreta

# ========== HUGGING FACE (IA) ==========
HF_API_TOKEN=hf_tu_token

# ========== PUSHER (CHAT EN TIEMPO REAL) ==========
PUSHER_APP_ID=tu_app_id
PUSHER_KEY=tu_key
PUSHER_SECRET=tu_secret
PUSHER_CLUSTER=us2

# ========== UNSPLASH ==========
UNSPLASH_ACCESS_KEY=tu_access_key
```

| Variable | Descripción | Obligatoria |
|----------|-------------|:-----------:|
| `MONGODB_URI` | URI de conexión a MongoDB | ✅ |
| `PORT` | Puerto del servidor (default: 3000) | ❌ |
| `NODE_ENV` | `development` / `production` (controla el detalle de errores) | ❌ |
| `URL_FRONTEND` | Origen adicional permitido en CORS | ❌ |
| `JWT_SECRET` | Clave para firmar/verificar JWT | ✅ |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Credenciales de Cloudinary | ✅ |
| `USER_MAILTRAP` / `PASS_MAILTRAP` | Credenciales SMTP para envío de correos | ✅ |
| `STRIPE_PRIVATE_KEY` | Clave secreta de Stripe | ✅ (donaciones) |
| `HF_API_TOKEN` | Token de la API de Hugging Face | ✅ (sugerencia de títulos) |
| `PUSHER_APP_ID` / `PUSHER_KEY` / `PUSHER_SECRET` / `PUSHER_CLUSTER` | Credenciales de Pusher | ✅ (chat) |
| `UNSPLASH_ACCESS_KEY` | Clave de acceso a Unsplash | ❌ |

### CORS

Definido en `src/server.js`. Orígenes permitidos actualmente:

```javascript
cors({
  origin: [
    'https://poliexpo-esfot.vercel.app',
    'http://localhost',
    'https://localhost',
    'capacitor://localhost',
    'http://localhost:4200',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'https://tesisfrontend2.vercel.app',
    'https://examen-back-v1.vercel.app',
    process.env.URL_FRONTEND,
  ].filter(Boolean), // si URL_FRONTEND no está definida, simplemente se omite (sin comodín "*")
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true,
})
```

> ⚠️ Si `URL_FRONTEND` no está definida, el servidor solo acepta los orígenes fijos de la lista; ya **no** existe un comodín `"*"` de respaldo.

---

## Uso

### Verificar que el servidor está funcionando

```bash
curl http://localhost:3000/
# Respuesta: página HTML de bienvenida ("API REST PoliExpo") con estado del
# servidor y enlace a la documentación de Postman.
```

### Formato de respuestas

La mayoría de endpoints sigue este formato:

**Éxito:**
```json
{
  "success": true,
  "data": { /* objeto o array */ },
  "message": "Operación exitosa"
}
```

**Error:**
```json
{
  "success": false,
  "message": "Descripción del error"
}
```

> Nota: los middlewares de autenticación (`src/middlewares/JWT.js`) responden con `{ "msg": "..." }` en lugar de `{ "success": false, "message": "..." }`.

---

## Documentación de API

### 🔐 Autenticación (`/api/auth`)

| Método | Ruta | Auth | Descripción |
|--------|------|:----:|-------------|
| POST | `/registro` | Pública | Registra un usuario. Acepta `correoInstitucional`/`email` y `contraseña`/`password` como alias. |
| POST | `/login` | Pública | Inicia sesión y retorna el JWT. |
| GET | `/confirm/:token` | Pública | Confirma el correo institucional. |
| POST | `/reenviar-confirmacion` | Pública | Reenvía el correo de confirmación. |
| POST | `/recuperarpassword` | Pública | Solicita recuperación de contraseña. |
| GET | `/recuperarpassword/:token` | Pública | Verifica validez del token de recuperación. |
| POST | `/nuevopassword/:token` | Pública | Establece una nueva contraseña. |
| GET | `/random-image` | Pública | Imagen aleatoria (Unsplash) para pantallas de auth. |
| GET | `/frases` | Pública | Frase motivacional aleatoria. |
| POST | `/logout` | JWT | Cierra sesión (invalida el token en la blacklist). |
| GET | `/perfil` | JWT | Obtiene el perfil del usuario autenticado. |
| PUT | `/perfil` | JWT | Actualiza el perfil propio (incluye subida de foto). |
| PUT | `/password` | JWT | Cambia la contraseña del usuario autenticado. |
| PATCH | `/usuarios/:id/rol` | JWT + admin | Cambia el rol de otro usuario. |

Ejemplo de registro:
```http
POST /api/auth/registro
Content-Type: application/json

{
  "nombre": "Luis",
  "apellido": "Ochoa",
  "cedula": "1234567890",
  "correoInstitucional": "luis@epn.edu.ec",
  "contraseña": "Password123!",
  "carrera": "Desarrollo de Software",
  "semestre": 4
}
```

Ejemplo de login:
```http
POST /api/auth/login
Content-Type: application/json

{
  "correoInstitucional": "luis@epn.edu.ec",
  "contraseña": "Password123!"
}
```

---

### 📁 Proyectos (`/api/proyectos`)

| Método | Ruta | Auth | Descripción |
|--------|------|:----:|-------------|
| GET | `/` | Pública | Lista proyectos publicados. |
| GET | `/destacados` | Pública | Proyectos destacados. |
| GET | `/categoria/:tipo` | Pública | Filtra por `academico` o `extracurricular`. |
| GET | `/estudiante/:id` | Pública | Proyectos de un estudiante. |
| GET | `/usuario/mis-proyectos` | JWT | Proyectos del usuario autenticado. |
| GET | `/donde-colaboro` | JWT | Proyectos donde el usuario colabora. |
| GET | `/mis-proyectos-con-colaboradores` | JWT | Proyectos propios con sus colaboradores. |
| GET | `/versiones/:proyectoId` | JWT | Historial de versiones de un proyecto. |
| GET | `/:id` | JWT opcional | Detalle de un proyecto. |
| POST | `/` | JWT | Crea un proyecto (multipart/form-data para imágenes). |
| PUT | `/:id` | JWT | Actualiza un proyecto. |
| DELETE | `/:id` | JWT | Elimina un proyecto. |
| PUT | `/:id/publicar` | JWT | Publica el proyecto en la landing (solo autor, requiere estar aprobado). |
| POST | `/:id/versiones` | JWT | Crea una nueva versión del proyecto. |
| DELETE | `/:id/imagenes` | JWT | Elimina una imagen del proyecto. |
| PUT | `/:id/documento` | JWT | Sube o reemplaza el PDF del proyecto (campo `documento`). |
| GET | `/:id/documento` | JWT opcional | Descarga/visualiza el PDF. |
| DELETE | `/:id/documento` | JWT | Elimina el PDF del proyecto. |
| POST | `/:id/like` | JWT | Da like al proyecto. |
| DELETE | `/:id/like` | JWT | Quita el like. |
| POST | `/:id/comentarios` | JWT | Agrega un comentario. |
| DELETE | `/:id/comentarios/:comentarioId` | JWT | Elimina un comentario. |
| GET | `/:id/colaboradores` | JWT | Lista colaboradores. |
| POST | `/:id/colaboradores` | JWT + docente | Agrega un colaborador. |
| DELETE | `/:id/colaboradores/:colaboradorId` | JWT + docente | Elimina un colaborador. |
| PUT | `/:id/colaborador` | JWT | El colaborador edita el proyecto (incluye imágenes). |
| DELETE | `/:id/colaborador/imagenes` | JWT | El colaborador elimina una imagen. |

Ejemplo de creación:
```http
POST /api/proyectos
Authorization: Bearer {token}
Content-Type: multipart/form-data

titulo=Sistema de Gestión de Inventario
descripcion=Aplicación web para gestionar inventario...
categoria=academico
fechaInicio=2024-09-01
fechaFin=2024-11-30
tecnologias[]=Node.js
tecnologias[]=MongoDB
palabrasClave[]=inventario
imagenes=@foto1.jpg
```

---

### 🛠 Proyectos — Administración (`/api/admin/proyectos`)

Todas las rutas requieren JWT + rol `admin`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Lista todos los proyectos (filtros: `categoria`, `q`, `estado`, `autor`, `sort`, `page`, `limit`). |
| GET | `/destacados` | Destacados (vista admin). |
| GET | `/versiones/:proyectoId` | Historial de versiones (vista admin). |
| GET | `/:id` | Detalle de un proyecto (solo consulta, el admin no edita contenido). |
| PUT | `/:id/desactivar` | Borrado lógico. |
| PUT | `/:id/reactivar` | Reactiva un proyecto desactivado. |
| PUT | `/:id/aprobar` | Aprueba el proyecto. |
| PUT | `/:id/rechazar` | Rechaza el proyecto (con motivo). |

---

### 👥 Usuarios / Estudiantes (`/api/admin/estudiantes`)

Todas las rutas requieren JWT + rol `admin`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Lista usuarios. Filtros: `rol`, `carrera`, `semestre`, `apellido`. |
| GET | `/estadisticas` | Totales globales y desglose por rol/carrera/semestre. |
| GET | `/:id` | Obtiene un usuario por ID. |
| PATCH | `/:id/estado` | Cambia el estado (`activo`/`inactivo`) de un usuario; un admin no puede cambiar su propio estado. |

---

### 📊 Dashboard (`/api/dashboard`)

| Método | Ruta | Auth | Descripción |
|--------|------|:----:|-------------|
| GET | `/admin` | JWT + admin | Estadísticas globales de la plataforma. |
| GET | `/usuario` | JWT | Estadísticas del usuario autenticado. |

---

### 🤖 IA (`/api/ia`)

| Método | Ruta | Auth | Descripción |
|--------|------|:----:|-------------|
| POST | `/generar-titulo` | JWT + estudiante/docente | Genera 3 sugerencias de título a partir de una descripción (mínimo 15 caracteres). |

```http
POST /api/ia/generar-titulo
Authorization: Bearer {token}
Content-Type: application/json

{
  "descripcion": "Aplicación para automatizar procesos de inscripción de estudiantes de la ESFOT..."
}
```

Respuesta:
```json
{
  "success": true,
  "data": {
    "titulos": ["Título 1", "Título 2", "Título 3"],
    "modelo": "meta-llama/Llama-3.1-8B-Instruct"
  }
}
```

---

### 💬 Chat (`/api/chat`)

| Método | Ruta | Auth | Descripción |
|--------|------|:----:|-------------|
| POST | `/mensaje` | JWT | El usuario envía un mensaje al admin. |
| GET | `/mensajes` | JWT | El usuario ve su propia conversación. |
| POST | `/admin/responder` | JWT + admin | El admin responde a un usuario. |
| GET | `/admin/conversaciones` | JWT + admin | Lista todas las conversaciones activas. |
| GET | `/admin/mensajes/:userId` | JWT + admin | Ve la conversación completa de un usuario. |

---

### 💳 Donaciones (`/api/donaciones`)

| Método | Ruta | Auth | Descripción |
|--------|------|:----:|-------------|
| POST | `/` | JWT + estudiante/docente | Procesa una donación con Stripe (requiere `paymentMethodId` y `monto`, entre $2 y $1000). |

```http
POST /api/donaciones
Authorization: Bearer {token}
Content-Type: application/json

{
  "paymentMethodId": "pm_card_visa",
  "monto": 50,
  "nombre": "Luis",
  "mensaje": "Apoyo a proyectos ESFOT"
}
```

---

## Modelos de Datos

### Usuario (colección `usuarios`, archivo `Estudiante.js`)
```javascript
{
  _id: ObjectId,
  nombre: String,
  apellido: String,
  cedula: String (unique),
  email: String (unique, debe terminar en @epn.edu.ec),
  password: String (hasheado con bcrypt),
  rol: String (estudiante | docente | admin),
  estado: String (activo | inactivo),          // select: false
  fechaRegistro: Date,
  confirmEmail: Boolean,                        // select: false
  token: String,                                 // select: false
  tokenExpira: Date,                             // select: false
  fotoPerfil: { url, publicId },
  carrera: String (enum de 6 carreras de ESFOT),
  semestre: Number (1-5),
  telefono: String,
  descripcion: String,
  github: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Proyecto
```javascript
{
  _id: ObjectId,
  proyecto_id: String,          // agrupa versiones de un mismo proyecto
  version: String,              // ej: '001'
  esUltimaVersion: Boolean,
  titulo: String,
  descripcion: String,
  categoria: String (academico | extracurricular),
  lineaInvestigacion: String,
  autor: ObjectId (ref: Usuario),
  colaboradores: [ObjectId],
  fechaInicio: Date,
  fechaFin: Date,
  estado: String (pendiente | aprobado | rechazado),
  motivoRechazo: String,
  enviarAlAdmin: Boolean,        // envía el proyecto a revisión del admin
  publico: Boolean,              // visible en la landing (solo tras aprobación)
  activo: Boolean,               // borrado lógico
  imagenes: [String],
  imagenesID: [String],
  documentos: [{ filename, fileId, uploadDate, contentType, size }], // PDF en GridFS
  tecnologias: [String],
  repositorio: String,
  enlaceDemo: String,
  palabrasClave: [String],
  vistas: Number,
  likes: [ObjectId],
  comentarios: [{ estudiante: ObjectId, texto: String, fecha: Date }],
  createdAt: Date,
  updatedAt: Date
}
```

### Donacion
```javascript
{
  _id: ObjectId,
  donanteNombre: String (default: 'Anónimo'),
  monto: Number (mínimo 2),
  mensaje: String,
  stripePaymentIntentId: String,
  estado: String (exitosa | fallida),
  createdAt: Date,
  updatedAt: Date
}
```

### ChatMensaje
```javascript
{
  _id: ObjectId,
  usuario: ObjectId (ref: Usuario),    // dueño de la conversación
  remitente: ObjectId (ref: Usuario),  // quién escribió el mensaje
  texto: String,
  esAdmin: Boolean,
  leido: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### TokenBlacklist
```javascript
{
  _id: ObjectId,
  token: String (unique),
  expiresAt: Date   // índice TTL: MongoDB elimina el documento automáticamente
}
```

---

## Seguridad

### Implementaciones
- ✅ **JWT** para autorización stateless, con blacklist de tokens para logout real.
- ✅ **Bcrypt** para hash de contraseñas.
- ✅ **CORS** restringido a una lista de orígenes conocidos.
- ✅ **Validación de entrada** con `express-validator` en registro, actualización de perfil, cambio de contraseña y creación/actualización de proyectos.
- ✅ Campos sensibles del usuario (`estado`, `confirmEmail`, `token`, `tokenExpira`) marcados como `select: false` en Mongoose.
- ✅ Credenciales gestionadas por variables de entorno.

### Buenas Prácticas
1. Usar `.env` para credenciales, **NUNCA** en el código.
2. Rotar `JWT_SECRET` en producción.
3. Validar todos los inputs del usuario.
4. Usar HTTPS en producción (gestionado por Vercel).

---

## Despliegue

### Vercel

El proyecto incluye `vercel.json` en la raíz:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "version": 2,
  "builds": [
    {
      "src": "src/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/index.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

Pasos:
1. Hacer push del repositorio a GitHub.
2. Importar el repositorio en [vercel.com](https://vercel.com).
3. Configurar todas las variables de entorno listadas en [Configuración](#configuración).
4. Deploy.

---

## Pruebas

El repositorio incluye dos carpetas de pruebas independientes (con su propio `package.json`):

- **`Pruebas funcionales/`** — pruebas con Jest (`jest.config.js`).
- **`Pruebas de integracion/`** — pruebas de integración con Jest (`jest.integration.config.js`).

Para ejecutarlas, entrar a la carpeta correspondiente, instalar dependencias y correr el script de pruebas definido en su `package.json`.

---

## Troubleshooting

### "MongoDB connection failed"
- Verificar `MONGODB_URI` en `.env`.
- Comprobar la IP whitelist en MongoDB Atlas.

### "Cannot find module 'mongoose'"
```bash
npm install
```

### "Servicio de IA no configurado"
- Falta la variable `HF_API_TOKEN`.

### "El pago no se completó" (donaciones)
- Verificar `STRIPE_PRIVATE_KEY` y que el `paymentMethodId` enviado sea válido.

### El chat no notifica en tiempo real
- Verificar `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET` y `PUSHER_CLUSTER`.

---

## Licencia

Este proyecto es de código abierto bajo licencia **ISC**.

---

## Autores

**Luis Xavier Ochoa Calle**
- Estudiante de Tecnólogo Superior en Desarrollo de Software
- Escuela de Formación de Tecnólogos (ESFOT)
- Escuela Politécnica Nacional
