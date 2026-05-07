import fetch from "node-fetch";

export const getRandomImage = async (query = "motivational") => {
  const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY; // Se lee al momento de ejecutar la función
  

  try {
    const response = await fetch(
      `https://api.unsplash.com/photos/random?query=${query}&orientation=landscape&count=1`,
      {
        headers: {
          Authorization: `Client-ID ${ACCESS_KEY}` // Aquí va tu Access Key
        }
      }
    );

    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(`Error al obtener imagen de Unsplash: ${JSON.stringify(errorBody)}`);
    }

    const data = await response.json();
    return data[0].urls.full; // Devuelve la URL completa de la imagen
  } catch (error) {
    console.error("Error obteniendo la imagen de Unsplash:", error);
    return "";
  }
};
