import { useState } from "react";
import Modal from "./Modal";
import EntregaDialog from "./EntregaDialog";
import * as E from "../lib/encargosDb";
import { STATUS, money, norm, fmtDate, waLink, waNumber, waMessage } from "../lib/encargos";

const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

const StageIcon = ({ name }) => {
  const icons = {
    inbox: <><path d="M4 4h16v12h-4l-2 3h-4l-2-3H4z" /><path d="M4 12h4l2 3h4l2-3h4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    truck: <><path d="M3 6h11v11H3z" /><path d="M14 10h4l3 3v4h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>,
    "package-check": <><path d="M12 3 3.5 7.5 12 12l8.5-4.5L12 3z" /><path d="M3.5 7.5V17L12 21l8.5-4V7.5" /><path d="M12 12v9" /><path d="m15 15 1.5 1.5L19 14" /></>,
    "check-circle-2": <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
    ban: <><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></>,
  };

  return <Icon>{icons[name]}</Icon>;
};

const FILTERS = [
  { id: "all", label: "Todos", icon: "inbox" },
  { id: "pending", label: "Pendiente", icon: "clock" },
  { id: "ordered", label: "Pedido", icon: "truck" },
  { id: "received", label: "Recibido", icon: "package-check" },
  { id: "delivered", label: "Entregado", icon: "check-circle-2" },
  { id: "cancelled", label: "Cancelado", icon: "ban" },
];

export default function Encargos({ orders, books, suppliers, ctx, run, onNew, onEdit }) {
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [delivering, setDelivering] = useState(null);

  const bookById = Object.fromEntries(books.map((b) => [b.id, b]));
  const supById = Object.fromEntries(suppliers.map((s) => [s.id, s]));
  const count = (st) => orders.filter((o) => o.status === st).length;
  const needle = norm(q);
  const list = orders
    .filter((o) => filter === "all" || o.status === filter)
    .filter((o) =>
      !needle ||
      norm(o.customerName + " " + o.title + " " + o.author).includes(needle)
    );
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

  const actions = (o) => {
    const edit = <button key="e" className="btn sm" onClick={() => onEdit(o)}>Editar</button>;
    const stop = <button key="c" className="btn sm danger" onClick={() => cancel(o)}>Cancelar</button>;
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
      case "received": {
        // Los encargos viejos pueden no tener `notifiedAt` (undefined): se tratan como "sin avisar".
        const notified = !!o.notifiedAt;
        return [
          // Un solo <a>: abre WhatsApp con el enlace/mensaje existentes y, en el mismo clic,
          // registra el aviso. Verde sólido la primera vez, verde suave sin borde en los recordatorios.
          <a
            key="w"
            className={"btn sm " + (notified ? "wa-soft" : "wa")}
            href={waLink(o.customerPhone, waMessage(o, bookById[o.bookId]))}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              run(
                () => E.markNotified(ctx, o.id),
                notified ? "Aviso actualizado" : "Marcado como avisado"
              )
            }
          >
            {notified ? "Avisar nuevamente" : "Avisar por WhatsApp"}
          </a>,
          <button key="t" className="btn sm" onClick={() => setDelivering(o)}>Entregar</button>,
          edit, stop,
        ];
      }
      case "delivered": return null;
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
      <div className="order-stages" role="group" aria-label="Filtrar encargos por etapa">
        {FILTERS.map((s) => {
          const active = filter === s.id;

          return (
            <button
              key={s.id}
              aria-pressed={active}
              className={"order-stage stage-" + s.id + (active ? " active" : "")}
              onClick={() => {
                setFilter(s.id);
              }}
            >
              <span className="stage-icon">
                <StageIcon name={s.icon} />

                {s.id === "pending" && count("pending") > 0 && (
                  <span className="stage-count">{count("pending")}</span>
                )}
              </span>

              <span className="stage-label">{s.label}</span>
              <span className="stage-indicator" />
            </button>
          );
        })}
      </div>

      <div className="headrow">
        <h2>
          Encargos <span className="count">{list.length}</span>
        </h2>
        <button className="btn solid" onClick={onNew}><Icon><path d="M12 5v14M5 12h14" /></Icon>Nuevo encargo</button>
      </div>

      {list.length ? (
        <ul className="orders">
          {list.map((o) => (
            <li key={o.id} className="order">
              <div>
                <div className="o-top"><strong>{o.customerName}</strong><span className={"chip " + o.status}>{STATUS[o.status].label}</span></div>
                {o.status === "received" && o.notifiedAt && (
                  <small className="muted">
                    <span
                      className="notification-badge"
                      title={fmtDate(o.notifiedAt) ? `Último aviso: ${fmtDate(o.notifiedAt)}` : undefined}
                    >
                      Avisado ✓
                    </span>
                  </small>
                )}
                {o.status === "received" && (
                  <small className="muted">WhatsApp: +{waNumber(o.customerPhone)}</small>
                )}
              </div>
              <div>
                <strong>{o.qty > 1 ? `${o.qty} × ` : ""}{o.title}</strong>
                <small className="muted">
                  {o.author}{o.year ? ` · ${o.year}` : ""}
                </small>
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