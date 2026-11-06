export const STATUS = {
  pending: { label: "Pendiente" },
  ordered: { label: "Pedido" },
  received: { label: "Recibido" },
  delivered: { label: "Entregado" },
  cancelled: { label: "Cancelado" },
};
export const ACTIVE = ["pending", "ordered", "received"];
export const NO_SUPPLIER = "Sin proveedor asignado";

export const money = (n) => "$" + Math.round(n || 0).toLocaleString("es-AR");
export const norm = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
export const digits = (s) => (s || "").replace(/\D/g, "");
export const millis = (t) => t?.toMillis?.() ?? 0;
export const fmtDate = (t) => { const d = t?.toDate?.(); return d ? d.toLocaleDateString("es-AR") : ""; };

// Un libro se identifica por su id; si no está en el catálogo, por título + autor.
const bookKey = (o) => o.bookId || "t:" + norm(o.title) + "|" + norm(o.author);

// ¿Ya hay un encargo activo del mismo cliente para el mismo libro?
export function findDuplicate(orders, c, ignoreId) {
  const phone = digits(c.customerPhone);
  return orders.find((o) => o.id !== ignoreId && !o.archived && ACTIVE.includes(o.status) && bookKey(o) === bookKey(c)
    && ((phone.length >= 8 && digits(o.customerPhone) === phone) || norm(o.customerName) === norm(c.customerName)));
}

// Junta los encargos pendientes por proveedor y por libro (sumando cantidades),
// y agrega como sugerencias los libros con stock crítico que no estén ya en la lista.
export function buildDraft(orders, books, suppliers) {
  const bookById = Object.fromEntries(books.map((b) => [b.id, b]));
  const supById = Object.fromEntries(suppliers.map((s) => [s.id, s]));
  const groups = {};
  const group = (sid) => {
    const k = supById[sid] ? sid : "none";
    return (groups[k] ||= { id: k === "none" ? null : k, supplier: supById[k] || null, lines: [], suggestions: [] });
  };
  const lines = {};
  orders.filter((o) => o.status === "pending" && !o.archived).forEach((o) => {
    const g = group(o.supplierId || bookById[o.bookId]?.supplierId);
    const key = g.id + "|" + bookKey(o);
    let l = lines[key];
    if (!l) {
      l = lines[key] = { key, kind: "encargo", bookId: o.bookId || null, title: o.title, author: o.author || "", isbn: "", qty: 0, who: new Set(), orderIds: [] };
      g.lines.push(l);
    }
    l.isbn ||= o.isbn || "";
    l.qty += o.qty;
    l.who.add(digits(o.customerPhone) || norm(o.customerName));
    l.orderIds.push(o.id);
  });
  const inList = new Set(Object.values(lines).map((l) => l.bookId).filter(Boolean));
  books.filter((b) => b.stock <= 2 && !inList.has(b.id)).forEach((b) => {
    group(b.supplierId).suggestions.push({ key: "s|" + b.id, kind: "reposicion", bookId: b.id, title: b.title, author: b.author || "", isbn: "", stock: b.stock, orderIds: [] });
  });
  return Object.values(groups)
    .map((g) => ({
      ...g,
      lines: g.lines.map((l) => ({ ...l, customers: l.who.size })).sort((a, b) => a.title.localeCompare(b.title)),
      suggestions: g.suggestions.sort((a, b) => a.stock - b.stock || a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => (a.supplier ? 0 : 1) - (b.supplier ? 0 : 1) || (a.supplier?.name || "").localeCompare(b.supplier?.name || ""));
}

// sel = { [claveDeSugerencia]: cantidad } con las sugerencias que se decidió sumar.
export const groupItems = (g, sel) => [
  ...g.lines,
  ...g.suggestions.filter((s) => sel[s.key]).map((s) => ({ ...s, qty: sel[s.key], customers: 0 })),
];

export function draftToText(groups, date = new Date()) {
  const body = groups.map((g) => "\n" + (g.supplier?.name || NO_SUPPLIER) + "\n" + g.items.map((l) =>
    `- ${l.qty} × ${l.title}${l.author ? " (" + l.author + ")" : ""}${l.isbn ? " · ISBN " + l.isbn : ""}`).join("\n"));
  return ["Pedido del " + date.toLocaleDateString("es-AR"), ...body].join("\n");
}

// Separado por ; y con BOM para que Excel lo abra bien en español.
export function draftToCsv(groups) {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["Proveedor", "Título", "Autor", "ISBN", "Cantidad", "Clientes", "Tipo"]];
  groups.forEach((g) => g.items.forEach((l) => rows.push([
    g.supplier?.name || NO_SUPPLIER, l.title, l.author, l.isbn, l.qty,
    l.kind === "encargo" ? l.customers : "", l.kind === "encargo" ? "Encargo" : "Reposición",
  ])));
  return "\uFEFF" + rows.map((r) => r.map(q).join(";")).join("\r\n");
}

// Primero se cubren los encargos más viejos; lo que sobra es reposición para el stock.
export function allocateReception(line, received, ordersById) {
  const list = (line.orderIds || []).map((id) => ordersById[id]).filter((o) => o && o.status === "ordered")
    .sort((a, b) => millis(a.createdAt) - millis(b.createdAt));
  let left = received;
  const covered = [];
  for (const o of list) if (o.qty <= left) { covered.push(o.id); left -= o.qty; }
  return { covered, surplus: left };
}

// Número para wa.me: sin 0 inicial y con el 549 de Argentina si no lo trae.
export function waNumber(phone) {
  const d = digits(phone).replace(/^0+/, "");
  return d.startsWith("54") ? d : "549" + d;
}
export const waLink = (phone, text) => `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`;

export function waMessage(o, book) {
  const first = (o.customerName || "").trim().split(" ")[0];
  let t = `¡Hola${first ? ", " + first : ""}! Ya llegó tu encargo: «${o.title}»${o.qty > 1 ? ` (${o.qty} unidades)` : ""}. Podés pasar a retirarlo cuando quieras.`;
  if (o.deposit > 0) t += ` Dejaste una seña de ${money(o.deposit)}` + (book?.price ? ` y el saldo es ${money(Math.max(0, book.price * o.qty - o.deposit))}.` : ".");
  return t;
}
