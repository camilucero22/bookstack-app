import { useState } from "react";
import Modal from "./Modal";
import EntregaDialog from "./EntregaDialog";
import * as E from "../lib/encargosDb";
import { STATUS, money, norm, fmtDate, waLink, waNumber, waMessage } from "../lib/encargos";

const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const FILTERS = ["all", "pending", "ordered", "received", "delivered", "cancelled"];

export default function Encargos({ orders, books, suppliers, ctx, run, onNew, onEdit, onAddToCatalog }) {
  const [filter, setFilter] = useState("all");
  const [archived, setArchived] = useState(false);
  const [q, setQ] = useState("");
  const [delivering, setDelivering] = useState(null);

  const bookById = Object.fromEntries(books.map((b) => [b.id, b]));
  const supById = Object.fromEntries(suppliers.map((s) => [s.id, s]));
  const live = orders.filter((o) => !o.archived);
  const count = (st) => live.filter((o) => o.status === st).length;
  const needle = norm(q);
  const list = orders
    .filter((o) => !!o.archived === archived && (archived || filter === "all" || o.status === filter))
    .filter((o) => !needle || norm(o.customerName + " " + o.title + " " + o.author).includes(needle));

  const go = (o, status, msg) => run(() => E.setStatus(ctx, o.id, status), msg);
  const cancel = async (o) => {
    if (!window.confirm(`¿Cancelar el encargo de ${o.customerName}?`)) return;
    const restock = o.status === "received" && !!o.bookId
      && window.confirm(`Había ${o.qty} ${o.qty === 1 ? "unidad reservada" : "unidades reservadas"}. ¿Las sumo al stock disponible?`);
    run(() => E.cancelOrder(ctx, o, restock),
      "Encargo cancelado" + (o.deposit > 0 ? `. Acordate de devolver la seña de ${money(o.deposit)}` : ""));
  };
  const remove = (o) => {
    if (window.confirm(`¿Eliminar el encargo de ${o.customerName}?`)) run(() => E.removeOrder(ctx, o.id), "Encargo eliminado");
  };
  const archive = (o, value) => run(() => E.updateOrder(ctx, o.id, { archived: value }), value ? "Encargo archivado" : "Encargo desarchivado");

  const actions = (o) => {
    const edit = <button key="e" className="btn sm" onClick={() => onEdit(o)}>Editar</button>;
    const stop = <button key="c" className="btn sm danger" onClick={() => cancel(o)}>Cancelar</button>;
    if (o.archived) return <button className="btn sm" onClick={() => archive(o, false)}>Desarchivar</button>;
    switch (o.status) {
      case "pending": return [
        <button key="o" className="btn sm solid" onClick={() => go(o, "ordered", "Marcado como pedido")}>Marcar pedido</button>,
        edit, stop,
        <button key="d" className="btn sm" onClick={() => remove(o)}>Eliminar</button>,
      ];
      case "ordered": return [
        <button key="r" className="btn sm solid" onClick={() => go(o, "received", `Recibido: avisale a ${o.customerName}`)}>Marcar recibido</button>,
        <button key="p" className="btn sm" onClick={() => go(o, "pending", "Volvió a pendiente")}>Volver a pendiente</button>,
        edit, stop,
      ];
      case "received": return [
        <a key="w" className="btn sm solid" href={waLink(o.customerPhone, waMessage(o, bookById[o.bookId]))} target="_blank" rel="noopener noreferrer"
          onClick={() => run(() => E.markNotified(ctx, o.id), "Marcado como avisado")}>Avisar por WhatsApp</a>,
        <button key="t" className="btn sm" onClick={() => setDelivering(o)}>Entregar</button>,
        !o.bookId && <button key="a" className="btn sm" onClick={() => onAddToCatalog(o)}>Agregar al catálogo</button>,
        edit, stop,
      ];
      case "delivered": return <button className="btn sm" onClick={() => archive(o, true)}>Archivar</button>;
      default: return <button className="btn sm" onClick={() => remove(o)}>Eliminar</button>;
    }
  };

  return (
    <>
      <section className="kpis three" aria-label="Resumen de encargos">
        <div className="kpi"><p>Pendientes</p><b>{count("pending")}</b></div>
        <div className="kpi"><p>Pedidos</p><b>{count("ordered")}</b></div>
        <div className={"kpi" + (count("received") ? " warn" : "")}><p>Para avisar</p><b>{count("received")}</b></div>
      </section>
      <div className="searchbar">
        <Icon><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></Icon>
        <input className="search" type="search" aria-label="Buscar por cliente o libro" placeholder="Buscar por cliente o libro"
          value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="sorts" role="group" aria-label="Filtrar por estado">
        {FILTERS.map((s) => (
          <button key={s} aria-pressed={!archived && filter === s} className={"sort" + (!archived && filter === s ? " on" : "")}
            onClick={() => { setArchived(false); setFilter(s); }}>
            {s === "all" ? "Todos" : STATUS[s].label}
          </button>
        ))}
        <button aria-pressed={archived} className={"sort" + (archived ? " on" : "")} onClick={() => setArchived(!archived)}>Archivados</button>
      </div>
      <div className="headrow">
        <h2>{archived ? "Encargos archivados" : "Encargos"} <span className="count">{list.length}</span></h2>
        <button className="btn solid" onClick={onNew}><Icon><path d="M12 5v14M5 12h14" /></Icon>Nuevo encargo</button>
      </div>

      {list.length ? (
        <ul className="orders">
          {list.map((o) => (
            <li key={o.id} className="order">
              <div>
                <div className="o-top"><strong>{o.customerName}</strong><span className={"chip " + o.status}>{STATUS[o.status].label}</span></div>
                <small className="muted">{o.customerPhone}</small>
                {o.status === "received" && (
                  <small className="muted">{o.notifiedAt ? "Avisado ✓ · " : ""}WhatsApp a +{waNumber(o.customerPhone)}</small>
                )}
              </div>
              <div>
                <strong>{o.qty > 1 ? `${o.qty} × ` : ""}{o.title}</strong>
                <small className="muted">{o.author}{!o.bookId ? " · fuera del catálogo" : ""}</small>
                {o.notes && <small className="notes">“{o.notes}”</small>}
              </div>
              <div>
                <small className="muted">Creado el {fmtDate(o.createdAt) || "…"}</small>
                {o.deposit > 0 && <small className="muted">Seña {money(o.deposit)}</small>}
                {(o.supplierId && supById[o.supplierId]) && <small className="muted">Proveedor: {supById[o.supplierId].name}</small>}
                {o.status === "delivered" && <small className="muted">Entregado por {money(o.salePrice * o.qty)}</small>}
              </div>
              <div className="actions">{actions(o)}</div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty">
          <p className="muted">{orders.length ? "No hay encargos que coincidan." : "Todavía no cargaste encargos. Tocá «Nuevo encargo» para empezar."}</p>
        </div>
      )}

      <Modal open={!!delivering} onClose={() => setDelivering(null)} label="Entregar encargo">
        {delivering && (
          <EntregaDialog order={delivering} book={bookById[delivering.bookId]} onCancel={() => setDelivering(null)}
            onConfirm={async (price, age) => {
              const ok = await run(() => E.deliver(ctx, delivering, price, age), "Entrega registrada");
              if (ok) setDelivering(null);
            }} />
        )}
      </Modal>
    </>
  );
}
