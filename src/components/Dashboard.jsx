import { useMemo } from "react";
import { flatten } from "../lib/sales";
import Cover from "./Cover";

const money = (n) => "$" + Math.round(n).toLocaleString("es-AR");
const pct = (v, total) => Math.round((v / total) * 100);

const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

// Misma paleta para la dona, la barra de idiomas y las referencias.
const PALETTE = [
  { bg: "var(--indigo)", fg: "#fff" },
  { bg: "var(--lime)", fg: "var(--ink)" },
  { bg: "var(--ink)", fg: "#fff" },
  { bg: "var(--lav)", fg: "var(--ink)" },
  { bg: "var(--coral)", fg: "#fff" },
  { bg: "#6B63E0", fg: "#fff" },
];
const color = (i) => PALETTE[i % PALETTE.length];

const Empty = () => <p className="muted">Todavía no hay ventas.</p>;

function Legend({ rows, total }) {
  return (
    <ul className="legend">
      {rows.map(([k, v], i) => (
        <li key={k}><i style={{ background: color(i).bg }} /><span>{k}</span><b>{v} · {pct(v, total)}%</b></li>
      ))}
    </ul>
  );
}

function Donut({ rows, total, label }) {
  const R = 80, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <svg className="donut" viewBox="0 0 200 200" role="img" aria-label={label}>
      <g transform="rotate(-90 100 100)" fill="none" strokeWidth="30">
        {rows.map(([k, v], i) => {
          const len = (v / total) * C;
          const el = <circle key={k} cx="100" cy="100" r={R} stroke={color(i).bg} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} />;
          acc += len;
          return el;
        })}
      </g>
    </svg>
  );
}

export default function Dashboard({ books, sales, onRestock }) {
  const s = useMemo(() => {
    const lines = flatten(sales);
    const by = (key) => {
      const m = {};
      lines.forEach((x) => { const k = x[key] || "Sin dato"; m[k] = (m[k] || 0) + x.qty; });
      return Object.entries(m).sort((a, b) => b[1] - a[1]);
    };
    // Más vendidos por libro (con la tapa, si el libro todavía existe).
    const t = {};
    lines.forEach((x) => {
      const r = (t[x.bookId] ||= { id: x.bookId, title: x.title, genre: x.genre, qty: 0 });
      r.qty += x.qty;
    });
    const titles = Object.values(t).sort((a, b) => b.qty - a.qty).slice(0, 5)
      .map((r) => ({ ...r, book: books.find((b) => b.id === r.id) || { title: r.title, author: "", genre: r.genre } }));
    const revenue = sales.reduce((a, x) => a + (x.total || 0), 0);
    const units = lines.reduce((a, x) => a + x.qty, 0);
    return {
      revenue, units, avg: sales.length ? revenue / sales.length : 0,
      stockValue: books.reduce((a, b) => a + b.price * b.stock, 0),
      titles, genres: by("genre"), ages: by("ageRange"), langs: by("language"),
      low: books.filter((b) => b.stock <= 2).sort((a, b) => a.stock - b.stock || a.title.localeCompare(b.title)),
    };
  }, [books, sales]);

  const podium = s.titles.slice(0, 3), rest = s.titles.slice(3);
  const maxAge = Math.max(1, ...s.ages.map((r) => r[1]));
  const lowShown = s.low.slice(0, 6);

  return (
    <>
      <section className="hero" aria-label="Resumen de ventas">
        <div className="hcard main">
          <div className="hhead">
            <span className="hlabel"><span className="coin" aria-hidden="true">$</span>Ingresos</span>
            <span className="hpill">Total acumulado</span>
          </div>
          <div>
            <p className="hval">{money(s.revenue)}</p>
            <p className="hcap">por {s.units} {s.units === 1 ? "unidad vendida" : "unidades vendidas"}</p>
          </div>
        </div>
        <div className="hcard">
          <span className="hlabel"><Icon><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" /><path d="M9 8h6M9 12h6" /></Icon>Ticket promedio</span>
          <div><p className="hval">{money(s.avg)}</p><p className="hcap">Por venta</p></div>
        </div>
        <div className="hcard">
          <span className="hlabel"><Icon><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></Icon>Unidades vendidas</span>
          <div><p className="hval">{s.units}</p><p className="hcap">En {sales.length} {sales.length === 1 ? "venta" : "ventas"}</p></div>
        </div>
        <div className="hcard dark">
          <span className="hlabel"><Icon><path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" /><path d="M3 8l9 5 9-5M12 13v8" /></Icon>Valor del stock</span>
          <div><p className="hval">{money(s.stockValue)}</p><p className="hcap">Al precio de venta</p></div>
        </div>
      </section>

      <div className="dash">
        <section className="panel c5 f">
          <div className="ph"><h3>Más vendidos</h3><small>Unidades</small></div>
          {podium.length ? (
            <>
              <ol className="podium">
                {podium.map((r, i) => (
                  <li key={r.id}>
                    <span className={"rank" + (i === 0 ? " first" : "")}>{i + 1}</span>
                    <Cover book={r.book} />
                    <strong>{r.title}</strong>
                    <small>{r.qty} {r.qty === 1 ? "vendido" : "vendidos"}</small>
                  </li>
                ))}
              </ol>
              {rest.length > 0 && (
                <ol className="rest" start={4}>
                  {rest.map((r, i) => (
                    <li key={r.id}><span className="n">{i + 4}</span><span className="t">{r.title}</span><b>{r.qty}</b></li>
                  ))}
                </ol>
              )}
            </>
          ) : <Empty />}
        </section>

        <section className="panel c3">
          <div className="ph"><h3>Ventas por género</h3></div>
          {s.units ? (
            <>
              <Donut rows={s.genres} total={s.units} label="Ventas por género" />
              <Legend rows={s.genres} total={s.units} />
              <p className="dtotal">{s.units}<small>unidades</small></p>
            </>
          ) : <Empty />}
        </section>

        <section className="panel c4">
          <div className="ph"><h3>Ventas por edad del comprador</h3></div>
          {s.units ? (
            <div className="cols" style={{ "--n": s.ages.length }}>
              {s.ages.map(([k, v], i) => (
                <div className="col" key={k}>
                  <div className="bw">
                    <b>{v}</b>
                    <i className={i === 0 ? "top" : ""} style={{ height: (v / maxAge) * 140 + "px" }} />
                  </div>
                  <span>{k}</span>
                </div>
              ))}
            </div>
          ) : <Empty />}
        </section>

        <section className="panel c4 f">
          <div className="ph"><h3>Ventas por idioma</h3></div>
          {s.units ? (
            <>
              <div className="stack" role="img" aria-label="Ventas por idioma">
                {s.langs.map(([k, v], i) => (
                  <span key={k} title={`${k}: ${v}`} style={{ flex: v, background: color(i).bg, color: color(i).fg }}>
                    {pct(v, s.units) >= 15 ? pct(v, s.units) + "%" : ""}
                  </span>
                ))}
              </div>
              <Legend rows={s.langs} total={s.units} />
            </>
          ) : <Empty />}
        </section>

        <section className="panel c8 f">
          <div className="ph">
            <h3>Para reponer</h3>
            {s.low.length > 0 && (
              <span className="pillwarn">{s.low.length} {s.low.length === 1 ? "título con stock crítico" : "títulos con stock crítico"}</span>
            )}
          </div>
          {lowShown.length ? (
            <ul className="restock">
              {lowShown.map((b) => (
                <li key={b.id}>
                  <span className="wi"><Icon><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5M12 18h.01" /></Icon></span>
                  <div><strong>{b.title}</strong><small>{b.author}</small></div>
                  <span className="meter" aria-hidden="true"><i style={{ width: Math.min(100, b.stock * 10) + "%" }} /></span>
                  <b>{b.stock} {b.stock === 1 ? "ud." : "uds."}</b>
                  <button className="btn solid" onClick={() => onRestock?.(b)} aria-label={`Reponer ${b.title}`}>Reponer</button>
                </li>
              ))}
            </ul>
          ) : <p className="muted">Ningún libro con 2 unidades o menos.</p>}
          {s.low.length > lowShown.length && (
            <p className="muted more">Y {s.low.length - lowShown.length} más. Ordená por «Menor stock» para verlos.</p>
          )}
        </section>
      </div>
    </>
  );
}
