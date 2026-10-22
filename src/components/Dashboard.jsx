import { useMemo } from "react";
import { flatten } from "../lib/sales";

const money = (n) => "$" + Math.round(n).toLocaleString("es-AR");

function Bars({ title, rows }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <section className="stat">
      <h3>{title}</h3>
      {rows.length ? rows.map(([k, v]) => (
        <div className="row" key={k}>
          <span>{k}</span><i style={{ width: (v / max) * 100 + "%" }} /><b>{v}</b>
        </div>
      )) : <p className="muted">Todavía no hay ventas.</p>}
    </section>
  );
}

export default function Dashboard({ books, sales }) {
  const s = useMemo(() => {
    const lines = flatten(sales);
    const by = (key) => {
      const m = {};
      lines.forEach((x) => { const k = x[key] || "Sin dato"; m[k] = (m[k] || 0) + x.qty; });
      return Object.entries(m).sort((a, b) => b[1] - a[1]);
    };
    const revenue = sales.reduce((a, x) => a + (x.total || 0), 0);
    return {
      revenue, avg: sales.length ? revenue / sales.length : 0,
      units: lines.reduce((a, x) => a + x.qty, 0),
      stockValue: books.reduce((a, b) => a + b.price * b.stock, 0),
      titles: by("title").slice(0, 5), genres: by("genre"), ages: by("ageRange"), langs: by("language"),
      low: books.filter((b) => b.stock <= 2),
    };
  }, [books, sales]);

  return (
    <>
      <section className="hero">
        <div><p className="muted">Ingresos</p><p className="big">{money(s.revenue)}</p></div>
        <div><p className="muted">Ticket promedio</p><p className="big">{money(s.avg)}</p></div>
        <div><p className="muted">Unidades vendidas</p><p className="big">{s.units}</p></div>
        <div><p className="muted">Valor del stock</p><p className="big">{money(s.stockValue)}</p></div>
      </section>
      <div className="grid">
        <Bars title="Más vendidos" rows={s.titles} />
        <Bars title="Ventas por género" rows={s.genres} />
        <Bars title="Ventas por edad del comprador" rows={s.ages} />
        <Bars title="Ventas por idioma" rows={s.langs} />
        <section className="stat">
          <h3>Para reponer</h3>
          {s.low.length ? s.low.map((b) => (
            <div className="row restock" key={b.id}><span>{b.title}</span><b>{b.stock}</b></div>
          )) : <p className="muted">Ningún libro con 2 unidades o menos.</p>}
        </section>
      </div>
    </>
  );
}
