import { useState } from "react";
import { AGES } from "../constants";
import Cover from "./Cover";

const money = (n) => "$" + n.toLocaleString("es-AR");

export default function Cart({ lines, onQty, onRemove, onClear, onConfirm }) {
  const [age, setAge] = useState(AGES[0]);
  const [busy, setBusy] = useState(false);
  const total = lines.reduce((a, l) => a + l.book.price * l.qty, 0);

  const confirm = async () => { setBusy(true); await onConfirm(age); setBusy(false); };

  return (
    <div className="cart">
      <h2 className="mh">Venta en curso</h2>
      <ul>
        {lines.map(({ book, qty }) => (
          <li key={book.id}>
            <Cover book={book} size="S" />
            <div><strong>{book.title}</strong><small>{money(book.price)} c/u</small></div>
            <input type="number" min="1" max={book.stock} step="1" value={qty} aria-label={`Cantidad de ${book.title}`}
              onChange={(e) => onQty(book, Number(e.target.value))} />
            <b>{money(book.price * qty)}</b>
            <button className="btn sm" onClick={() => onRemove(book.id)}>Quitar</button>
          </li>
        ))}
      </ul>
      <label>Edad del comprador (opcional)
        <select value={age} onChange={(e) => setAge(e.target.value)}>{AGES.map((a) => <option key={a}>{a}</option>)}</select>
      </label>
      <p className="total"><span>Total</span><span>{money(total)}</span></p>
      <div className="actions">
        <button className="btn solid" disabled={busy} onClick={confirm}>{busy ? "Guardando…" : "Confirmar venta"}</button>
        <button className="btn" disabled={busy} onClick={onClear}>Vaciar</button>
      </div>
    </div>
  );
}
