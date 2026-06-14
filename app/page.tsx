import { redirect } from 'next/navigation'

// Landing page for the encargada — her daily work starts on the liquidación
// grid (the spreadsheet) per Alejandro's confirmed direction (2026-06-15).
// The dashboard and the other views are accessed from the sidebar or via
// the tabs inside /liquidacion.
export default function RootIndex() {
  redirect('/liquidacion')
}
