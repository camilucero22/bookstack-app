import { useState } from "react";
import { GENRES, LANGS } from "../constants";
import TitleSearch from "./TitleSearch";

const Field = ({ name, label, msg, children }) => (
  <label>
    {label}
    {children}
    <span id={name + "-e"} className="error-msg">{msg}</span>
  </label>
);

// Muestra el error recién después de interactuar (:user-invalid) y lo expone con aria-invalid.
const sync = (e) => {
  const el = e.target;
  if (!el.matches?.("input, select")) return;
  if (el.matches(":user-invalid")) el.setAttribute("aria-invalid", "true");
  else el.removeAttribute("aria-invalid");
};

export default function BookForm({ initial, suppliers = [], submitLabel, onSubmit, onCancel }) {
  const [f, setF] = useState(initial
    ? {
      title: initial.title, author: initial.author, genre: initial.genre, language: initial.language, price: initial.price,
      stock: initial.stock, supplierId: initial.supplierId ?? "", year: initial.year ?? null, coverId: initial.coverId ?? null
    }
    : { title: "", author: "", genre: GENRES[0].name, language: LANGS[0], price: "", stock: "", supplierId: "", year: null, coverId: null });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  // Al elegir un libro real se completan título, autor, idioma, género, año y tapa; precio y stock los cargás vos.
  const pick = (b) => setF((p) => ({
    ...p, title: b.title, author: b.author || p.author, language: b.language || p.language, genre: b.genre || p.genre,
    year: b.year ?? null,
    coverId: b.coverUrl ?? null,
  }));

  const submit = (e) => {
    e.preventDefault();
    onSubmit({ ...f, title: f.title.trim(), author: f.author.trim(), price: Number(f.price), stock: Number(f.stock), supplierId: f.supplierId || null });
  };

  return (
    <form className="card-form" onSubmit={submit} onBlur={sync} onInput={sync}>
      <div className="fields">
        <TitleSearch value={f.title} onChange={(v) => setF((p) => ({ ...p, title: v }))} onPick={pick} />
        <Field name="author" label="Autor" msg="Escribí el autor.">
          <input value={f.author} onChange={set("author")} required pattern=".*\S.*" aria-errormessage="author-e" />
        </Field>
        <Field name="genre" label="Género">
          <select value={f.genre} onChange={set("genre")}>{GENRES.map((g) => <option key={g.name}>{g.name}</option>)}</select>
        </Field>
        <Field name="language" label="Idioma">
          <select value={f.language} onChange={set("language")}>{LANGS.map((l) => <option key={l}>{l}</option>)}</select>
        </Field>
        <Field name="price" label="Precio ($)" msg="El precio debe ser un entero mayor a 0.">
          <input type="number" inputMode="numeric" min="1" step="1" value={f.price} onChange={set("price")} required aria-errormessage="price-e" />
        </Field>
        <Field name="stock" label="Stock (unidades)" msg="El stock debe ser un entero de 0 o más.">
          <input type="number" inputMode="numeric" min="0" step="1" value={f.stock} onChange={set("stock")} required aria-errormessage="stock-e" />
        </Field>
        <Field name="supplier" label="Proveedor habitual (opcional)">
          <select value={f.supplierId} onChange={set("supplierId")}>
            <option value="">Sin proveedor</option>
            {suppliers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      </div>
      <div className="actions">
        <button type="submit" className="btn solid">{submitLabel || (initial ? "Guardar cambios" : "Agregar libro")}</button>
        <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}
