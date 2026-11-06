import { useState } from "react";
import * as E from "../lib/encargosDb";

const EMPTY = { name: "", contact: "", notes: "" };

export default function Suppliers({ suppliers, ctx, run }) {
  const [edit, setEdit] = useState(null); // null | { id?, name, contact, notes }

  const save = async (e) => {
    e.preventDefault();
    const { id, name, contact, notes } = edit;
    const ok = await run(() => E.saveSupplier(ctx, id, { name: name.trim(), contact: contact.trim(), notes: notes.trim() }),
      id ? "Proveedor actualizado" : "Proveedor agregado");
    if (ok) setEdit(null);
  };
  const remove = (p) => {
    if (window.confirm(`¿Eliminar a ${p.name}? Los libros que lo tengan como habitual quedan sin proveedor.`)) {
      run(() => E.removeSupplier(ctx, p.id), "Proveedor eliminado");
    }
  };
  const set = (k) => (e) => setEdit({ ...edit, [k]: e.target.value });

  if (edit) return (
    <form className="card-form" onSubmit={save}>
      <h2 className="mh">{edit.id ? "Editar proveedor" : "Nuevo proveedor"}</h2>
      <div className="fields">
        <label>Nombre
          <input value={edit.name} onChange={set("name")} required pattern=".*\S.*" autoComplete="off" />
          <span className="error-msg">Escribí el nombre.</span>
        </label>
        <label>Contacto (teléfono o mail)
          <input value={edit.contact} onChange={set("contact")} autoComplete="off" />
        </label>
        <label className="wide">Notas
          <textarea rows="2" value={edit.notes} onChange={set("notes")} placeholder="Ej: entregan los martes" />
        </label>
      </div>
      <div className="actions">
        <button type="submit" className="btn solid">Guardar</button>
        <button type="button" className="btn" onClick={() => setEdit(null)}>Cancelar</button>
      </div>
    </form>
  );

  return (
    <div>
      <h2 className="mh">Proveedores</h2>
      {suppliers.length ? (
        <ul className="sups">
          {suppliers.map((p) => (
            <li key={p.id}>
              <div>
                <strong>{p.name}</strong>
                {p.contact && <small>{p.contact}</small>}
                {p.notes && <small>{p.notes}</small>}
              </div>
              <div className="actions end">
                <button className="btn sm" onClick={() => setEdit(p)}>Editar</button>
                <button className="btn sm danger" onClick={() => remove(p)}>Eliminar</button>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="muted">Todavía no cargaste proveedores.</p>}
      <div className="actions">
        <button className="btn solid" onClick={() => setEdit(EMPTY)}>Nuevo proveedor</button>
      </div>
    </div>
  );
}
