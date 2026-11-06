import { useState } from "react";
import { AGES } from "../constants";
import { money } from "../lib/encargos";

export default function EntregaDialog({ order, book, onConfirm, onCancel }) {
  const [price, setPrice] = useState(book?.price ?? "");
  const [age, setAge] = useState(AGES[0]);
  const [busy, setBusy] = useState(false);
  const p = Number(price);
  const ok = Number.isInteger(p) && p >= 1;
  const total = ok ? p * order.qty : 0;
  const deposit = order.deposit || 0;

  const submit = async (e) => { e.preventDefault(); setBusy(true); await onConfirm(p, age); setBusy(false); };

  return (
    <form className="card-form" onSubmit={submit}>
      <h2 className="mh">Entregar encargo</h2>
      <p className="muted">{order.customerName}: {order.qty} × «{order.title}»</p>
      <div className="fields">
        <label>Precio de venta (c/u, $)
          <input type="number" inputMode="numeric" min="1" step="1" required value={price} onChange={(e) => setPrice(e.target.value)} />
          <span className="error-msg">El precio debe ser un entero mayor a 0.</span>
        </label>
        <label>Edad del comprador (opcional)
          <select value={age} onChange={(e) => setAge(e.target.value)}>{AGES.map((a) => <option key={a}>{a}</option>)}</select>
        </label>
      </div>
      <p className="total"><span>Total</span><span>{money(total)}</span></p>
      {deposit > 0 && <p className="muted">Dejó {money(deposit)} de seña: saldo a cobrar {money(Math.max(0, total - deposit))}.</p>}
      <div className="actions">
        <button type="submit" className="btn solid" disabled={!ok || busy}>{busy ? "Guardando…" : "Registrar entrega"}</button>
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}
