/**
 * Reglas centralizadas de modificación y versionado de proyectos.
 *
 * enviarAlAdmin:false = antiguo 'privado'
 * enviarAlAdmin:true  = antiguo 'publico'
 */

/**
 * Reglas de edición:
 *  - Solo se puede editar la última versión.
 *  - enviarAlAdmin:false + pendiente/rechazado → ✅
 *  - enviarAlAdmin:false + aprobado            → ❌
 *  - enviarAlAdmin:true  + rechazado           → ✅ (para corregir y reenviar)
 *  - enviarAlAdmin:true  + pendiente           → ❌
 *  - enviarAlAdmin:true  + aprobado            → ❌
 */
export const validarEditable = (proyecto) => {
  if (!proyecto.esUltimaVersion) {
    return 'Solo se puede modificar la última versión del proyecto';
  }
  const { enviarAlAdmin, estado } = proyecto;

  if (!enviarAlAdmin) {
    if (estado === 'pendiente' || estado === 'rechazado') return null;
    return 'Un proyecto no enviado al admin solo puede editarse si está pendiente o rechazado';
  }

  // enviarAlAdmin = true
  if (estado === 'rechazado') return null;
  return 'Un proyecto enviado al admin solo puede editarse cuando ha sido rechazado';
};

/**
 * Reglas de versionado:
 *  - Solo aplica a la última versión.
 *  - Solo cuando ya fue aprobado (sin importar enviarAlAdmin).
 *  - La nueva versión puede enviarse o no al admin (lo elige el autor).
 */
export const validarVersionable = (proyecto) => {
  if (!proyecto.esUltimaVersion) {
    return 'Solo se puede versionar desde la última versión del proyecto';
  }
  const { estado } = proyecto;

  if (estado === 'pendiente') {
    return 'El proyecto está pendiente de revisión. Espera la respuesta del administrador antes de crear una nueva versión';
  }
  if (estado === 'rechazado') {
    return 'El proyecto fue rechazado. Edítalo para corregir los problemas y vuelve a enviarlo. No es posible crear una nueva versión de un proyecto rechazado';
  }
  if (estado === 'aprobado') return null;
  return 'El proyecto debe estar aprobado para poder crear una nueva versión';
};

/**
 * Verifica si el usuario es autor o colaborador del proyecto.
 */
export const rolesEnProyecto = (proyecto, usuarioId) => {
  const id = usuarioId.toString();
  const autorId = proyecto.autor?._id
    ? proyecto.autor._id.toString()
    : proyecto.autor.toString();
  const esAutor = autorId === id;
  const esColaborador = proyecto.colaboradores.some(c => {
    const colId = c?._id ? c._id.toString() : c.toString();
    return colId === id;
  });
  return { esAutor, esColaborador };
};
