import { useState } from "react";
import { GENRES, AGES } from "../constants";

// Lomo de libro: el grosor crece con el stock, así lo que hay que reponer se ve finito.
export default function BookSpine({ book, onEdit, onDelete, onSell }) {
  const g = GENRES.find((x) => x.name === book.genre) || GENRES[GENRES.length - 1];
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [age, setAge] = useState(AGES[0]);
  const validQty = Number.isInteger(Number(qty)) && qty >= 1 && qty <= book.stock;

  const confirm = async () => {
    if (await onSell(Number(qty), age)) { setOpen(false); setQty(1); }
  };

  return (
    <li>
      <div className="spine" style={{ "--c": g.bg, "--t": g.text, "--stock": book.stock }}>
        <span className="a">{book.author}</span>
        <strong className="t">{book.title}</strong>
        <span className="m"><span>{book.language}</span><b>${book.price.toLocaleString("es-AR")}</b></span>
        <span className={"s" + (book.stock <= 2 ? " low" : "")} title="Unidades en stock">{book.stock}</span>
      </div>
      <div className="actions end">
        <button className="btn sm" disabled={book.stock === 0} onClick={() => setOpen(!open)}>
          {book.stock === 0 ? "Sin stock" : "Vender"}
        </button>
        <button className="btn sm" onClick={onEdit}>Editar</button>
        <button className="btn sm" onClick={onDelete}>Eliminar</button>
      </div>
      {open && (
        <div className="sell">
          <label>Cantidad (máx. {book.stock})
            <input type="number" min="1" max={book.stock} step="1" value={qty} onChange={(e) => setQty(e.target.value)} />
          </label>
          <label>Edad del comprador
            <select value={age} onChange={(e) => setAge(e.target.value)}>{AGES.map((a) => <option key={a}>{a}</option>)}</select>
          </label>
          <button className="btn solid" disabled={!validQty} onClick={confirm}>Registrar venta</button>
        </div>
      )}
    </li>
  );
}
