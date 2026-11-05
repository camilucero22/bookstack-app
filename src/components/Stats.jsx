import { useMemo } from "react";
import { flatten } from "../lib/sales";

const monthKey = (d) => d.getFullYear() * 12 + d.getMonth();
const saleUnits = (s) => s.units ?? flatten([s]).reduce((a, x) => a + x.qty, 0);
// "date" es un Timestamp de Firestore; puede ser null un instante, hasta que el servidor lo confirma.
const saleMonth = (s) => { const d = s.date?.toDate?.(); return d ? monthKey(d) : null; };

// Resumen del stock: títulos, unidades, vendidos este mes (vs. el mes anterior) y stock bajo.
export default function Stats({ books, sales }) {
  const k = useMemo(() => {
    const now = monthKey(new Date());
    const unitsIn = (m) => sales.filter((s) => saleMonth(s) === m).reduce((a, s) => a + saleUnits(s), 0);
    const sold = unitsIn(now);
    const prev = unitsIn(now - 1);
    return {
      titles: books.length,
      stock: books.reduce((a, b) => a + b.stock, 0),
      sold,
      trend: prev ? Math.round(((sold - prev) / prev) * 100) : null,
      low: books.filter((b) => b.stock <= 2).length,
    };
  }, [books, sales]);

  return (
    <section className="kpis" aria-label="Resumen del stock">
      <div className="kpi"><p>Títulos</p><b>{k.titles}</b></div>
      <div className="kpi"><p>Unidades en stock</p><b>{k.stock}</b></div>
      <div className="kpi">
        <p>Vendidos este mes</p>
        <b>
          {k.sold}
          {k.trend !== null && k.trend !== 0 && (
            <span className={"trend" + (k.trend < 0 ? " down" : "")}>
              {k.trend < 0 ? "↓" : "↑"} {Math.abs(k.trend)}%
            </span>
          )}
        </b>
      </div>
      <div className="kpi warn"><p>Stock bajo</p><b>{k.low}</b></div>
    </section>
  );
}
