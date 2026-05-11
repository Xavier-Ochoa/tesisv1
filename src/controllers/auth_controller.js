import { getRandomImage } from "../services/imagenFondo.js";
import { sendMailToRecoveryPassword, sendMailToRegister } from "../helpers/sendMail.js"
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
            // estado: true, fechaRegistro: now, confirmEmail: false
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
            msg: `Error en el servidor: ${error.message}`,
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        });
    }
};

// ===== CONFIRMAR CORREO — HU-001 =====
const confirmarMail = async (req, res) => {
    try {
        const { token } = req.params;
        // +token y +confirmEmail son necesarios porque tienen select:false en el modelo
        const usuarioBDD = await Estudiante.findOne({ token }).select('+token +confirmEmail');
        if (!usuarioBDD) return res.status(404).json({ msg: 'Token inválido o cuenta ya confirmada' });
        usuarioBDD.token        = null;
        usuarioBDD.confirmEmail = true;
        await usuarioBDD.save();
        res.status(200).json({ msg: 'Cuenta confirmada. Ya puedes iniciar sesión.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: `❌ Error en el servidor - ${error}` });
    }
};

// ===== RECUPERAR CONTRASEÑA =====
const recuperarPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ msg: 'Debes ingresar tu correo institucional' });
        // +token necesario porque tiene select:false en el modelo
        const usuarioBDD = await Estudiante.findOne({ email: email.toLowerCase() }).select('+token');
        if (!usuarioBDD) return res.status(404).json({ msg: 'El usuario no se encuentra registrado' });
        const token = usuarioBDD.createToken();
        usuarioBDD.token = token;
        await sendMailToRecoveryPassword(email, token);
        await usuarioBDD.save();
        res.status(200).json({ msg: 'Revisa tu correo institucional para restablecer tu contraseña' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: `❌ Error en el servidor - ${error}` });
    }
};

// ===== COMPROBAR TOKEN DE RECUPERACIÓN =====
const comprobarTokenPasword = async (req, res) => {
    try {
        const { token } = req.params;
        // +token necesario porque tiene select:false en el modelo
        const usuarioBDD = await Estudiante.findOne({ token }).select('+token');
        if (usuarioBDD?.token !== token) return res.status(404).json({ msg: 'Token inválido o expirado' });
        res.status(200).json({ msg: 'Token confirmado. Ya puedes crear tu nueva contraseña.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: `❌ Error en el servidor - ${error}` });
    }
};

// ===== CREAR NUEVA CONTRASEÑA =====
const crearNuevoPassword = async (req, res) => {
    try {
        const { password, confirmpassword } = req.body;
        const { token } = req.params;

        if (!password || !confirmpassword) return res.status(400).json({ msg: 'Debes llenar todos los campos' });
        if (password !== confirmpassword) return res.status(400).json({ msg: 'Las contraseñas no coinciden' });

        // +token necesario porque tiene select:false en el modelo
        const usuarioBDD = await Estudiante.findOne({ token }).select('+token');
        if (!usuarioBDD) return res.status(404).json({ msg: 'Token inválido o expirado' });

        usuarioBDD.password = await usuarioBDD.encryptPassword(password);
        usuarioBDD.token    = null;
        await usuarioBDD.save();

        res.status(200).json({ msg: '¡Contraseña actualizada! Ya puedes iniciar sesión.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: `❌ Error en el servidor - ${error}` });
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

        if (!usuarioBDD.estado)
            return res.status(403).json({ msg: 'Tu cuenta ha sido deshabilitada. Contacta al administrador.' });

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
        res.status(500).json({ msg: `❌ Error en el servidor - ${error}` });
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
        res.status(500).json({ msg: `Error en el servidor: ${error.message}` });
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
        res.status(500).json({ msg: `Error en el servidor: ${error}` });
    }
};

// ===== ACTUALIZAR PERFIL — HU-004 =====
/**
 * Campos PERMITIDOS para actualizar:
 *   apellido, fotoPerfil (archivo), carrera, semestre, telefono, descripcion, github
 *
 * Campos BLOQUEADOS (inmutables):
 *   nombre, cedula, email / correoInstitucional, rol
 */
const actualizarPerfil = async (req, res) => {
    try {
        const { id } = req.params;

        // Solo el propio usuario puede actualizar su perfil
        if (req.estudianteBDD._id.toString() !== id) {
            return res.status(403).json({ msg: 'Solo puedes actualizar tu propio perfil' });
        }

        // BUG FIX: cuando se envía form-data y express-fileupload falla al crear el
        // directorio temporal, req.body puede quedar undefined. Nos aseguramos de que
        // siempre sea al menos un objeto vacío para evitar el crash.
        req.body = req.body ?? {};

        // Bloquear campos inmutables
        const camposBloqueados = ['nombre', 'cedula', 'email', 'correoInstitucional', 'rol'];
        const intentoModificar = camposBloqueados.filter(campo => req.body[campo] !== undefined);
        if (intentoModificar.length > 0) {
            return res.status(400).json({
                msg: `Los siguientes campos no pueden modificarse: ${intentoModificar.join(', ')}`
            });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ msg: `ID inválido: ${id}` });
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
        const { apellido, carrera, semestre, telefono, descripcion, github } = req.body;

        usuarioBDD.apellido    = apellido    ?? usuarioBDD.apellido;
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
        res.status(500).json({ msg: `❌ Error en el servidor - ${error.message}` });
    }
};

// ===== ACTUALIZAR CONTRASEÑA =====
const actualizarPassword = async (req, res) => {
    try {
        const usuarioBDD = await Estudiante.findById(req.estudianteHeader._id);
        if (!usuarioBDD) return res.status(404).json({ msg: 'Usuario no encontrado' });

        const passwordActual = req.body.passwordactual || req.body.contraseñaActual;
        const passwordNuevo  = req.body.passwordnuevo  || req.body.contraseñaNueva;

        const valido = await usuarioBDD.matchPassword(passwordActual);
        if (!valido) return res.status(400).json({ msg: 'La contraseña actual no es correcta' });

        usuarioBDD.password = await usuarioBDD.encryptPassword(passwordNuevo);
        await usuarioBDD.save();
        res.status(200).json({ msg: 'Contraseña actualizada correctamente' });
    } catch (error) {
        res.status(500).json({ msg: `❌ Error en el servidor - ${error}` });
    }
};

export {
    registro,
    confirmarMail,
    recuperarPassword,
    comprobarTokenPasword,
    crearNuevoPassword,
    login,
    cerrarSesion,
    perfil,
    actualizarPerfil,
    actualizarPassword,
};
