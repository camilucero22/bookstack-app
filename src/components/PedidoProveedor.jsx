
import { useMemo, useState } from "react";
import Modal from "./Modal";
import * as E from "../lib/encargosDb";
import {
  NO_SUPPLIER,
  buildDraft,
  draftToCsv,
  draftToText,
  fmtDate,
  groupItems,
} from "../lib/encargos";
import TitleSearch from "./TitleSearch";

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function Recepcion({ so, onConfirm, onCancel }) {
  const [n, setN] = useState(so.lines.map((l) => String(l.qty)));
  const [busy, setBusy] = useState(false);

  const isEncargos = so.orderType
    ? so.orderType === "encargos"
    : so.lines.some((l) => (l.orderIds || []).length > 0);

  const ok = n.every(
    (v) => v !== "" && Number.isInteger(Number(v)) && Number(v) >= 0
  );

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    await onConfirm(n.map(Number));
    setBusy(false);
  };

  return (
    <form className="card-form" onSubmit={submit}>
      <h2 className="mh">Registrar recepción</h2>

      <p className="muted">
        {isEncargos
          ? `${so.supplierName}. Contá cuántas unidades llegaron de cada título. Se registrarán para los clientes y no se sumarán al stock.`
          : `${so.supplierName}. Contá cuántas unidades llegaron de cada título. Todas las unidades recibidas se sumarán al stock disponible.`}
      </p>

      <ul className="recv">
        {so.lines.map((l, i) => (
          <li key={i}>
            <div>
              <strong>{l.title}</strong>
              <small>
                Pediste {l.qty}
                {l.kind === "reposicion" ? " (reposición)" : ""}
              </small>
            </div>

            <input
              type="number"
              min="0"
              step="1"
              value={n[i]}
              aria-label={`Recibidas de ${l.title}`}
              onChange={(e) =>
                setN(n.map((v, j) => (j === i ? e.target.value : v)))
              }
            />
          </li>
        ))}
      </ul>

      <div className="actions">
        <button
          type="submit"
          className="btn solid"
          disabled={!ok || busy}
        >
          {busy ? "Guardando…" : "Confirmar recepción"}
        </button>

        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default function PedidoProveedor({
  orders,
  books,
  suppliers,
  supplierOrders,
  ctx,
  run,
  notify,
}) {
  const [drafting, setDrafting] = useState(false);
  const [orderType, setOrderType] = useState(null);
  const [sel, setSel] = useState({});
  const [manual, setManual] = useState([]);
  const [manualTitle, setManualTitle] = useState("");
  const [manualBook, setManualBook] = useState(null);
  const [manualQty, setManualQty] = useState(1);
  const [receiving, setReceiving] = useState(null);

  const addManual = () => {
    if (!manualTitle.trim()) return;

    const book = manualBook;

    const item = {
      key: "m|" + Date.now(),
      kind: "manual",
      bookId:
        books.find(
          (b) =>
            b.title.trim().toLowerCase() ===
              (book?.title || manualTitle).trim().toLowerCase() &&
            b.author.trim().toLowerCase() ===
              (book?.author || "").trim().toLowerCase()
        )?.id || null,
      title: book?.title || manualTitle.trim(),
      author: book?.author || "",
      isbn: book?.isbn || "",
      qty: Math.max(1, Number(manualQty) || 1),
      orderIds: [],
      genre: book?.genre || "",
      language: book?.language || "",
      year: book?.year || null,
      coverId: book?.coverUrl || null,
    };

    setManual((prev) => [...prev, item]);
    setManualTitle("");
    setManualBook(null);
    setManualQty(1);
  };

  const removeManual = (key) => {
    setManual((prev) => prev.filter((item) => item.key !== key));
  };

  const draft = useMemo(
    () => buildDraft(orders, books, suppliers),
    [orders, books, suppliers]
  );

  const group = {
    ...draft,
    orderType,
    items:
      orderType === "encargos"
        ? draft.lines
        : orderType === "stock"
          ? groupItems({ ...draft, lines: [] }, sel, manual)
          : [],
  };

  const finals = group.items.length ? [group] : [];

  const pendingN = orders.filter(
    (o) => o.status === "pending" && !o.archived
  ).length;

  const suggestedN = draft.lowStock.length;
  const ordersById = Object.fromEntries(orders.map((o) => [o.id, o]));
  const today = new Date().toLocaleDateString("es-AR");

  const copy = async (gs) => {
    try {
      await navigator.clipboard.writeText(draftToText(gs));
      notify("ok", "Lista copiada");
    } catch {
      notify("error", "No pude copiar. Probá con Exportar.");
    }
  };

  const csv = () => {
    const url = URL.createObjectURL(
      new Blob([draftToCsv(finals)], {
        type: "text/csv;charset=utf-8",
      })
    );

    const a = document.createElement("a");
    a.href = url;
    a.download = `pedido-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const place = async (gs) => {
    const ok = await run(
      () => E.placeSupplierOrders(ctx, gs),
      "Pedido registrado"
    );

    if (ok) {
      setSel({});
      setManual([]);
      setManualTitle("");
      setManualBook(null);
      setManualQty(1);
      setOrderType(null);
      setDrafting(false);
    }
  };

  const toggle = (s, on) =>
    setSel((p) => {
      const n = { ...p };

      if (on) n[s.key] = 1;
      else delete n[s.key];

      return n;
    });

  return (
    <>
      <div className="headrow top-gap">
        <h2>Pedido al proveedor</h2>

        <div className="actions">
          {!drafting && (
            <button
              className="btn solid"
              onClick={() => {
                setOrderType(null);
                setDrafting(true);
              }}
            >
              Armar pedido
            </button>
          )}
        </div>
      </div>

      {!drafting ? (
        <div className="empty">
          <p>
            {plural(pendingN, "encargo pendiente", "encargos pendientes")} y{" "}
            {plural(
              suggestedN,
              "libro con stock crítico",
              "libros con stock crítico"
            )}
            .
          </p>

          <p className="muted">
            Armá una lista con reposiciones, encargos de clientes y cualquier
            otro libro que quieras comprar.
          </p>
        </div>
      ) : (
        <>
          {!orderType ? (
            <section className="panel sup">
              <div className="ph">
                <div>
                  <h3>¿Qué tipo de pedido querés armar?</h3>
                  <small>
                    Elegí cómo se van a registrar los libros cuando lleguen.
                  </small>
                </div>
              </div>

              <div className="actions">
                <button
                  className="btn solid"
                  onClick={() => setOrderType("encargos")}
                >
                  Pedido para encargos
                </button>

                <button
                  className="btn solid"
                  onClick={() => setOrderType("stock")}
                >
                  Pedido para stock
                </button>
              </div>
            </section>
          ) : (
            <>
              <div className="toolbar">
                <button
                  className="btn sm"
                  disabled={!finals.length}
                  onClick={() => copy(finals)}
                >
                  Copiar lista
                </button>

                <button
                  className="btn sm"
                  disabled={!finals.length}
                  onClick={csv}
                >
                  Exportar CSV
                </button>

                <button
                  className="btn sm"
                  disabled={!finals.length}
                  onClick={() => window.print()}
                >
                  Exportar PDF
                </button>

                <button
                  className="btn sm solid"
                  disabled={!finals.length}
                  onClick={() => place(finals)}
                >
                  Marcar todo como pedido
                </button>

                <button
                  className="btn sm"
                  onClick={() => {
                    setDrafting(false);
                    setOrderType(null);
                    setSel({});
                    setManual([]);
                    setManualTitle("");
                    setManualBook(null);
                    setManualQty(1);
                  }}
                >
                  Cerrar
                </button>
              </div>

              {orderType === "stock" && draft.lowStock.length > 0 && (
                <section className="panel sup">
                  <div className="ph">
                    <div>
                      <h3>1. Reposición de stock</h3>
                      <small>Libros con pocas unidades disponibles</small>
                    </div>
                  </div>

                  <ul className="plines">
                    {draft.lowStock.map((s) => (
                      <li key={s.key}>
                        <label className="chk">
                          <input
                            type="checkbox"
                            checked={sel[s.key] !== undefined}
                            onChange={(e) => toggle(s, e.target.checked)}
                          />

                          <span>
                            <strong>{s.title}</strong>
                            <small>
                              {s.author} · Stock actual: {s.stock}
                            </small>
                          </span>
                        </label>

                        {sel[s.key] !== undefined && (
                          <input
                            className="qin"
                            type="number"
                            min="1"
                            step="1"
                            value={sel[s.key]}
                            onChange={(e) =>
                              setSel((p) => ({
                                ...p,
                                [s.key]: Math.max(
                                  1,
                                  Number(e.target.value) || 1
                                ),
                              }))
                            }
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {orderType === "encargos" && (
                <section className="panel sup">
                  <div className="ph">
                    <div>
                      <h3>Encargos de clientes</h3>
                      <small>
                        Libros que necesitás para pedidos pendientes
                      </small>
                    </div>
                  </div>

                  {draft.lines.length ? (
                    <ul className="plines">
                      {draft.lines.map((l) => (
                        <li key={l.key}>
                          <div>
                            <strong>{l.title}</strong>
                            <small>
                              {l.author} ·{" "}
                              {plural(l.customers, "cliente", "clientes")}
                            </small>
                          </div>

                          <span className="qty">× {l.qty}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">No hay encargos pendientes.</p>
                  )}
                </section>
              )}

              {orderType === "stock" && (
                <section className="panel sup">
                  <div className="ph">
                    <div>
                      <h3>Otros libros</h3>
                      <small>
                        Agregá cualquier título que quieras comprar para el
                        stock
                      </small>
                    </div>
                  </div>

                  <div className="fields">
                    <TitleSearch
                      value={manualTitle}
                      onChange={(v) => {
                        setManualTitle(v);
                        setManualBook(null);
                      }}
                      onPick={(b) => {
                        setManualTitle(b.title);
                        setManualBook(b);
                      }}
                    />

                    <label>
                      Cantidad
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={manualQty}
                        onChange={(e) =>
                          setManualQty(
                            Math.max(1, Number(e.target.value) || 1)
                          )
                        }
                      />
                    </label>
                  </div>

                  <div className="actions">
                    <button
                      className="btn solid"
                      type="button"
                      disabled={!manualTitle.trim()}
                      onClick={addManual}
                    >
                      + Agregar al pedido
                    </button>
                  </div>

                  {manual.length > 0 && (
                    <ul className="plines">
                      {manual.map((l) => (
                        <li key={l.key}>
                          <div>
                            <strong>{l.title}</strong>
                            <small>
                              {l.author || "Autor no especificado"}
                            </small>
                          </div>

                          <input
                            className="qin"
                            type="number"
                            min="1"
                            step="1"
                            value={l.qty}
                            onChange={(e) =>
                              setManual((p) =>
                                p.map((x) =>
                                  x.key === l.key
                                    ? {
                                        ...x,
                                        qty: Math.max(
                                          1,
                                          Number(e.target.value) || 1
                                        ),
                                      }
                                    : x
                                )
                              )
                            }
                          />

                          <button
                            className="btn sm"
                            type="button"
                            onClick={() => removeManual(l.key)}
                          >
                            Quitar
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              <div className="print-only">
                <h2>Pedido del {today}</h2>

                {finals.map((g) => (
                  <div key={g.id || "none"}>
                    <h3>
                      {g.supplier?.name || NO_SUPPLIER}
                      {g.supplier?.contact
                        ? ` (${g.supplier.contact})`
                        : ""}
                    </h3>

                    <ul>
                      {g.items.map((l) => (
                        <li key={l.key}>
                          {l.qty} × {l.title}
                          {l.author ? ` (${l.author})` : ""}
                          {l.isbn ? `, ISBN ${l.isbn}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div className="headrow top-gap">
        <h2>
          Pedidos enviados{" "}
          <span className="count">{supplierOrders.length}</span>
        </h2>
      </div>

      {supplierOrders.length ? (
        <ul className="orders">
          {supplierOrders.map((so) => {
            const units = so.lines.reduce((a, l) => a + l.qty, 0);

            return (
              <li key={so.id} className="order sent">
                <div>
                  <div className="o-top">
                    <strong>{so.supplierName}</strong>

                    <span
                      className={
                        "chip " +
                        (so.status === "received" ? "received" : "ordered")
                      }
                    >
                      {so.status === "received" ? "Recibido" : "Pedido"}
                    </span>
                  </div>

                  <small className="muted">
                    Pedido el {fmtDate(so.orderedAt) || "…"}
                    {so.receivedAt
                      ? ` · recibido el ${fmtDate(so.receivedAt)}`
                      : ""}
                  </small>
                </div>

                <div>
                  <strong>
                    {plural(units, "unidad", "unidades")} en{" "}
                    {plural(so.lines.length, "título", "títulos")}
                  </strong>

                  <small className="muted">
                    {so.lines.map((l) => l.title).join(", ")}
                  </small>
                </div>

                <div className="actions end">
                  {(so.status === "ordered" || so.status === "partially_received") && (
                    <button
                      className="btn sm solid"
                      onClick={() => setReceiving(so)}
                    >
                      Registrar recepción
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="empty">
          <p className="muted">Todavía no enviaste pedidos.</p>
        </div>
      )}

      <Modal
        open={!!receiving}
        onClose={() => setReceiving(null)}
        label="Registrar recepción"
      >
        {receiving && (
          <Recepcion
            so={receiving}
            onCancel={() => setReceiving(null)}
            onConfirm={async (arr) => {
              const ok = await run(
                () =>
                  E.receiveSupplierOrder(
                    ctx,
                    receiving,
                    arr,
                    ordersById,
                    books
                  ),
                "Recepción registrada"
              );

              if (ok) setReceiving(null);
            }}
          />
        )}
      </Modal>
    </>
  );
}
