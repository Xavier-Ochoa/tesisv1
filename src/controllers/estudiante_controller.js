import Estudiante from '../models/Estudiante.js';

/**
 * Listar usuarios con filtros opcionales.
 * Solo para administradores.
 *
 * FIX: el filtro ya no tiene { rol: 'estudiante' } hardcodeado.
 * Ahora acepta ?rol=estudiante | ?rol=docente | sin param = todos.
 *
 * Filtros disponibles: rol, carrera, semestre, apellido
 */
export const listarEstudiantes = async (req, res) => {
  try {
    const { carrera, semestre, apellido, rol } = req.query;

    // Filtro dinámico — sin rol fijo
    const filtro = {};

    // Filtro por rol (opcional)
    if (rol) {
      const rolesValidos = ['estudiante', 'docente', 'admin'];
      if (!rolesValidos.includes(rol)) {
        return res.status(400).json({
          success: false,
          message: 'El rol debe ser "estudiante", "docente" o "admin"',
        });
      }
      filtro.rol = rol;
    }

    // Filtro por carrera (búsqueda exacta)
    if (carrera) {
      filtro.carrera = carrera;
    }

    // Filtro por semestre (búsqueda exacta)
    if (semestre) {
      const semestreNumero = parseInt(semestre);
      if (semestreNumero >= 0 && semestreNumero <= 5) {
        filtro.semestre = semestreNumero;
      } else {
        return res.status(400).json({
          success: false,
          message: 'El semestre debe ser un número entre 0 y 5',
        });
      }
    }

    // Filtro por apellido (búsqueda parcial - case insensitive)
    if (apellido) {
      filtro.apellido = { $regex: apellido, $options: 'i' };
    }

    const usuarios = await Estudiante.find(filtro)
      .select('nombre apellido email cedula carrera semestre rol fotoPerfil +estado +confirmEmail')
      .sort({ apellido: 1, nombre: 1 })
      .lean();

    res.status(200).json({
      success: true,
      total: usuarios.length,
      filtros: {
        rol:      rol      || 'todos',
        carrera:  carrera  || 'todos',
        semestre: semestre || 'todos',
        apellido: apellido || 'todos',
      },
      data: usuarios,
    });

  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los usuarios',
      error: error.message,
    });
  }
};

/**
 * Obtener un usuario por ID.
 * Solo para administradores.
 */
export const obtenerEstudiante = async (req, res) => {
  try {
    const { id } = req.params;

    const estudiante = await Estudiante.findById(id)
      .select('-password -token +confirmEmail +estado')
      .lean();

    if (!estudiante) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    res.status(200).json({
      success: true,
      data: estudiante,
    });

  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el usuario',
      error: error.message,
    });
  }
};

/**
 * Cambiar el estado de un usuario (activo / inactivo).
 * Solo para administradores.
 * El admin NO puede cambiar su propio estado.
 */
export const cambiarEstadoUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    const adminId = req.estudianteBDD._id.toString();

    // Validar que se envió el campo estado
    if (!estado) {
      return res.status(400).json({
        success: false,
        message: 'El campo "estado" es obligatorio',
      });
    }

    // Validar que el valor sea uno de los permitidos
    const estadosValidos = ['activo', 'inactivo'];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        message: 'El estado debe ser "activo" o "inactivo"',
      });
    }

    // Impedir que el admin cambie su propio estado
    if (id === adminId) {
      return res.status(400).json({
        success: false,
        message: 'No puedes cambiar el estado de tu propia cuenta de administrador',
      });
    }

    const usuario = await Estudiante.findById(id).select('+estado');
    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    // Evitar actualización innecesaria si ya tiene ese estado
    if (usuario.estado === estado) {
      return res.status(400).json({
        success: false,
        message: `El usuario ya se encuentra en estado "${estado}"`,
      });
    }

    usuario.estado = estado;
    await usuario.save();

    res.status(200).json({
      success: true,
      message: `El estado del usuario ${usuario.nombre} ${usuario.apellido} fue cambiado a "${estado}" correctamente`,
      data: {
        id:      usuario._id,
        nombre:  usuario.nombre,
        apellido: usuario.apellido,
        email:   usuario.email,
        estado:  usuario.estado,
      },
    });

  } catch (error) {
    console.error('Error al cambiar estado del usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar el estado del usuario',
      error: error.message,
    });
  }
};

/**
 * Estadísticas de usuarios.
 * FIX: ya no filtra solo 'estudiante' — incluye todos los roles.
 * Solo para administradores.
 */
export const estadisticasEstudiantes = async (req, res) => {
  try {
    const totalUsuarios = await Estudiante.countDocuments({});

    const porRol = await Estudiante.aggregate([
      { $group: { _id: '$rol', total: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);

    const porCarrera = await Estudiante.aggregate([
      { $match: { rol: 'estudiante' } },
      { $group: { _id: '$carrera', total: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);

    const porNivel = await Estudiante.aggregate([
      { $match: { rol: 'estudiante' } },
      { $group: { _id: '$semestre', total: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalUsuarios,
        porRol,
        porCarrera,
        porNivel,
      },
    });

  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message,
    });
  }
};
