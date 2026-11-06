import { useMemo, useState } from "react";
import Modal from "./Modal";
import Suppliers from "./Suppliers";
import * as E from "../lib/encargosDb";
import { NO_SUPPLIER, buildDraft, draftToCsv, draftToText, fmtDate, groupItems } from "../lib/encargos";

const SUGGESTED_QTY = 3;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function Recepcion({ so, onConfirm, onCancel }) {
  const [n, setN] = useState(so.lines.map((l) => String(l.qty)));
  const [busy, setBusy] = useState(false);
  const ok = n.every((v) => v !== "" && Number.isInteger(Number(v)) && Number(v) >= 0);
  const submit = async (e) => { e.preventDefault(); setBusy(true); await onConfirm(n.map(Number)); setBusy(false); };
  return (
    <form className="card-form" onSubmit={submit}>
      <h2 className="mh">Registrar recepción</h2>
      <p className="muted">{so.supplierName}. Contá cuántas unidades llegaron de cada título: primero se reservan para los clientes que hicieron el encargo y lo que sobre suma al stock.</p>
      <ul className="recv">
        {so.lines.map((l, i) => (
          <li key={i}>
            <div><strong>{l.title}</strong><small>Pediste {l.qty}{l.kind === "reposicion" ? " (reposición)" : ""}</small></div>
            <input type="number" min="0" step="1" value={n[i]} aria-label={`Recibidas de ${l.title}`}
              onChange={(e) => setN(n.map((v, j) => (j === i ? e.target.value : v)))} />
          </li>
        ))}
      </ul>
      <div className="actions">
        <button type="submit" className="btn solid" disabled={!ok || busy}>{busy ? "Guardando…" : "Confirmar recepción"}</button>
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

export default function PedidoProveedor({ orders, books, suppliers, supplierOrders, ctx, run, notify }) {
  const [drafting, setDrafting] = useState(false);
  const [sel, setSel] = useState({}); // sugerencias que se decidió sumar: { clave: cantidad }
  const [showSup, setShowSup] = useState(false);
  const [receiving, setReceiving] = useState(null);

  const groups = useMemo(() => buildDraft(orders, books, suppliers), [orders, books, suppliers]);
  const finals = groups.map((g) => ({ ...g, items: groupItems(g, sel) })).filter((g) => g.items.length);
  const pendingN = orders.filter((o) => o.status === "pending" && !o.archived).length;
  const suggestedN = groups.reduce((a, g) => a + g.suggestions.length, 0);
  const ordersById = Object.fromEntries(orders.map((o) => [o.id, o]));
  const today = new Date().toLocaleDateString("es-AR");

  const copy = async (gs) => {
    try { await navigator.clipboard.writeText(draftToText(gs)); notify("ok", "Lista copiada"); }
    catch { notify("error", "No pude copiar. Probá con Exportar."); }
  };
  const csv = () => {
    const url = URL.createObjectURL(new Blob([draftToCsv(finals)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `pedido-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };
  const place = async (gs) => {
    const ok = await run(() => E.placeSupplierOrders(ctx, gs), gs.length > 1 ? "Pedidos registrados" : "Pedido registrado");
    if (ok) setSel((p) => { const n = { ...p }; gs.forEach((g) => g.items.forEach((l) => delete n[l.key])); return n; });
  };
  const toggle = (s, on) => setSel((p) => { const n = { ...p }; if (on) n[s.key] = SUGGESTED_QTY; else delete n[s.key]; return n; });

  return (
    <>
      <div className="headrow top-gap">
        <h2>Pedido al proveedor</h2>
        <div className="actions">
          <button className="btn" onClick={() => setShowSup(true)}>Proveedores</button>
          {!drafting && <button className="btn solid" onClick={() => setDrafting(true)}>Armar pedido</button>}
        </div>
      </div>

      {!drafting ? (
        <div className="empty">
          <p>{plural(pendingN, "encargo pendiente", "encargos pendientes")} y {plural(suggestedN, "libro con stock crítico", "libros con stock crítico")}.</p>
          <p className="muted">Tocá «Armar pedido» para juntarlos por proveedor y por libro.</p>
        </div>
      ) : (
        <>
          <div className="toolbar">
            <button className="btn sm" disabled={!finals.length} onClick={() => copy(finals)}>Copiar lista</button>
            <button className="btn sm" disabled={!finals.length} onClick={csv}>Exportar CSV</button>
            <button className="btn sm" disabled={!finals.length} onClick={() => window.print()}>Exportar PDF</button>
            <button className="btn sm solid" disabled={!finals.length} onClick={() => place(finals)}>Marcar todo como pedido</button>
            <button className="btn sm" onClick={() => { setDrafting(false); setSel({}); }}>Cerrar</button>
          </div>
          {groups.length ? groups.map((g) => {
            const fin = { ...g, items: groupItems(g, sel) };
            return (
              <section className="panel sup" key={g.id || "none"}>
                <div className="ph">
                  <div>
                    <h3>{g.supplier?.name || NO_SUPPLIER}</h3>
                    {g.supplier?.contact && <small>{g.supplier.contact}</small>}
                  </div>
                  <div className="actions">
                    <button className="btn sm" disabled={!fin.items.length} onClick={() => copy([fin])}>Copiar</button>
                    <button className="btn sm solid" disabled={!fin.items.length} onClick={() => place([fin])}>Marcar como pedido</button>
                  </div>
                </div>
                {g.lines.length > 0 && (
                  <ul className="plines">
                    {g.lines.map((l) => (
                      <li key={l.key}>
                        <div><strong>{l.title}</strong><small>{l.author}</small></div>
                        <span className="qty">× {l.qty}</span>
                        <small>{plural(l.customers, "cliente", "clientes")}</small>
                      </li>
                    ))}
                  </ul>
                )}
                {g.suggestions.length > 0 && (
                  <div className="sugg">
                    <p>Sugeridos por stock crítico <small>Marcá los que quieras sumar al pedido</small></p>
                    <ul>
                      {g.suggestions.map((s) => (
                        <li key={s.key}>
                          <label className="chk">
                            <input type="checkbox" checked={!!sel[s.key]} onChange={(e) => toggle(s, e.target.checked)} />
                            <span><strong>{s.title}</strong><small>Quedan {s.stock}</small></span>
                          </label>
                          {sel[s.key] && (
                            <input className="qin" type="number" min="1" step="1" value={sel[s.key]} aria-label={`Cantidad de ${s.title}`}
                              onChange={(e) => setSel({ ...sel, [s.key]: Math.max(1, Number(e.target.value) || 1) })} />
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            );
          }) : <div className="empty"><p className="muted">No hay nada para pedir: no hay encargos pendientes ni libros con stock crítico.</p></div>}

          {/* Versión limpia que sale al imprimir o guardar como PDF */}
          <div className="print-only">
            <h2>Pedido del {today}</h2>
            {finals.map((g) => (
              <div key={g.id || "none"}>
                <h3>{g.supplier?.name || NO_SUPPLIER}{g.supplier?.contact ? ` (${g.supplier.contact})` : ""}</h3>
                <ul>{g.items.map((l) => <li key={l.key}>{l.qty} × {l.title}{l.author ? ` (${l.author})` : ""}{l.isbn ? `, ISBN ${l.isbn}` : ""}</li>)}</ul>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="headrow top-gap">
        <h2>Pedidos enviados <span className="count">{supplierOrders.length}</span></h2>
      </div>
      {supplierOrders.length ? (
        <ul className="orders">
          {supplierOrders.map((so) => {
            const units = so.lines.reduce((a, l) => a + l.qty, 0);
            return (
              <li key={so.id} className="order sent">
                <div>
                  <div className="o-top"><strong>{so.supplierName}</strong><span className={"chip " + (so.status === "received" ? "received" : "ordered")}>{so.status === "received" ? "Recibido" : "Pedido"}</span></div>
                  <small className="muted">Pedido el {fmtDate(so.orderedAt) || "…"}{so.receivedAt ? ` · recibido el ${fmtDate(so.receivedAt)}` : ""}</small>
                </div>
                <div>
                  <strong>{plural(units, "unidad", "unidades")} en {plural(so.lines.length, "título", "títulos")}</strong>
                  <small className="muted">{so.lines.map((l) => l.title).join(", ")}</small>
                </div>
                <div className="actions end">
                  {so.status === "ordered" && <button className="btn sm solid" onClick={() => setReceiving(so)}>Registrar recepción</button>}
                </div>
              </li>
            );
          })}
        </ul>
      ) : <div className="empty"><p className="muted">Todavía no enviaste pedidos.</p></div>}

      <Modal open={showSup} onClose={() => setShowSup(false)} label="Proveedores">
        {showSup && <Suppliers suppliers={suppliers} ctx={ctx} run={run} />}
      </Modal>
      <Modal open={!!receiving} onClose={() => setReceiving(null)} label="Registrar recepción">
        {receiving && (
          <Recepcion so={receiving} onCancel={() => setReceiving(null)}
            onConfirm={async (arr) => {
              const ok = await run(() => E.receiveSupplierOrder(ctx, receiving, arr, ordersById, books), "Recepción registrada");
              if (ok) setReceiving(null);
            }} />
        )}
      </Modal>
    </>
  );
}
