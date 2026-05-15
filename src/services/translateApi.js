import fetch from "node-fetch";

export const translateText = async (text) => {
  try {
    const encodedText = encodeURIComponent(text);
    const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=en|es`;

    const response = await fetch(url);
    if (!response.ok) throw new Error("Error en la API de traducción");

    const data = await response.json();
    return data.responseData.translatedText || text;
  } catch (error) {
    console.error("Error traduciendo texto:", error);
    return text;
  }
};
