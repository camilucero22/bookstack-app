
import { useState } from "react";
import { GENRES } from "../constants";
import { BookOpen } from "lucide-react";

export default function Cover({ book, size = "M", priority = true }) {
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
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        alt={`Tapa de ${book.title}`}
        src={src}
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth <= 1 || img.naturalHeight <= 1) {
            setBad(true);
          }
        }}
        onError={() => setBad(true)}
      />
    );
  }

  return (
    <div
      className="cover gen"
      style={{ background: g.bg, color: g.text }}
    >
      <div className="gen-icon">
        <BookOpen size={27} strokeWidth={1.5} />
      </div>

      <div className="gen-info">
        <strong>{book.title}</strong>
        <span>{book.author}</span>
      </div>
    </div>
  );
}
