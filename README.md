# Sistema Web de Proyectos ESFOT - Backend

**Plataforma digital para centralizar, organizar y publicar proyectos académicos y extracurriculares de la ESFOT - EPN**

[Features](#features) • [Requisitos](#requisitos) • [Instalación](#instalación) • [Configuración](#configuración) • [Uso](#uso) • [API](#documentación-de-api) • [Contribuir](#contribuciones)

</div>

---

## Descripción del Proyecto

Este backend implementa una solución web integral para la **Escuela de Formación de Tecnólogos (ESFOT)** de la Escuela Politécnica Nacional que permite a los estudiantes:

- **Registrar y gestionar** sus proyectos académicos y extracurriculares
- **Publicar contenido multimedia** (imágenes, documentos, enlaces)
- **Colaborar en proyectos** invitando otros estudiantes
- **Interactuar con la comunidad** mediante likes y comentarios
- **Visualizar estadísticas** sobre proyectos y desempeño académico

### Contexto y Problemática

Anteriormente, la ESFOT carecía de un sistema centralizado para almacenar y gestionar los proyectos estudiantiles, lo que causaba:
- ❌ Pérdida de registros históricos
- ❌ Baja visibilidad de logros estudiantiles
- ❌ Ausencia de repositorio formal para la comunidad académica
- ❌ Limitaciones en la colaboración docente-estudiante

### Solución

Un **sistema backend robusto y escalable** que integra tecnologías modernas para garantizar seguridad, eficiencia y accesibilidad.

---

## Features

### ✅ Autenticación y Autorización
- Registro y login con email/contraseña
- Autenticación OAuth 2.0 (Google, Facebook)
- JWT para autorización segura de endpoints
- Roles diferenciados: estudiante, administrador
- Verificación de email confirmado

### 📁 Gestión de Proyectos
- Crear, leer, actualizar y eliminar proyectos (CRUD completo)
- Categorización: académicos vs extracurriculares
- Estados: en progreso, publicado
- Niveles: semestrales (1-6)
- Búsqueda y filtrado avanzado por categoría, carrera, tags

### 🎨 Multimedia
- Subida de imágenes a Cloudinary
- Validación y optimización automática
- Eliminación segura de archivos
- Almacenamiento de documentos adjuntos

### 👥 Colaboración
- Sistema de colaboradores en proyectos
- Perfiles de estudiante con biografía
- Foto de perfil
- Seguimiento de último login

### 💬 Interacción Social
- Sistema de likes en proyectos
- Comentarios con timestamps
- Incremento automático de vistas
- Estadísticas en tiempo real

### 🤖 Inteligencia Artificial
- Sugerencias de títulos de proyectos via Hugging Face
- Análisis inteligente de contenido

### 💳 Funcionalidades Adicionales
- Sistema de donaciones integrado con Stripe
- Dashboard administrativo con estadísticas
- Notificaciones por email (Nodemailer)
- CORS configurado para múltiples orígenes

---

## Arquitectura

```
src/
├── config/               # Configuración de servicios
│   ├── nodemailer.js    # Configuración de correo
│   └── passport.js      # Estrategias OAuth
├── controllers/         # Lógica de negocios
│   ├── auth_controller.js
│   ├── proyecto_controller.js
│   ├── proyectoadmin_controller.js
│   ├── estudiante_controller.js
│   ├── donacion_controller.js
│   ├── dashboard_controller.js
│   └── ia_controller.js
├── models/             # Esquemas MongoDB
│   ├── Estudiante.js
│   ├── Proyecto.js
│   └── Donacion.js
├── routes/             # Definición de rutas HTTP
├── middlewares/        # JWT, validaciones
├── helpers/            # Funciones auxiliares
│   ├── sendMail.js
│   └── uploadCloudinary.js
├── validators/         # Validación de datos
├── services/           # Servicios externos
├── database.js         # Conexión a MongoDB
├── server.js          # Configuración Express
└── index.js           # Punto de entrada
```

### Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Runtime** | Node.js 18+ |
| **Framework** | Express 5.1.0 |
| **Base de Datos** | MongoDB 8.19.2 |
| **Autenticación** | JWT + Passport.js |
| **Almacenamiento** | Cloudinary |
| **Email** | Nodemailer |
| **Validación** | Express-validator |
| **Seguridad** | Bcryptjs, CORS |
| **IA** | Hugging Face API |
| **Pagos** | Stripe |
| **Tiempo Real** | Socket.io |

---

## Requisitos

### Mínimos del Sistema
- **Node.js** v18 o superior
- **npm** v9 o superior (o yarn)
- **MongoDB** v5.0+ (local o Atlas)
- Navegador moderno (para testing)

### Cuentas Externas Requeridas
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) - Base de datos
- [Cloudinary](https://cloudinary.com/) - Gestión de imágenes
- [Nodemailer](https://nodemailer.com/) - Transporte de correo
- [Google OAuth](https://console.cloud.google.com/) - Autenticación Google
- [Facebook Developers](https://developers.facebook.com/) - Autenticación Facebook
- [Stripe](https://stripe.com/) - Procesamiento de pagos
- [Hugging Face](https://huggingface.co/) - API de IA
- [Replicate](https://replicate.com/) - Generación de imágenes (opcional)

---

## Instalación

### 1️⃣ Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/examen_backV2.git
cd examen_backV2
```

### 2️⃣ Instalar dependencias

```bash
npm install
# o con yarn
yarn install
```

### 3️⃣ Configurar variables de entorno

Crear archivo `.env` en la raíz del proyecto:

```env
# ========== BASE DE DATOS ==========
MONGO_URI=mongodb+srv://usuario:contraseña@cluster.mongodb.net/esfot_db

# ========== SERVIDOR ==========
PORT=3000
NODE_ENV=development
URL_FRONTEND=http://localhost:5173

# ========== AUTENTICACIÓN ==========
JWT_SECRET=tu_clave_secreta_super_segura_minimo_32_caracteres
SESSION_SECRET=tu_clave_sesion_segura

# ========== GOOGLE OAUTH ==========
GOOGLE_CLIENT_ID=tu_cliente_id_google.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu_secreto_google

# ========== FACEBOOK OAUTH ==========
FACEBOOK_APP_ID=tu_app_id_facebook
FACEBOOK_APP_SECRET=tu_secreto_facebook

# ========== CLOUDINARY ==========
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret

# ========== EMAIL (NODEMAILER) ==========
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASS=tu_contraseña_app_gmail

# ========== STRIPE ==========
STRIPE_SECRET_KEY=sk_test_tu_clave_secreta
STRIPE_PUBLIC_KEY=pk_test_tu_clave_publica

# ========== HUGGING FACE (IA) ==========
HUGGINGFACE_API_KEY=hf_tu_clave_api

# ========== REPLICATE (Imágenes) ==========
REPLICATE_API_TOKEN=tu_token_replicate
```

### 4️⃣ Ejecutar en desarrollo

```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3000`

### 5️⃣ Compilar para producción

```bash
npm start
```

---

## Configuración

### Variables de Entorno Detalladas

| Variable | Descripción | Obligatoria |
|----------|-------------|------------|
| `MONGO_URI` | URI de conexión a MongoDB | ✅ |
| `PORT` | Puerto del servidor (default: 3000) | ❌ |
| `JWT_SECRET` | Clave para firmar JWT tokens | ✅ |
| `CLOUDINARY_*` | Credenciales de Cloudinary | ✅ |
| `GOOGLE_CLIENT_*` | Credenciales Google OAuth | ❌ |
| `FACEBOOK_APP_*` | Credenciales Facebook OAuth | ❌ |
| `SMTP_*` | Configuración de Nodemailer | ✅ |
| `STRIPE_*` | Claves de Stripe | ❌ |
| `HUGGINGFACE_API_KEY` | Token de API Hugging Face | ❌ |

### Configuración de CORS

Editar en `src/server.js`:

```javascript
cors({
  origin: [
    'http://127.0.0.1:5173',    // Frontend local
    'https://tudominio.com',     // Producción
    process.env.URL_FRONTEND
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
})
```

---

## Uso

### Iniciar el Servidor

**Desarrollo (con reload automático):**
```bash
npm run dev
```

**Producción:**
```bash
npm start
```

### Verificar que está funcionando

```bash
curl http://localhost:3000/
# Respuesta: "API de Proyectos ESFOT - EPN"
```

### Estructura de Respuestas

Todas las respuestas siguen este formato:

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
  "message": "Descripción del error",
  "errors": [ /* detalles de validación */ ]
}
```

---

## Documentación de API

### 🔐 Autenticación (`/api/auth`)

#### Registro
```http
POST /api/auth/register
Content-Type: application/json

{
  "nombre": "Luis",
  "apellido": "Ochoa",
  "cedula": "1234567890",
  "email": "luis@esfot.edu.ec",
  "password": "Password123!",
  "carrera": "Desarrollo de Software",
  "nivel": 4,
  "celular": "+593912345678"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "luis@esfot.edu.ec",
  "password": "Password123!"
}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "usuario": {
      "_id": "507f1f77bcf86cd799439011",
      "nombre": "Luis",
      "email": "luis@esfot.edu.ec",
      "rol": "estudiante"
    }
  }
}
```

#### OAuth Google
```http
GET /api/auth/google
```

#### OAuth Facebook
```http
GET /api/auth/facebook
```

---

### 📁 Proyectos (`/api/proyectos`)

#### Crear Proyecto
```http
POST /api/proyectos
Authorization: Bearer {token}
Content-Type: application/json

{
  "titulo": "Sistema de Gestión de Inventario",
  "descripcion": "Aplicación web para gestionar inventario...",
  "categoria": "academico",
  "asignatura": "Desarrollo de Aplicaciones Web",
  "fechaInicio": "2024-09-01",
  "fechaFin": "2024-11-30",
  "carrera": "Desarrollo de Software",
  "nivel": 4,
  "tecnologias": ["Node.js", "MongoDB", "React"],
  "tags": ["web", "inventario", "nodejs"]
}
```

#### Obtener Todos los Proyectos
```http
GET /api/proyectos?categoria=academico&carrera=Desarrollo de Software&tags=nodejs
Authorization: Bearer {token}
```

#### Obtener Proyecto por ID
```http
GET /api/proyectos/{id}
Authorization: Bearer {token}
```

#### Actualizar Proyecto
```http
PUT /api/proyectos/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "titulo": "Nuevo título",
  "descripcion": "Nueva descripción..."
}
```

#### Eliminar Proyecto
```http
DELETE /api/proyectos/{id}
Authorization: Bearer {token}
```

#### Agregar Like
```http
POST /api/proyectos/{id}/likes
Authorization: Bearer {token}
```

#### Agregar Comentario
```http
POST /api/proyectos/{id}/comentarios
Authorization: Bearer {token}
Content-Type: application/json

{
  "texto": "¡Excelente trabajo!"
}
```

---

### 👥 Estudiantes (`/api/admin/estudiantes`)

#### Obtener Todos los Estudiantes (Admin)
```http
GET /api/admin/estudiantes
Authorization: Bearer {admin_token}
```

#### Actualizar Perfil del Estudiante
```http
PUT /api/estudiantes/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "bio": "Apasionado por el desarrollo web...",
  "celular": "+593912345678"
}
```

---

### 📊 Dashboard (`/api/dashboard`)

#### Obtener Estadísticas Generales
```http
GET /api/dashboard/estadisticas
Authorization: Bearer {admin_token}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "totalProyectos": 156,
    "totalEstudiantes": 340,
    "proyectosPublicados": 142,
    "proyectosEnProgreso": 14,
    "totalViews": 5234,
    "proyectoPorCategoria": {
      "academico": 98,
      "extracurricular": 44
    }
  }
}
```

---

### 🤖 IA (`/api/ia`)

#### Generar Sugerencia de Título
```http
POST /api/ia/sugerir-titulo
Authorization: Bearer {token}
Content-Type: application/json

{
  "descripcion": "Aplicación para automatizar procesos de inscripción...",
  "categoria": "academico"
}
```

---

### 💳 Donaciones (`/api/donaciones`)

#### Crear Intención de Pago
```http
POST /api/donaciones/crear-intencion
Authorization: Bearer {token}
Content-Type: application/json

{
  "monto": 50,
  "moneda": "usd",
  "mensaje": "Apoyo a proyectos ESFOT"
}
```

---

## Modelos de Datos

### Estudiante
```javascript
{
  _id: ObjectId,
  nombre: String,
  apellido: String,
  cedula: String (unique),
  email: String (unique),
  password: String (hashed),
  carrera: String,
  nivel: Number (1-6),
  rol: String (estudiante|admin),
  bio: String,
  fotoPerfil: { url, publicId },
  googleId: String,
  facebookId: String,
  authProvider: String,
  status: Boolean,
  confirmEmail: Boolean,
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Proyecto
```javascript
{
  _id: ObjectId,
  titulo: String,
  descripcion: String,
  categoria: String (academico|extracurricular),
  asignatura: String,
  autor: ObjectId (ref: Estudiante),
  colaboradores: [ObjectId],
  docente: { nombre, email },
  fechaInicio: Date,
  fechaFin: Date,
  estado: String (en_progreso|publicado),
  imagenes: [String],
  imagenesID: [String],
  tecnologias: [String],
  repositorio: String,
  enlaceDemo: String,
  tags: [String],
  carrera: String,
  nivel: Number,
  publico: Boolean,
  vistas: Number,
  likes: [ObjectId],
  comentarios: [{
    estudiante: ObjectId,
    texto: String,
    fecha: Date
  }],
  createdAt: Date,
  updatedAt: Date
}
```

---

## Manejo de Errores

El API devuelve códigos HTTP estándar:

| Código | Significado | Ejemplo |
|--------|------------|---------|
| 200 | OK | Operación exitosa |
| 201 | Created | Recurso creado |
| 400 | Bad Request | Datos inválidos |
| 401 | Unauthorized | Token inválido/expirado |
| 403 | Forbidden | Sin permisos |
| 404 | Not Found | Recurso no existe |
| 500 | Server Error | Error interno |

**Ejemplo de error:**
```json
{
  "success": false,
  "message": "Credenciales inválidas",
  "errors": {
    "email": "El email no existe en el sistema"
  }
}
```

---

## Seguridad

### Implementaciones
- ✅ **JWT Tokens** para autenticación stateless
- ✅ **Bcrypt** para hash de contraseñas
- ✅ **CORS** configurado para orígenes específicos
- ✅ **Validación de entrada** con express-validator
- ✅ **HTTP Headers seguros** (ver middlewares)
- ✅ **Credenciales en variables de entorno**
- ✅ **SSL/TLS** en producción (recomendado)

### Buenas Prácticas
1. Usar `.env` para credenciales, **NUNCA** en código
2. Cambiar `JWT_SECRET` y `SESSION_SECRET` en producción
3. Implementar rate limiting en endpoints de autenticación
4. Validar todos los inputs del usuario
5. Usar HTTPS en producción
6. Implementar CSRF protection si se usan formularios HTML

---

## Testing

### Herramientas Recomendadas
- **Postman** o **Insomnia** para testing manual
- **Jest** para testing unitario
- **Supertest** para testing de integracion

### Ejemplo de request en cURL
```bash
# Registro
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Luis",
    "apellido": "Ochoa",
    "email": "luis@example.com",
    "password": "Secure123!",
    "cedula": "1234567890",
    "carrera": "Desarrollo de Software",
    "nivel": 4
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "luis@example.com",
    "password": "Secure123!"
  }'

# Obtener proyectos (requiere token)
curl -X GET http://localhost:3000/api/proyectos \
  -H "Authorization: Bearer {token}"
```

---

## Despliegue

### Vercel (Recomendado)

1. **Push a GitHub**
```bash
git add .
git commit -m "Configuración inicial"
git push origin main
```

2. **Conectar a Vercel**
   - Ir a [vercel.com](https://vercel.com)
   - Importar repositorio
   - Agregar variables de entorno
   - Deploy automático

3. **Configurar `vercel.json`** (incluido en el proyecto):
```json
{
  "buildCommand": "npm install",
  "outputDirectory": ".",
  "functions": {
    "src/index.js": {
      "memory": 3008,
      "maxDuration": 60
    }
  }
}
```

### Otras Plataformas
- **Heroku**: `git push heroku main`
- **Railway**: Conectar GitHub y configurar variables
- **AWS**: Usar Elastic Beanstalk o EC2
- **DigitalOcean**: App Platform o Droplet

---

## Troubleshooting

### Problema: "Cannot find module 'mongoose'"
**Solución:**
```bash
npm install
npm install mongoose
```

### Problema: "MongoDB connection failed"
**Solución:**
- Verificar `MONGO_URI` en `.env`
- Comprobar conexión a Internet
- Validar IP whitelist en MongoDB Atlas

### Problema: "JWT token expired"
**Solución:**
- Cliente debe re-autenticarse
- Implementar refresh tokens en producción

### Problema: "Cloudinary upload fails"
**Solución:**
- Verificar credenciales en `.env`
- Comprobar permisos en cuenta Cloudinary
- Validar tamaño de archivo

---

## Contribuciones

Las contribuciones son bienvenidas! Por favor:

1. **Fork** el repositorio
2. Crea una rama (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un **Pull Request**

### Estándares de Código
- Usar ESLint
- Formatear con Prettier
- Escribir comentarios en español/inglés
- Incluir validaciones y manejo de errores

---

## Roadmap

### v1.1 (Próximo)
- [ ] Implementar refresh tokens
- [ ] Agregar paginación a endpoints
- [ ] Rate limiting en autenticación
- [ ] Notificaciones en tiempo real (Socket.io)

### v1.2
- [ ] Sistema de recomendaciones de proyectos
- [ ] Exportar proyectos a PDF
- [ ] Galería de proyectos interactiva
- [ ] Sistema de badges/certificados

### v2.0
- [ ] Micro-servicios
- [ ] GraphQL API
- [ ] WebSockets para colaboración en tiempo real
- [ ] Mobile app API

---

## Licencia

Este proyecto es de código abierto bajo licencia **ISC**. Ver archivo `LICENSE` para más detalles.

---

## Autores

**Luis Xavier Ochoa Calle**
- Estudiante de Tecnólogo Superior en Desarrollo de Software
- Escuela de Formación de Tecnólogos (ESFOT)
- Escuela Politécnica Nacional

---
