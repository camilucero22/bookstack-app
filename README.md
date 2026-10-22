# Book Stack

Stock y ventas para librerías (React + Vite + Firebase). Cada venta descuenta stock y alimenta el panel de estadísticas. Al cargar un libro se puede autocompletar con datos reales de Open Library.

## Ejecutar
1. `npm install`
2. Copiá `.env.example` a `.env` y completá los valores de tu `firebaseConfig`.
3. `npm run dev`

## Firebase
- Authentication: habilitar acceso **Anónimo**.
- Firestore (Standard, `(default)`, modo producción): pegar `firestore.rules` en la pestaña Reglas y publicar.
- Datos: `users/{uid}/books` y `users/{uid}/sales`.

## Vercel
Importar el repo, preset Vite, build `npm run build`, salida `dist`, y cargar las 4 variables `VITE_*` en Production.
