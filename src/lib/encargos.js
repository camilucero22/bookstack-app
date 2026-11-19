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

// Organiza el pedido en tres grupos:
// stock crítico, encargos y libros agregados manualmente.
export function buildDraft(orders, books, suppliers) {
  const bookById = Object.fromEntries(books.map((b) => [b.id, b]));
  const groups = {
    id: "general",
    supplier: null,
    lowStock: [],
    lines: [],
    suggestions: [],
  };

  const lines = {};

  // 1. ENCARGOS: agrupa libros pedidos por clientes.
  orders
    .filter((o) => o.status === "pending" && !o.archived)
    .forEach((o) => {
      const key = o.bookId || "t:" + norm(o.title) + "|" + norm(o.author);

      let l = lines[key];

      if (!l) {
        l = lines[key] = {
          key: "e|" + key,
          kind: "encargo",
          bookId: o.bookId || null,
          title: o.title,
          author: o.author || "",
          isbn: o.isbn || "",
          qty: 0,
          who: new Set(),
          orderIds: [],
        };
        groups.lines.push(l);
      }

      l.qty += Number(o.qty || 0);
      l.isbn ||= o.isbn || "";
      l.who.add(o.customerPhone || o.customerName || o.id);
      l.orderIds.push(o.id);
    });

  // Identifica libros que ya están incluidos en encargos.
  const orderedBookIds = new Set(
    Object.values(lines).map((l) => l.bookId).filter(Boolean)
  );

  // 2. STOCK CRÍTICO: libros que necesitan reposición.
  books
    .filter((b) => Number(b.stock) <= 2 && !orderedBookIds.has(b.id))
    .forEach((b) => {
      groups.lowStock.push({
        key: "s|" + b.id,
        kind: "reposicion",
        bookId: b.id,
        title: b.title,
        author: b.author || "",
        isbn: b.isbn || "",
        stock: Number(b.stock || 0),
        qty: 1,
        orderIds: [],
      });
    });

  groups.lines = groups.lines
    .map((l) => ({ ...l, customers: l.who.size }))
    .sort((a, b) => a.title.localeCompare(b.title));

  groups.lowStock.sort(
    (a, b) => a.stock - b.stock || a.title.localeCompare(b.title)
  );

  return groups;
}

// Construye la lista final que se enviará al proveedor.
export const groupItems = (g, sel = {}, manual = []) => [
  ...g.lowStock
    .filter((s) => sel[s.key] !== undefined && Number(sel[s.key]) > 0)
    .map((s) => ({
      ...s,
      qty: Number(sel[s.key]),
      customers: 0,
    })),

  ...g.lines,

  ...manual.map((s) => ({
    ...s,
    qty: Number(s.qty),
    customers: 0,
    orderIds: s.orderIds || [],
  })),
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
    l.kind === "encargo"
      ? "Encargo"
      : l.kind === "manual"
        ? "Manual"
        : "Reposición",
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
