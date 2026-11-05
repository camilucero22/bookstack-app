import { useState } from "react";
import { GENRES } from "../constants";
import Cover from "./Cover";

const money = (n) => "$" + n.toLocaleString("es-AR");

export default function BookDetail({ book, sold, revenue, inCart, onAdd, onEdit, onDelete, onClose }) {
  const [n, setN] = useState(1);
  const free = book.stock - inCart;
  const ok = Number.isInteger(Number(n)) && n >= 1 && n <= free;
  const g = GENRES.find((x) => x.name === book.genre) || GENRES[GENRES.length - 1];
  return (
    <div className="detail">
      <Cover book={book} size="L" />
      <div>
        <span className="tag" style={{ background: g.color, color: g.text }}>{book.genre}</span>
        <h2>{book.title}</h2>
        <p className="muted">{book.author}{book.year ? `, ${book.year}` : ""}</p>
        <dl className="facts">
          <div><dt>Precio</dt><dd>{money(book.price)}</dd></div>
          <div><dt>En stock</dt><dd>{book.stock}</dd></div>
          <div><dt>Idioma</dt><dd>{book.language}</dd></div>
          <div><dt>Vendidos</dt><dd>{sold}</dd></div>
          <div><dt>Ingresos</dt><dd>{money(revenue)}</dd></div>
        </dl>
        {book.stock <= 2 && <p className="warn">Quedan pocas unidades: conviene reponer.</p>}
        <div className="buy">
          <label>Cantidad (máx. {free})
            <input type="number" min="1" max={free} step="1" value={n} onChange={(e) => setN(e.target.value)} />
          </label>
          <button className="btn solid" disabled={!ok} onClick={() => onAdd(Number(n))}>Agregar a la venta</button>
        </div>
        <div className="actions">
          <button className="btn sm" onClick={onEdit}>Editar</button>
          <button className="btn sm danger" onClick={onDelete}>Eliminar</button>
          <button className="btn sm" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
