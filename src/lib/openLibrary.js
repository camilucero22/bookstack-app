// Open Library: gratis, sin API key. Pedimos solo los campos necesarios (parámetro "fields").
const FIELDS = "key,title,author_name,first_publish_year,cover_i,language,subject";

export async function searchBooks(text, signal) {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(text)}&fields=${FIELDS}&limit=6`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("openlibrary " + res.status);
  const data = await res.json();
  return (data.docs || []).map((d) => ({
    key: d.key,
    title: d.title,
    author: (d.author_name || [])[0] || "",
    year: d.first_publish_year,
    coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null,
    language: guessLanguage(d.language),
    genre: guessGenre(d.subject),
  }));
}

// Open Library lista los idiomas de todas las ediciones; priorizamos español, inglés y portugués.
function guessLanguage(codes = []) {
  if (!codes.length) return null;
  if (codes.includes("spa")) return "Español";
  if (codes.includes("eng")) return "Inglés";
  if (codes.includes("por")) return "Portugués";
  return "Otro";
}

// Aproximación por palabras clave de los temas. Es solo una sugerencia: se puede cambiar a mano.
function guessGenre(subjects = []) {
  const s = subjects.join(" ").toLowerCase();
  if (/juvenile|children|picture book/.test(s)) return "Infantil";
  if (!/non-?fiction/.test(s) && /fiction|fantasy|novel|mystery|romance|poetry|stories/.test(s)) return "Ficción";
  if (/history|war|politic|biograph/.test(s)) return "Historia";
  if (/science|computer|technolog|mathematic|engineering|programming/.test(s)) return "Ciencia y tecnología";
  return null;
}
