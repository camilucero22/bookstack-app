
import { useState } from "react";
import { GENRES } from "../constants";

export default function Cover({ book, size = "M" }) {
  const [bad, setBad] = useState(false);

  const g =
    GENRES.find((x) => x.name === book.genre) ||
    GENRES[GENRES.length - 1];

  if (book.coverId && !bad) {
    const src = book.coverId.startsWith("http")
      ? book.coverId
      : `https://covers.openlibrary.org/b/id/${book.coverId}-${size}.jpg`;

    return (
      <img
        className="cover"
        loading="lazy"
        alt={`Tapa de ${book.title}`}
        src={src}
        onError={() => setBad(true)}
      />
    );
  }

  return (
    <div
      className="cover gen"
      style={{ background: g.bg, color: g.text }}
    >
      <strong>{book.title}</strong>
      <span>{book.author}</span>
    </div>
  );
}
