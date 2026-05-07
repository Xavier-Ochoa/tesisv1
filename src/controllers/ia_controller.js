import fetch from 'node-fetch';

// ============================================================
// CONFIGURACIÓN HUGGING FACE
// ============================================================
const HF_API_URL = 'https://router.huggingface.co/v1/chat/completions';

// ============================================================
// POST /api/ia/generar-imagen-proyecto
// Body: { descripcion: string }
// Retorna: { success, data: { titulos, modelo } }
// (NOTA: aunque el nombre diga "imagen", SOLO genera TÍTULOS)
// ============================================================
export const generarImagenProyecto = async (req, res) => {
  try {
    const { descripcion } = req.body;

    // ---------------- VALIDACIÓN ----------------
    if (!descripcion || descripcion.trim().length < 15) {
      return res.status(400).json({
        success: false,
        message: 'La descripción debe tener al menos 15 caracteres'
      });
    }

    const hfToken = process.env.HF_API_TOKEN;
    if (!hfToken) {
      console.error('❌ HF_API_TOKEN no definido');
      return res.status(500).json({
        success: false,
        message: 'Servicio de IA no configurado'
      });
    }

    // ---------------- PROMPT ----------------
    const prompt = `
Devuelve EXCLUSIVAMENTE un JSON válido.
NO escribas texto adicional.
NO expliques nada.
NO incluyas código.

Formato obligatorio:
{
  "titulos": ["", "", ""]
}

Lee la siguiente descripción de un proyecto de programación
y genera 3 títulos claros, profesionales y coherentes:

"${descripcion}"
`;

    // ---------------- LLAMADA A IA ----------------
    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/Llama-3.1-8B-Instruct',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        max_tokens: 150
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error Hugging Face:', response.status, errorText);
      return res.status(500).json({
        success: false,
        message: 'Error al comunicarse con la IA'
      });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    // ---------------- EXTRACCIÓN DE JSON ----------------
    let salida;
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('JSON no encontrado');
      salida = JSON.parse(match[0]);
    } catch (err) {
      console.error('❌ JSON inválido:', err, '\nTexto IA:', text);
      return res.status(500).json({
        success: false,
        message: 'La IA no devolvió un JSON válido'
      });
    }

    // ---------------- RESPUESTA FINAL ----------------
    res.status(200).json({
      success: true,
      data: {
        titulos: Array.isArray(salida.titulos) ? salida.titulos : [],
        modelo: 'mistralai/Mistral-7B-Instruct-v0.2'
      }
    });

  } catch (error) {
    console.error('❌ Error interno:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};
