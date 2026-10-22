// Una venta (ticket) tiene varios libros en "items". Las ventas viejas de un solo libro se siguen leyendo.
export const flatten = (sales) =>
  sales.flatMap((s) =>
    (s.items || [s]).map((i) => ({
      bookId: i.bookId, title: i.title, genre: i.genre, language: i.language, qty: i.qty,
      amount: s.items ? i.price * i.qty : s.total, ageRange: s.ageRange,
    })));
