import { useEffect, useRef, useState } from "react";
import {
  collection, doc, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc,
  writeBatch, increment, serverTimestamp,
} from "firebase/firestore";
import { db, ensureUser } from "./firebase";
import { flatten } from "./lib/sales";
import Modal from "./components/Modal";
import Cover from "./components/Cover";
import BookForm from "./components/BookForm";
import BookDetail from "./components/BookDetail";
import Cart from "./components/Cart";
import Dashboard from "./components/Dashboard";

const SORTS = ["Alfabético", "Género (A-Z)", "Año publicación", "Autor (A-Z)", "Más vendidos", "Menor stock"];
const money = (n) => "$" + n.toLocaleString("es-AR");
const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

export default function App() {
  const [uid, setUid] = useState(null);
  const [books, setBooks] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [fatal, setFatal] = useState(null);
  const [editing, setEditing] = useState(null); // null | "new" | libro
  const [selected, setSelected] = useState(null); // id del libro abierto
  const [sort, setSort] = useState(SORTS[0]);
  const [view, setView] = useState("stock");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState({}); // { idLibro: cantidad }
  const [cartOpen, setCartOpen] = useState(false);
  const toastRef = useRef(null);

  const notify = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // El aviso usa popover para mostrarse por encima de las ventanas modales.
  useEffect(() => {
    const el = toastRef.current;
    if (!el) return;
    try { toast ? el.showPopover() : el.hidePopover(); } catch { /* ya estaba en ese estado */ }
  }, [toast]);

  useEffect(() => {
    ensureUser()
      .then((u) => setUid(u.uid))
      .catch((e) => { console.error(e); setLoading(false); setFatal(e.code || e.message); });
  }, []);

  // Consulta en tiempo real: cualquier cambio en Firestore actualiza la pantalla.
  useEffect(() => {
    if (!uid) return;
    const onErr = () => { setLoading(false); notify("error", "No se pudieron leer los datos. Revisá las reglas de Firestore."); };
    const u1 = onSnapshot(query(collection(db, "users", uid, "books"), orderBy("title")),
      (s) => { setBooks(s.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); }, onErr);
    const u2 = onSnapshot(query(collection(db, "users", uid, "sales"), orderBy("date", "desc")),
      (s) => setSales(s.docs.map((d) => ({ id: d.id, ...d.data() }))), onErr);
    return () => { u1(); u2(); };
  }, [uid]);

  const run = async (fn, okMsg) => {
    try { await fn(); notify("ok", okMsg); return true; }
    catch (e) { console.error(e); notify("error", "No se pudo guardar el cambio (" + (e.code || e.message) + ")"); return false; }
  };
  const bookRef = (id) => doc(db, "users", uid, "books", id);

  const saveBook = async (data) => {
    const isNew = editing === "new";
    const ok = await run(
      () => isNew ? addDoc(collection(db, "users", uid, "books"), { ...data, createdAt: serverTimestamp() })
                  : updateDoc(bookRef(editing.id), data),
      isNew ? "Libro agregado" : "Libro actualizado");
    if (ok) setEditing(null);
  };

  const removeBook = (b) => {
    if (!window.confirm(`¿Eliminar "${b.title}"?`)) return;
    setSelected(null);
    setCart((c) => { const n = { ...c }; delete n[b.id]; return n; });
    run(() => deleteDoc(bookRef(b.id)), "Libro eliminado");
  };

  // Carrito: se arma la venta con varios libros y recién se guarda al confirmar.
  const lines = Object.entries(cart)
    .map(([id, qty]) => ({ book: books.find((b) => b.id === id), qty }))
    .map((l) => (l.book ? { ...l, qty: Math.min(l.qty, l.book.stock) } : l))
    .filter((l) => l.book && l.qty > 0);
  const cartUnits = lines.reduce((a, l) => a + l.qty, 0);
  const cartTotal = lines.reduce((a, l) => a + l.qty * l.book.price, 0);

  useEffect(() => { if (!lines.length) setCartOpen(false); }, [lines.length]);

  const addToCart = (b, n) => {
    setCart((c) => ({ ...c, [b.id]: Math.min((c[b.id] || 0) + n, b.stock) }));
    setSelected(null);
    notify("ok", "Agregado a la venta");
  };
  const setQty = (b, n) => setCart((c) => ({ ...c, [b.id]: Math.max(1, Math.min(b.stock, n || 1)) }));
  const removeLine = (id) => setCart((c) => { const n = { ...c }; delete n[id]; return n; });

  // Un ticket = un documento con todos los libros, y el stock de cada uno se descuenta en la misma operación atómica.
  const checkout = async (ageRange) => {
    const ok = await run(async () => {
      const items = lines.map(({ book, qty }) => ({
        bookId: book.id, title: book.title, genre: book.genre, language: book.language, price: book.price, qty,
      }));
      const batch = writeBatch(db);
      lines.forEach(({ book, qty }) => batch.update(bookRef(book.id), { stock: increment(-qty) }));
      batch.set(doc(collection(db, "users", uid, "sales")),
        { items, total: cartTotal, units: cartUnits, ageRange, date: serverTimestamp() });
      await batch.commit();
    }, "Venta registrada");
    if (ok) { setCart({}); setCartOpen(false); }
  };

  const sold = {}, rev = {};
  flatten(sales).forEach((x) => {
    sold[x.bookId] = (sold[x.bookId] || 0) + x.qty;
    rev[x.bookId] = (rev[x.bookId] || 0) + x.amount;
  });

  const cmp = {
    "Alfabético": (a, b) => a.title.localeCompare(b.title),
    "Género (A-Z)": (a, b) => a.genre.localeCompare(b.genre) || a.title.localeCompare(b.title),
    "Año publicación": (a, b) => (b.year ?? -1) - (a.year ?? -1),
    "Autor (A-Z)": (a, b) => a.author.localeCompare(b.author),
    "Más vendidos": (a, b) => (sold[b.id] || 0) - (sold[a.id] || 0),
    "Menor stock": (a, b) => a.stock - b.stock,
  }[sort];
  const needle = q.trim().toLowerCase();
  const shown = books
    .filter((b) => !needle || (b.title + " " + b.author + " " + b.genre).toLowerCase().includes(needle))
    .sort(cmp);
  const selBook = books.find((b) => b.id === selected);

  if (fatal) return (
    <div className="app">
      <h1>Book Stack</h1>
      <p>No se pudo iniciar la sesión ({fatal}). Revisá que el acceso Anónimo esté habilitado en Authentication y que el .env tenga los valores correctos.</p>
    </div>
  );

  return (
    <div className="app">
      <header className="top">
        <h1>Book Stack</h1>
        <nav>
          <button className={"pill" + (view === "stock" ? " on" : "")} onClick={() => setView("stock")}>
            <Icon><path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" /><path d="M3 8l9 5 9-5M12 13v8" /></Icon>Stock
          </button>
          <button className={"pill" + (view === "panel" ? " on" : "")} onClick={() => setView("panel")}>
            <Icon><path d="M3 12l4 4 5-9 4 7 5-6" /></Icon>Estadísticas
          </button>
        </nav>
      </header>

      {loading && <p className="muted">Cargando tu librería…</p>}
      {!loading && view === "panel" && <Dashboard books={books} sales={sales} />}
      {!loading && view === "stock" && (
        <>
          <div className="searchbar">
            <Icon><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></Icon>
            <input className="search" type="search" aria-label="Buscar en stock" placeholder="Buscar en stock"
              value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="sorts" role="group" aria-label="Ordenar por">
            {SORTS.map((s) => (
              <button key={s} aria-pressed={sort === s} className={"sort" + (sort === s ? " on" : "")} onClick={() => setSort(s)}>{s}</button>
            ))}
          </div>
          <div className="headrow">
            <h2>Libros disponibles</h2>
            <button className="btn solid" onClick={() => setEditing("new")}>Agregar libro</button>
          </div>
          {shown.length ? (
            <ul className="books">
              {shown.map((b) => (
                <li key={b.id}>
                  <button className="card" onClick={() => setSelected(b.id)}
                    aria-label={`${b.title}, ${b.author}. ${b.stock} en stock`}>
                    <Cover book={b} />
                    <span className={"badge" + (b.stock <= 2 ? " low" : "")}>{b.stock === 0 ? "Sin stock" : b.stock}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{books.length ? "No hay libros que coincidan." : "Tu estante está vacío. Agregá el primer libro."}</p>
          )}
        </>
      )}

      {lines.length > 0 && (
        <div className="dock">
          <span>{cartUnits} {cartUnits === 1 ? "libro" : "libros"}, {money(cartTotal)}</span>
          <button className="btn solid" onClick={() => setCartOpen(true)}>Revisar venta</button>
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} label="Libro">
        {editing && (
          <>
            <h2 className="mh">{editing === "new" ? "Agregar libro" : "Editar libro"}</h2>
            <BookForm key={editing === "new" ? "new" : editing.id} initial={editing === "new" ? null : editing}
              onSubmit={saveBook} onCancel={() => setEditing(null)} />
          </>
        )}
      </Modal>
      <Modal open={!!selBook} onClose={() => setSelected(null)} label="Detalle del libro">
        {selBook && (
          <BookDetail book={selBook} sold={sold[selBook.id] || 0} revenue={rev[selBook.id] || 0} inCart={cart[selBook.id] || 0}
            onAdd={(n) => addToCart(selBook, n)} onEdit={() => { setEditing(selBook); setSelected(null); }}
            onDelete={() => removeBook(selBook)} onClose={() => setSelected(null)} />
        )}
      </Modal>
      <Modal open={cartOpen && lines.length > 0} onClose={() => setCartOpen(false)} label="Venta en curso">
        <Cart lines={lines} onQty={setQty} onRemove={removeLine} onClear={() => setCart({})} onConfirm={checkout} />
      </Modal>

      <div ref={toastRef} popover="manual" className={"toast " + (toast?.type || "")} role="status">{toast?.msg}</div>
    </div>
  );
}
