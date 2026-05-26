/**
 * Reglas centralizadas de modificación y versionado de proyectos.
 * Se usan tanto en el controlador del estudiante como en el del colaborador.
 */

/**
 * Devuelve null si el proyecto puede editarse, o un mensaje de error si no.
 *
 * Reglas de edición:
 *  - Solo se puede editar la última versión (esUltimaVersion === true).
 *  - Privado + pendiente  → ✅
 *  - Privado + rechazado  → ✅
 *  - Privado + aprobado   → ❌
 *  - Público  + rechazado → ✅  (para corregir y reenviar)
 *  - Público  + pendiente → ❌
 *  - Público  + aprobado  → ❌
 *
 * @param {object} proyecto  Documento Mongoose
 * @returns {string|null}
 */
export const validarEditable = (proyecto) => {
  if (!proyecto.esUltimaVersion) {
    return 'Solo se puede modificar la última versión del proyecto';
  }

  const { tipoProyecto, estado } = proyecto;

  if (tipoProyecto === 'privado') {
    if (estado === 'pendiente' || estado === 'rechazado') return null;
    return 'Un proyecto privado solo puede editarse si está pendiente o rechazado';
  }

  // público
  if (estado === 'rechazado') return null;
  return 'Un proyecto público solo puede editarse cuando ha sido rechazado';
};

/**
 * Devuelve null si el proyecto puede versionarse, o un mensaje de error si no.
 *
 * Reglas de versionado (independientes de las de edición):
 *  - Solo aplica a la última versión (esUltimaVersion === true).
 *  - Solo proyectos públicos pueden tener versiones.
 *  - Solo cuando el proyecto ya fue aprobado (tiene calidad validada por el admin).
 *
 *  - Privado + cualquier estado → ❌ los privados no versionan, solo se editan
 *  - Público  + pendiente       → ❌ esperar respuesta del admin
 *  - Público  + rechazado       → ❌ editar y corregir primero, no versionar
 *  - Público  + aprobado        → ✅ único caso válido
 *
 * @param {object} proyecto  Documento Mongoose
 * @returns {string|null}
 */
export const validarVersionable = (proyecto) => {
  if (!proyecto.esUltimaVersion) {
    return 'Solo se puede versionar desde la última versión del proyecto';
  }

  const { tipoProyecto, estado } = proyecto;

  if (tipoProyecto === 'privado') {
    return 'Los proyectos privados no pueden tener versiones. Usa la edición directa para modificarlos';
  }

  // público
  if (estado === 'pendiente') {
    return 'El proyecto está pendiente de revisión. Espera la respuesta del administrador antes de crear una nueva versión';
  }

  if (estado === 'rechazado') {
    return 'El proyecto fue rechazado. Edítalo para corregir los problemas señalados y vuelve a enviarlo. No es posible crear una nueva versión de un proyecto rechazado';
  }

  if (estado === 'aprobado') return null;

  return 'El proyecto debe estar aprobado para poder crear una nueva versión';
};

/**
 * Verifica si el usuario es autor o colaborador del proyecto.
 * Maneja tanto ObjectId crudo como objeto populado { _id, nombre, ... }.
 *
 * @param {object} proyecto
 * @param {string} usuarioId
 * @returns {{ esAutor: boolean, esColaborador: boolean }}
 */
export const rolesEnProyecto = (proyecto, usuarioId) => {
  const id = usuarioId.toString();

  // Maneja tanto ObjectId crudo como objeto populado { _id, nombre, ... }
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
