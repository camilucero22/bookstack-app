
import { useMemo, useState } from "react";

const money = (value) =>
    new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 2,
    }).format(Number(value) || 0);

const getDate = (value) => {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value) => {
    const date = getDate(value);
    if (!date) return "Fecha no disponible";

    return new Intl.DateTimeFormat("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(date);
};

export default function SalesHistory({ sales = [], orders = [] }) {
    const [search, setSearch] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [expandedSale, setExpandedSale] = useState(null);

    // Relaciona cada venta por encargo con su pedido original.
    const ordersById = useMemo(
        () => new Map(orders.map((order) => [order.id, order])),
        [orders]
    );

    const normalizedSales = useMemo(() => {
        return sales.map((sale) => {
            const order = sale.customerOrderId
                ? ordersById.get(sale.customerOrderId)
                : null;

            const isOrderSale =
                sale.source === "encargo" || Boolean(sale.customerOrderId);

            return {
                ...sale,
                order,
                isOrderSale,
                customerName: isOrderSale
                    ? order?.customerName || "Cliente no disponible"
                    : "Venta directa",
                items: sale.items || [],
                dateObject: getDate(sale.date),
            };
        });
    }, [sales, ordersById]);

    const filteredSales = useMemo(() => {
        const term = search.trim().toLowerCase();

        return normalizedSales
            .filter((sale) => {
                const matchesSearch =
                    !term ||
                    sale.customerName.toLowerCase().includes(term) ||
                    sale.items.some((item) =>
                        (item.title || "").toLowerCase().includes(term)
                    ) ||
                    sale.id.toLowerCase().includes(term);

                const saleDate = sale.dateObject;
                const matchesFrom =
                    !fromDate ||
                    (saleDate && saleDate >= new Date(`${fromDate}T00:00:00`));

                const matchesTo =
                    !toDate ||
                    (saleDate && saleDate <= new Date(`${toDate}T23:59:59.999`));

                return matchesSearch && matchesFrom && matchesTo;
            })
            .sort(
                (a, b) =>
                    (b.dateObject?.getTime() || 0) -
                    (a.dateObject?.getTime() || 0)
            );
    }, [normalizedSales, search, fromDate, toDate]);

    const totalRevenue = filteredSales.reduce(
        (sum, sale) => sum + (Number(sale.total) || 0),
        0
    );

    const totalUnits = filteredSales.reduce(
        (sum, sale) => sum + (Number(sale.units) || 0),
        0
    );

    return (
        <section className="sales-history">
            <div className="sales-history__stats">
                <article className="sales-history__stat">
                    <span>Ventas registradas</span>
                    <strong>{filteredSales.length}</strong>
                </article>

                <article className="sales-history__stat">
                    <span>Facturación</span>
                    <strong>{money(totalRevenue)}</strong>
                </article>

                <article className="sales-history__stat">
                    <span>Libros vendidos</span>
                    <strong>{totalUnits}</strong>
                </article>
            </div>

            <div className="sales-history__filters">
                <div className="sales-history__search">
                    <label htmlFor="sales-search">Buscar</label>
                    <input
                        id="sales-search"
                        type="search"
                        placeholder="Cliente, libro o número de venta..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </div>

                <div className="sales-history__date">
                    <label htmlFor="sales-from">Desde</label>
                    <input
                        id="sales-from"
                        type="date"
                        value={fromDate}
                        onChange={(event) => setFromDate(event.target.value)}
                    />
                </div>

                <div className="sales-history__date">
                    <label htmlFor="sales-to">Hasta</label>
                    <input
                        id="sales-to"
                        type="date"
                        value={toDate}
                        onChange={(event) => setToDate(event.target.value)}
                    />
                </div>

                {(search || fromDate || toDate) && (
                    <button
                        type="button"
                        className="sales-history__clear"
                        onClick={() => {
                            setSearch("");
                            setFromDate("");
                            setToDate("");
                        }}
                    >
                        Limpiar filtros
                    </button>
                )}
            </div>

            <div className="sales-history__list">
                <div className="sales-history__list-heading">
                    <h2>Ventas</h2>
                    <span>{filteredSales.length} resultados</span>
                </div>

                {filteredSales.length === 0 ? (
                    <div className="sales-history__empty">
                        <h3>No se encontraron ventas</h3>
                        <p>
                            {sales.length === 0
                                ? "Cuando registres una venta, aparecerá acá."
                                : "Probá modificar los filtros de búsqueda."}
                        </p>
                    </div>
                ) : (
                    filteredSales.map((sale) => {
                        const isExpanded = expandedSale === sale.id;

                        return (
                            <article className="sales-history__sale" key={sale.id}>
                                <button
                                    type="button"
                                    className="sales-history__sale-button"
                                    onClick={() =>
                                        setExpandedSale(isExpanded ? null : sale.id)
                                    }
                                    aria-expanded={isExpanded}
                                >
                                    <div className="sales-history__sale-main">
                                        <div className="sales-history__sale-top">
                                            <strong>
                                                {sale.isOrderSale
                                                    ? sale.customerName
                                                    : `Venta #${sale.id.slice(0, 6).toUpperCase()}`}
                                            </strong>

                                            <span
                                                className={`sales-history__tag ${sale.isOrderSale
                                                        ? "sales-history__tag--order"
                                                        : "sales-history__tag--direct"
                                                    }`}
                                            >
                                                {sale.isOrderSale ? "Por encargo" : "Directa"}
                                            </span>
                                        </div>

                                        <span className="sales-history__sale-date">
                                            {formatDate(sale.date)}
                                        </span>

                                        <span className="sales-history__sale-items">
                                            {sale.items.length}{" "}
                                            {sale.items.length === 1 ? "libro" : "libros"}
                                            {" · "}
                                            {sale.units || 0} unidades
                                        </span>
                                    </div>

                                    <div className="sales-history__sale-total">
                                        <strong>{money(sale.total)}</strong>
                                        <span>{isExpanded ? "Cerrar ↑" : "Ver detalle ↓"}</span>
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="sales-history__detail">
                                        <div className="sales-history__detail-heading">
                                            <h3>Detalle de la venta</h3>
                                            <span>
                                                {sale.isOrderSale
                                                    ? `Encargo #${sale.customerOrderId?.slice(0, 6).toUpperCase() || "—"}`
                                                    : `Venta #${sale.id.slice(0, 6).toUpperCase()}`}
                                            </span>
                                        </div>

                                        {sale.items.length > 0 ? (
                                            <div className="sales-history__table-wrap">
                                                <table className="sales-history__table">
                                                    <thead>
                                                        <tr>
                                                            <th>Libro</th>
                                                            <th>Cantidad</th>
                                                            <th>Precio unitario</th>
                                                            <th>Subtotal</th>
                                                        </tr>
                                                    </thead>

                                                    <tbody>
                                                        {sale.items.map((item, index) => (
                                                            <tr key={`${item.bookId || item.title}-${index}`}>
                                                                <td>
                                                                    <strong>{item.title || "Libro sin título"}</strong>
                                                                    {item.genre && <small>{item.genre}</small>}
                                                                </td>
                                                                <td>{item.qty || 0}</td>
                                                                <td>{money(item.price)}</td>
                                                                <td>
                                                                    {money(
                                                                        (Number(item.price) || 0) *
                                                                        (Number(item.qty) || 0)
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <p className="sales-history__no-items">
                                                No hay detalle de libros disponible para esta venta.
                                            </p>
                                        )}

                                        <div className="sales-history__detail-total">
                                            <span>Total de la venta</span>
                                            <strong>{money(sale.total)}</strong>
                                        </div>

                                        {sale.isOrderSale && (
                                            <div className="sales-history__customer">
                                                <span>Cliente</span>
                                                <strong>{sale.customerName}</strong>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </article>
                        );
                    })
                )}
            </div>
        </section>
    );
}
