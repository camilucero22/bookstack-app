import { useState } from "react";
import { GENRES, LANGS } from "../constants";
import TitleSearch from "./TitleSearch";
import { STATUS, findDuplicate } from "../lib/encargos";

const Field = ({ label, msg, className, children }) => (
  <label className={className}>{label}{children}{msg && <span className="error-msg">{msg}</span>}</label>
);

export default function EncargoForm({ initial, book, books, suppliers, orders, onSubmit, onMerge, onCancel }) {
  const s = initial || {};
  const [dupe, setDupe] = useState(null);
  const [f, setF] = useState({
    customerName: s.customerName || "",
    customerPhone: s.customerPhone || "",
    bookId: s.bookId || "",
    title: s.title || "",
    author: s.author || "",
    year: s.year || "",
    publisher: s.publisher || "",
    isbn: s.isbn || "",
    genre: s.genre || GENRES[0].name,
    language: s.language || LANGS[0],
    qty: s.qty || 1,
    deposit: s.deposit || "",
    supplierId: s.supplierId || "",
    notes: s.notes || "",
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const pickReal = (b) => setF((p) => ({
    ...p,
    title: b.title,
    author: b.author || p.author,
    year: b.year || "",
    language: b.language || p.language,
    genre: b.genre || p.genre
  }));

  const data = () => ({
    ...f, customerName: f.customerName.trim(), customerPhone: f.customerPhone.trim(), title: f.title.trim(), author: f.author.trim(),
    publisher: f.publisher.trim(), isbn: f.isbn.trim(), qty: Number(f.qty), deposit: Number(f.deposit) || 0,
    bookId: f.bookId || null, supplierId: f.supplierId || null,
  });
  const submit = (e) => {
    e.preventDefault();
    const d = data();
    const ex = findDuplicate(orders, d, initial?.id);
    if (ex) setDupe(ex); else onSubmit(d);
  };

  return (
    <form className="card-form" onSubmit={submit} onInput={() => dupe && setDupe(null)}>
      <div className="fields">
        <Field label="Cliente" msg="Escribí el nombre.">
          <input value={f.customerName} onChange={set("customerName")} required pattern=".*\S.*" autoComplete="off" />
        </Field>
        <Field label="Teléfono / WhatsApp" msg="Ingresá el número con código de área.">
          <input type="tel" inputMode="tel" value={f.customerPhone} onChange={set("customerPhone")} required pattern="[0-9 +()\-]{8,}" placeholder="11 5555 1234" />
          <small className="hint">Sin 0 ni 15 (ej: 11 5555 1234).</small>
        </Field>
        <div className="wide">
          <TitleSearch
            value={f.title}
            onChange={(v) => setF((p) => ({ ...p, title: v }))}
            onPick={pickReal}
          />
        </div>

        <Field label="Autor" msg="Escribí el autor.">
          <input value={f.author} onChange={set("author")} required pattern=".*\S.*" />
        </Field>

        <Field label="Editorial (opcional)">
          <input value={f.publisher} onChange={set("publisher")} />
        </Field>

        <Field label="ISBN (opcional)">
          <input value={f.isbn} onChange={set("isbn")} inputMode="numeric" />
        </Field>

        <Field label="Género">
          <select value={f.genre} onChange={set("genre")}>
            {GENRES.map((g) => <option key={g.name}>{g.name}</option>)}
          </select>
        </Field>

        <Field label="Idioma">
          <select value={f.language} onChange={set("language")}>
            {LANGS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </Field>

        <Field label="Cantidad" msg="La cantidad debe ser un entero mayor a 0.">
          <input type="number" inputMode="numeric" min="1" step="1" value={f.qty} onChange={set("qty")} required />
        </Field>
        <Field label="Seña ($, opcional)" msg="La seña debe ser un entero de 0 o más.">
          <input type="number" inputMode="numeric" min="0" step="1" value={f.deposit} onChange={set("deposit")} />
        </Field>
        <Field label="Proveedor (opcional)">
          <select value={f.supplierId} onChange={set("supplierId")}>
            <option value="">Usar el habitual del libro</option>
            {suppliers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Notas" className="wide">
          <textarea rows="2" value={f.notes} onChange={set("notes")} placeholder="Ej: quiere la edición de bolsillo" />
        </Field>
      </div>

      {dupe && (
        <div className="warn" role="alert">
          <p>Ya hay un encargo {STATUS[dupe.status].label.toLowerCase()} de {dupe.customerName} para «{dupe.title}» ({dupe.qty} {dupe.qty === 1 ? "unidad" : "unidades"}).</p>
          <div className="actions">
            <button type="button" className="btn sm solid" onClick={() => onMerge(dupe, Number(f.qty))}>Sumar {f.qty} al existente</button>
            <button type="button" className="btn sm" onClick={() => onSubmit(data())}>Crear otro igual</button>
          </div>
        </div>
      )}

      <div className="actions">
        <button type="submit" className="btn solid" disabled={!!dupe}>{initial ? "Guardar cambios" : "Guardar encargo"}</button>
        <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}
