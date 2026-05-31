import { getRandomImage } from "../services/imagenFondo.js";
import { sendMailToRecoveryPassword, sendMailToRegister, sendMailToPasswordChanged } from "../helpers/sendMail.js"
import Estudiante from "../models/Estudiante.js"
import TokenBlacklist from "../models/TokenBlacklist.js"
import { getRandomQuote } from "../services/frases.js";
import { crearTokenJWT, obtenerExpiracionToken } from "../middlewares/JWT.js"
import mongoose from "mongoose"
import { subirImagenCloudinary, eliminarImagenCloudinary } from "../helpers/uploadCloudinary.js"

// ===== FUNCIONES DE SERVICIOS =====
export const getUnsplashImage = async (req, res) => {
    const { query = "motivational" } = req.query;
    const imageUrl = await getRandomImage(query);
    res.json({ imageUrl });
};

export const fetchQuoteController = async (req, res) => {
    const quote = await getRandomQuote();
    res.json(quote);
};

// ===== REGISTRO — HU-001 =====
/**
 * Campos obligatorios que acepta el endpoint:
 *   nombre, apellido, cedula, correoInstitucional (o email), contraseña (o password), rol
 *
 * El frontend puede enviar 'correoInstitucional' o 'email' — ambos se mapean a email internamente.
 * El frontend puede enviar 'contraseña' o 'password'       — ambos se mapean a password internamente.
 *
 * Campos que el backend genera automáticamente (NO deben enviarse):
 *   estado, fechaRegistro, confirmEmail, token
 */
const registro = async (req, res) => {
    try {
        const {
            nombre,
            apellido,
            cedula,
            correoInstitucional,   // alias aceptado desde el frontend
            email: emailDirecto,   // también se acepta 'email' directamente
            contraseña,            // alias aceptado desde el frontend
            password: passwordDirecto, // también se acepta 'password' directamente
            rol,
        } = req.body;

        // Mapear alias → campos internos
        const email    = correoInstitucional || emailDirecto;
        const password = contraseña         || passwordDirecto;

        // Validar que los 6 campos obligatorios estén presentes
        const faltantes = [];
        if (!nombre)   faltantes.push('nombre');
        if (!apellido) faltantes.push('apellido');
        if (!cedula)   faltantes.push('cedula');
        if (!email)    faltantes.push('correoInstitucional');
        if (!password) faltantes.push('contraseña');

        if (faltantes.length > 0) {
            return res.status(400).json({
                msg: `Faltan campos obligatorios: ${faltantes.join(', ')}`
            });
        }

        // Verificar correo duplicado
        const emailExiste = await Estudiante.findOne({ email: email.toLowerCase() });
        if (emailExiste) {
            return res.status(400).json({ msg: 'Lo sentimos, el correo institucional ya está registrado' });
        }

        // El rol solo puede ser 'estudiante' o 'docente' — admin nunca desde registro público
        const rolesPermitidos = ['estudiante', 'docente'];
        const rolAsignado = rol && rolesPermitidos.includes(rol) ? rol : 'estudiante';

        // Construir nuevo usuario solo con los campos de registro
        // Los campos de perfil (carrera, semestre, telefono, etc.) quedan en null por defecto
        const nuevoUsuario = new Estudiante({
            nombre,
            apellido,
            cedula,
            email: email.toLowerCase(),
            rol: rolAsignado,
            // Campos automáticos — valores por defecto del modelo:
            // estado: 'activo', fechaRegistro: now, confirmEmail: false
        });

        // Encriptar contraseña
        nuevoUsuario.password = await nuevoUsuario.encryptPassword(password);

        // Generar token de verificación de correo
        nuevoUsuario.token = nuevoUsuario.createToken();

        // Guardar en la base de datos
        await nuevoUsuario.save();
        console.log('✅ Usuario registrado:', nuevoUsuario._id, '| Rol:', rolAsignado);

        // Enviar correo de confirmación (no bloquea el registro si falla)
        try {
            await sendMailToRegister(email, nuevoUsuario.token);
            console.log('📧 Correo de confirmación enviado a:', email);
        } catch (emailError) {
            console.error('⚠️ No se pudo enviar el correo de confirmación:', emailError.message);
        }

        // Respuesta — solo devolver lo esencial, nunca password ni token
        res.status(201).json({
            success: true,
            msg: 'Registro exitoso. Revisa tu correo institucional para confirmar tu cuenta.',
            data: {
                _id:              nuevoUsuario._id,
                nombre:           nuevoUsuario.nombre,
                apellido:         nuevoUsuario.apellido,
                correoInstitucional: nuevoUsuario.email,
                rol:              nuevoUsuario.rol,
                estado:           nuevoUsuario.estado,
                confirmEmail:     nuevoUsuario.confirmEmail,
                fechaRegistro:    nuevoUsuario.fechaRegistro,
            }
        });

    } catch (error) {
        console.error('❌ Error en registro:', error.message);

        if (error.name === 'ValidationError') {
            const errores = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({ msg: 'Error de validación', errors: errores });
        }

        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message,
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        });
    }
};

// ===== CONFIRMAR CORREO — HU-001 =====
const confirmarMail = async (req, res) => {
    try {
        const { token } = req.params;
        // +token, +confirmEmail y +tokenExpira necesarios porque tienen select:false en el modelo
        const usuarioBDD = await Estudiante.findOne({ token }).select('+token +confirmEmail +tokenExpira');
        if (!usuarioBDD) return res.status(404).json({ msg: 'Token inválido o cuenta ya confirmada' });

        // Verificar que el token no haya vencido (24 horas de vigencia)
        if (!usuarioBDD.tokenExpira || usuarioBDD.tokenExpira < new Date()) {
            usuarioBDD.token       = null;
            usuarioBDD.tokenExpira = null;
            await usuarioBDD.save();
            return res.status(400).json({ msg: 'El enlace de confirmación ha expirado, solicita uno nuevo' });
        }

        usuarioBDD.token        = null;
        usuarioBDD.tokenExpira  = null;
        usuarioBDD.confirmEmail = true;
        await usuarioBDD.save();
        res.status(200).json({ msg: 'Cuenta confirmada. Ya puedes iniciar sesión.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Error interno del servidor", error: error.message });
    }
};

// ===== RECUPERAR CONTRASEÑA =====
const recuperarPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ msg: 'Debes ingresar tu correo institucional' });
        // +token, +estado y +confirmEmail necesarios porque tienen select:false en el modelo
        const usuarioBDD = await Estudiante.findOne({ email: email.toLowerCase() }).select('+token +estado +confirmEmail');
        if (!usuarioBDD) return res.status(404).json({ msg: 'El usuario no se encuentra registrado' });

        // Verificar que la cuenta esté activa
        if (usuarioBDD.estado === 'inactivo')
            return res.status(403).json({ msg: 'Tu cuenta ha sido suspendida. Contacta con el administrador.' });

        // Verificar que el correo haya sido confirmado
        if (!usuarioBDD.confirmEmail)
            return res.status(403).json({ msg: 'Debes confirmar tu correo institucional antes de recuperar tu contraseña.' });

        const token = usuarioBDD.createTokenRecuperacion();
        usuarioBDD.token = token;
        await sendMailToRecoveryPassword(email, token);
        await usuarioBDD.save();
        res.status(200).json({ msg: 'Revisa tu correo institucional para restablecer tu contraseña' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Error interno del servidor", error: error.message });
    }
};

// ===== COMPROBAR TOKEN DE RECUPERACIÓN =====
const comprobarTokenPasword = async (req, res) => {
    try {
        const { token } = req.params;
        // +token y +tokenExpira necesarios porque tienen select:false en el modelo
        const usuarioBDD = await Estudiante.findOne({ token }).select('+token +tokenExpira');
        if (usuarioBDD?.token !== token) return res.status(404).json({ msg: 'Token inválido o expirado' });

        // Verificar que el token no haya vencido (1 hora de vigencia)
        if (!usuarioBDD.tokenExpira || usuarioBDD.tokenExpira < new Date()) {
            usuarioBDD.token       = null;
            usuarioBDD.tokenExpira = null;
            await usuarioBDD.save();
            return res.status(400).json({ msg: 'El enlace ha expirado. Solicita uno nuevo.' });
        }

        res.status(200).json({ msg: 'Token confirmado. Ya puedes crear tu nueva contraseña.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Error interno del servidor", error: error.message });
    }
};

// ===== CREAR NUEVA CONTRASEÑA =====
const crearNuevoPassword = async (req, res) => {
    try {
        const { password } = req.body;
        const { token } = req.params;

        // Las validaciones de formato y confirmación ya las hizo validarNuevoPassword
        // +token y +tokenExpira necesarios porque tienen select:false en el modelo
        const usuarioBDD = await Estudiante.findOne({ token }).select('+token +tokenExpira');
        if (!usuarioBDD) return res.status(404).json({ msg: 'Token inválido o expirado' });

        // Verificar que el token no haya vencido (1 hora de vigencia)
        if (!usuarioBDD.tokenExpira || usuarioBDD.tokenExpira < new Date()) {
            usuarioBDD.token       = null;
            usuarioBDD.tokenExpira = null;
            await usuarioBDD.save();
            return res.status(400).json({ msg: 'El enlace ha expirado. Solicita uno nuevo.' });
        }

        usuarioBDD.password    = await usuarioBDD.encryptPassword(password);
        usuarioBDD.token       = null;
        usuarioBDD.tokenExpira = null; // limpiar junto con el token
        await usuarioBDD.save();

        res.status(200).json({ msg: '¡Contraseña actualizada! Ya puedes iniciar sesión.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Error interno del servidor", error: error.message });
    }
};

// ===== LOGIN — HU-001 =====
const login = async (req, res) => {
    try {
        // Acepta 'correoInstitucional' o 'email', y 'contraseña' o 'password'
        const email    = req.body.correoInstitucional || req.body.email;
        const password = req.body.contraseña         || req.body.password;

        if (!email || !password)
            return res.status(400).json({ msg: 'Debes proporcionar correo y contraseña' });

        const usuarioBDD = await Estudiante.findOne({ email: email.toLowerCase() })
            .select('-__v -updatedAt -createdAt +confirmEmail +estado');

        if (!usuarioBDD)
            return res.status(404).json({ msg: 'El usuario no se encuentra registrado' });

        if (!usuarioBDD.confirmEmail)
            return res.status(403).json({ msg: 'Debes confirmar tu correo institucional antes de iniciar sesión' });

        if (usuarioBDD.estado === 'inactivo')
            return res.status(403).json({ msg: 'Tu cuenta ha sido suspendida. Contacta con el administrador.' });

        const passwordValido = await usuarioBDD.matchPassword(password);
        if (!passwordValido)
            return res.status(401).json({ msg: 'La contraseña no es correcta' });

        const { nombre, apellido, _id, rol, cedula, fotoPerfil,
                carrera, semestre, telefono, descripcion, github } = usuarioBDD;

        const token = crearTokenJWT(_id, rol);

        res.status(200).json({
            token,
            _id,
            nombre,
            apellido,
            correoInstitucional: usuarioBDD.email,
            rol,
            cedula,
            fotoPerfil,
            carrera,
            semestre,
            telefono,
            descripcion,
            github,
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Error interno del servidor", error: error.message });
    }
};

// ===== CERRAR SESIÓN — HU-001 =====
const cerrarSesion = async (req, res) => {
    try {
        const token = req.tokenActual;
        if (!token) return res.status(400).json({ msg: 'No se encontró el token en la solicitud' });
        const expiresAt = obtenerExpiracionToken(token);
        await TokenBlacklist.create({ token, expiresAt });
        res.status(200).json({ msg: 'Sesión cerrada correctamente' });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(200).json({ msg: 'La sesión ya había sido cerrada anteriormente' });
        }
        console.error('Error al cerrar sesión:', error);
        res.status(500).json({ success: false, message: "Error interno del servidor", error: error.message });
    }
};

// ===== VER PERFIL =====
const perfil = (req, res) => {
    try {
        const { token, password, createdAt, updatedAt, __v, ...datosPerfil } = req.estudianteHeader;
        // Devolver correoInstitucional como alias legible
        res.status(200).json({
            ...datosPerfil,
            correoInstitucional: datosPerfil.email,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error interno del servidor", error: error.message });
    }
};

// ===== ACTUALIZAR PERFIL — HU-004 =====
/**
 * Campos PERMITIDOS para actualizar:
 *   fotoPerfil (archivo), carrera, semestre, telefono, descripcion, github
 *
 * Campos BLOQUEADOS (inmutables):
 *   nombre, cedula, email / correoInstitucional, rol
 *
 * El ID se extrae del token JWT (req.estudianteBDD._id) — no se pasa por URL.
 */
const actualizarPerfil = async (req, res) => {
    try {
        // ID extraído del token, no de la URL
        const id = req.estudianteBDD._id.toString();

        // BUG FIX: cuando se envía form-data y express-fileupload falla al crear el
        // directorio temporal, req.body puede quedar undefined. Nos aseguramos de que
        // siempre sea al menos un objeto vacío para evitar el crash.
        req.body = req.body ?? {};

        // Bloquear campos inmutables
        const camposBloqueados = ['nombre', 'apellido', 'cedula', 'email', 'correoInstitucional', 'rol'];
        const intentoModificar = camposBloqueados.filter(campo => req.body[campo] !== undefined);
        if (intentoModificar.length > 0) {
            return res.status(400).json({
                msg: `Los siguientes campos no pueden modificarse: ${intentoModificar.join(', ')}`
            });
        }

        const usuarioBDD = await Estudiante.findById(id);
        if (!usuarioBDD) {
            return res.status(404).json({ msg: `No existe el usuario con ID ${id}` });
        }

        // Actualizar foto de perfil en Cloudinary si se envió una nueva
        if (req.files?.fotoPerfil) {
            const fotoPerfil = req.files.fotoPerfil;

            const tiposPermitidos = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'];
            if (!tiposPermitidos.includes(fotoPerfil.mimetype)) {
                return res.status(400).json({ msg: 'Formato de imagen no válido. Use JPEG, PNG o GIF' });
            }
            if (fotoPerfil.size > 5 * 1024 * 1024) {
                return res.status(400).json({ msg: 'La imagen es demasiado grande. Máximo 5MB' });
            }

            // Eliminar foto anterior de Cloudinary si no es la de por defecto
            if (usuarioBDD.fotoPerfil?.publicId && usuarioBDD.fotoPerfil.publicId !== 'default-profile') {
                try {
                    await eliminarImagenCloudinary(usuarioBDD.fotoPerfil.publicId);
                } catch (cloudErr) {
                    console.error('Error al eliminar foto anterior:', cloudErr);
                }
            }

            const { secure_url, public_id } = await subirImagenCloudinary(
                fotoPerfil.tempFilePath,
                'Perfiles'
            );
            usuarioBDD.fotoPerfil = { url: secure_url, publicId: public_id };
        }

        // Aplicar solo los campos de perfil permitidos
        const { carrera, semestre, telefono, descripcion, github } = req.body;

        usuarioBDD.carrera     = carrera     ?? usuarioBDD.carrera;
        usuarioBDD.semestre    = semestre    ?? usuarioBDD.semestre;
        usuarioBDD.telefono    = telefono    ?? usuarioBDD.telefono;
        usuarioBDD.descripcion = descripcion ?? usuarioBDD.descripcion;
        usuarioBDD.github      = github      ?? usuarioBDD.github;

        await usuarioBDD.save();

        const { password, token, __v, ...perfilActualizado } = usuarioBDD.toObject();
        res.status(200).json({
            ...perfilActualizado,
            correoInstitucional: perfilActualizado.email,
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Error interno del servidor", error: error.message });
    }
};

// ===== ACTUALIZAR CONTRASEÑA =====
// El ID se extrae del token JWT (req.estudianteBDD._id) — no se pasa por URL.
const actualizarPassword = async (req, res) => {
    try {
        const usuarioBDD = await Estudiante.findById(req.estudianteBDD._id);
        if (!usuarioBDD) return res.status(404).json({ msg: 'Usuario no encontrado' });

        const passwordActual = req.body.passwordactual || req.body['contraseñaActual'];
        const passwordNuevo  = req.body.passwordnuevo  || req.body['contraseñaNueva'];

        // Las validaciones de formato ya las hizo validarCambiarPassword
        if (!passwordActual) return res.status(400).json({ msg: 'La contraseña actual es obligatoria' });
        if (!passwordNuevo)  return res.status(400).json({ msg: 'La nueva contraseña es obligatoria' });

        const valido = await usuarioBDD.matchPassword(passwordActual);
        if (!valido) return res.status(400).json({ msg: 'La contraseña actual no es correcta' });

        usuarioBDD.password = await usuarioBDD.encryptPassword(passwordNuevo);
        await usuarioBDD.save();

        // Notificar al usuario por correo — no bloquea la respuesta si falla
        try {
            await sendMailToPasswordChanged(usuarioBDD.email, usuarioBDD.nombre);
        } catch (emailError) {
            console.error('⚠️ No se pudo enviar el correo de notificación de cambio de contraseña:', emailError.message);
        }

        res.status(200).json({ msg: 'Contraseña actualizada correctamente' });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error interno del servidor", error: error.message });
    }
};

// ===== CAMBIAR ROL DE USUARIO — solo admin =====
/**
 * Permite a un administrador cambiar el rol de cualquier otro usuario.
 * El admin NO puede modificar su propio rol.
 *
 * PATCH /api/auth/rol/:id
 * Body: { rol: 'estudiante' | 'docente' | 'admin' }
 * Requiere: verificarTokenJWT + verificarAdmin
 */
const cambiarRol = async (req, res) => {
    try {
        const { id } = req.params;
        const { rol } = req.body;

        // Validar que se envió el campo rol
        if (!rol) {
            return res.status(400).json({ msg: 'Debes enviar el campo "rol"' });
        }

        // Validar que el rol sea uno de los permitidos
        const rolesPermitidos = ['estudiante', 'docente', 'admin'];
        if (!rolesPermitidos.includes(rol)) {
            return res.status(400).json({
                msg: `Rol inválido. Los roles permitidos son: ${rolesPermitidos.join(', ')}`
            });
        }

        // Evitar que el admin se cambie el rol a sí mismo
        if (req.estudianteBDD._id.toString() === id) {
            return res.status(403).json({
                msg: 'No puedes cambiar tu propio rol'
            });
        }

        const usuarioObjetivo = await Estudiante.findById(id);
        if (!usuarioObjetivo) {
            return res.status(404).json({ msg: `No existe el usuario con ID ${id}` });
        }

        // Aplicar el cambio de rol
        usuarioObjetivo.rol = rol;
        await usuarioObjetivo.save();

        res.status(200).json({
            msg: `Rol actualizado correctamente`,
            data: {
                _id:     usuarioObjetivo._id,
                nombre:  usuarioObjetivo.nombre,
                apellido: usuarioObjetivo.apellido,
                correoInstitucional: usuarioObjetivo.email,
                rol:     usuarioObjetivo.rol,
            }
        });

    } catch (error) {
        console.error('❌ Error al cambiar rol:', error.message);
        res.status(500).json({ success: false, message: "Error interno del servidor", error: error.message });
    }
};


// ===== REENVIAR TOKEN DE CONFIRMACIÓN DE EMAIL =====
const reenviarConfirmacion = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ msg: 'Debes ingresar tu correo institucional' });

        const usuarioBDD = await Estudiante
            .findOne({ email: email.toLowerCase() })
            .select('+token +confirmEmail +estado');

        if (!usuarioBDD)
            return res.status(404).json({ msg: 'No existe una cuenta con ese correo' });

        if (usuarioBDD.confirmEmail)
            return res.status(400).json({ msg: 'Este correo ya fue confirmado. Puedes iniciar sesión.' });

        if (usuarioBDD.estado === 'inactivo')
            return res.status(403).json({ msg: 'Tu cuenta ha sido suspendida. Contacta con el administrador.' });

        // Generar nuevo token y guardarlo
        const nuevoToken = usuarioBDD.createTokenRecuperacion();
        usuarioBDD.token = nuevoToken;
        await usuarioBDD.save();

        // Reenviar el correo de confirmación
        try {
            await sendMailToRegister(email, nuevoToken);
        } catch (emailError) {
            console.error('⚠️ No se pudo reenviar el correo:', emailError.message);
            return res.status(500).json({ msg: 'No se pudo enviar el correo. Intenta más tarde.' });
        }

        res.status(200).json({ msg: 'Token de confirmación reenviado. Revisa tu correo institucional.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Error interno del servidor", error: error.message });
    }
};

export {
    registro,
    confirmarMail,
    reenviarConfirmacion,
    recuperarPassword,
    comprobarTokenPasword,
    crearNuevoPassword,
    login,
    cerrarSesion,
    perfil,
    actualizarPerfil,
    actualizarPassword,
    cambiarRol,
};
