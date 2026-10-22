import { useEffect, useId, useRef, useState } from "react";
import { searchBooks } from "../lib/openLibrary";

// Campo "Título" con autocompletado (patrón combobox accesible: flechas, Enter y Escape).
export default function TitleSearch({ value, onChange, onPick }) {
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const typed = useRef(false); // solo buscamos cuando la persona escribe, no al abrir "Editar"
  const id = useId();

  useEffect(() => {
    const text = value.trim();
    if (!typed.current) return;
    if (text.length < 3) { setResults([]); setStatus("idle"); return; }
    const ctrl = new AbortController();
    setStatus("loading");
    const t = setTimeout(() => {
      searchBooks(text, ctrl.signal)
        .then((r) => { setResults(r); setStatus("idle"); setOpen(true); setActive(-1); })
        .catch((e) => { if (e.name !== "AbortError") setStatus("error"); });
    }, 400); // espera a que termines de escribir
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [value]);

  const pick = (b) => { typed.current = false; setOpen(false); setResults([]); onPick(b); };

  const onKeyDown = (e) => {
    if (!open || !results.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((active + 1) % results.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((active - 1 + results.length) % results.length); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(results[active]); }
    else if (e.key === "Escape") setOpen(false);
  };

  const hint = status === "loading" ? "Buscando en Open Library…"
    : status === "error" ? "No se pudo consultar Open Library. Podés cargar el libro a mano."
    : "Escribí al menos 3 letras para buscar libros reales.";

  return (
    <div className="ac">
      <label htmlFor={id + "-in"}>Título</label>
      <input id={id + "-in"} value={value} required pattern=".*\S.*" autoComplete="off"
        onChange={(e) => { typed.current = true; onChange(e.target.value); }}
        onKeyDown={onKeyDown} onFocus={() => results.length && setOpen(true)} onBlur={() => setOpen(false)}
        role="combobox" aria-expanded={open && results.length > 0} aria-controls={id + "-list"}
        aria-autocomplete="list" aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
        aria-errormessage="title-e" />
      <span id="title-e" className="error-msg">Escribí el título.</span>
      <small className="hint" aria-live="polite">{hint}</small>
      {open && results.length > 0 && (
        <ul id={id + "-list"} role="listbox" className="suggest">
          {results.map((b, i) => (
            <li key={b.key} id={`${id}-${i}`} role="option" aria-selected={i === active}
              className={i === active ? "on" : ""} onMouseDown={(e) => { e.preventDefault(); pick(b); }}>
              {b.coverUrl ? <img src={b.coverUrl} alt="" width="32" height="48" loading="lazy" /> : <span className="nocover" />}
              <span><strong>{b.title}</strong><small>{b.author}{b.year ? `, ${b.year}` : ""}</small></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
