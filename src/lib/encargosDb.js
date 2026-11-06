import { collection, doc, addDoc, updateDoc, deleteDoc, writeBatch, increment, serverTimestamp } from "firebase/firestore";
import { ACTIVE, allocateReception, norm } from "./encargos";

// ctx = { db, uid }
const col = (c, name) => collection(c.db, "users", c.uid, name);
const ref = (c, name, id) => doc(c.db, "users", c.uid, name, id);

/* Encargos */
export const createOrder = (c, data) => addDoc(col(c, "customerOrders"), {
  ...data, status: "pending", archived: false, createdAt: serverTimestamp(),
  orderedAt: null, receivedAt: null, deliveredAt: null, cancelledAt: null, notifiedAt: null,
  supplierOrderId: null, salePrice: null, saleId: null,
});
export const updateOrder = (c, id, data) => updateDoc(ref(c, "customerOrders", id), data);
export const removeOrder = (c, id) => deleteDoc(ref(c, "customerOrders", id));
export const markNotified = (c, id) => updateOrder(c, id, { notifiedAt: serverTimestamp() });

const STAMP = { ordered: "orderedAt", received: "receivedAt", delivered: "deliveredAt", cancelled: "cancelledAt" };
export const setStatus = (c, id, status) => updateOrder(c, id, STAMP[status]
  ? { status, [STAMP[status]]: serverTimestamp() }
  : { status, orderedAt: null, supplierOrderId: null }); // "pending": vuelve al principio

// Entregar = registrar la venta. No toca el stock: esas unidades nunca estuvieron disponibles.
export async function deliver(c, o, price, ageRange) {
  const batch = writeBatch(c.db);
  const sale = doc(col(c, "sales"));
  batch.set(sale, {
    items: [{ bookId: o.bookId || null, title: o.title, genre: o.genre, language: o.language, price, qty: o.qty }],
    total: price * o.qty, units: o.qty, ageRange, date: serverTimestamp(),
    source: "encargo", customerOrderId: o.id, deposit: o.deposit || 0,
  });
  batch.update(ref(c, "customerOrders", o.id), { status: "delivered", deliveredAt: serverTimestamp(), salePrice: price, saleId: sale.id });
  await batch.commit();
}

// Si estaba recibido, las unidades reservadas pueden volver al stock disponible.
export async function cancelOrder(c, o, restock) {
  const batch = writeBatch(c.db);
  batch.update(ref(c, "customerOrders", o.id), { status: "cancelled", cancelledAt: serverTimestamp() });
  if (restock && o.status === "received" && o.bookId) batch.update(ref(c, "books", o.bookId), { stock: increment(o.qty) });
  await batch.commit();
}

/* Pedidos al proveedor */
// groups: [{ id, supplier, items }]. Crea un pedido por proveedor y pasa sus encargos a "Pedido".
export async function placeSupplierOrders(c, groups) {
  const batch = writeBatch(c.db);
  groups.forEach((g) => {
    const so = doc(col(c, "supplierOrders"));
    batch.set(so, {
      supplierId: g.id, supplierName: g.supplier?.name || "Sin proveedor asignado",
      status: "ordered", orderedAt: serverTimestamp(), receivedAt: null,
      lines: g.items.map((l) => ({
        bookId: l.bookId || null, title: l.title, author: l.author || "", isbn: l.isbn || "",
        kind: l.kind, qty: l.qty, customers: l.customers || 0, orderIds: l.orderIds, receivedQty: 0,
      })),
    });
    g.items.forEach((l) => l.orderIds.forEach((id) =>
      batch.update(ref(c, "customerOrders", id), { status: "ordered", orderedAt: serverTimestamp(), supplierOrderId: so.id })));
  });
  await batch.commit();
}

// received: unidades que llegaron por línea. Cubren encargos (los más viejos primero) y el resto suma al stock.
export async function receiveSupplierOrder(c, so, received, ordersById, books) {
  const batch = writeBatch(c.db);
  const exists = new Set(books.map((b) => b.id));
  let covered = 0;
  const lines = so.lines.map((l, i) => {
    const r = allocateReception(l, received[i], ordersById);
    r.covered.forEach((id) => batch.update(ref(c, "customerOrders", id), { status: "received", receivedAt: serverTimestamp() }));
    if (r.surplus > 0 && l.bookId && exists.has(l.bookId)) batch.update(ref(c, "books", l.bookId), { stock: increment(r.surplus) });
    covered += r.covered.length;
    return { ...l, receivedQty: received[i] };
  });
  batch.update(ref(c, "supplierOrders", so.id), { status: "received", receivedAt: serverTimestamp(), lines });
  await batch.commit();
  return covered;
}

// Un libro encargado que no estaba en el catálogo: se crea y se vincula a sus encargos activos.
export async function addBookFromOrder(c, data, o, all) {
  const batch = writeBatch(c.db);
  const book = doc(col(c, "books"));
  batch.set(book, { ...data, createdAt: serverTimestamp() });
  all.filter((x) => !x.bookId && ACTIVE.includes(x.status) && norm(x.title) === norm(o.title) && norm(x.author) === norm(o.author))
    .forEach((x) => batch.update(ref(c, "customerOrders", x.id), { bookId: book.id }));
  await batch.commit();
}

/* Proveedores */
export const saveSupplier = (c, id, data) => id
  ? updateDoc(ref(c, "suppliers", id), data)
  : addDoc(col(c, "suppliers"), { ...data, createdAt: serverTimestamp() });
export const removeSupplier = (c, id) => deleteDoc(ref(c, "suppliers", id));
