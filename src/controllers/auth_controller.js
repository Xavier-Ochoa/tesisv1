// ===== LOGIN — HU-001 =====
const login = async (req, res) => {
    try {
        // Acepta 'correoInstitucional' o 'email', y 'contraseña' o 'password'
        const email    = req.body.correoInstitucional || req.body.email;
        const password = req.body.contraseña         || req.body.password;

        if (!email || !password) {
            return res.status(400).json({
                msg: 'Debes proporcionar correo y contraseña'
            });
        }

        const usuarioBDD = await Estudiante.findOne({
            email: email.toLowerCase()
        }).select('-__v -updatedAt -createdAt +confirmEmail +estado');

        if (!usuarioBDD) {
            return res.status(404).json({
                msg: 'El usuario no se encuentra registrado'
            });
        }

        if (!usuarioBDD.confirmEmail) {
            return res.status(403).json({
                msg: 'Debes confirmar tu correo institucional antes de iniciar sesión'
            });
        }

        if (usuarioBDD.estado === 'inactivo') {
            return res.status(403).json({
                msg: 'Tu cuenta ha sido suspendida. Contacta con el administrador.'
            });
        }

        const passwordValido = await usuarioBDD.matchPassword(password);
        if (!passwordValido) {
            return res.status(401).json({
                msg: 'La contraseña no es correcta'
            });
        }

        const {
            _id,
            nombre,
            apellido,
            rol,
            cedula,
            fotoPerfil,
            carrera,
            semestre,
            telefono,
            descripcion,
            github
        } = usuarioBDD;

        const token = crearTokenJWT(_id, rol);

        // ✅ RESPUESTA CORRECTA (token + usuario)
        return res.status(200).json({
            token,
            usuario: {
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
                github
            }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            msg: `❌ Error en el servidor - ${error.message}`
        });
    }
};
