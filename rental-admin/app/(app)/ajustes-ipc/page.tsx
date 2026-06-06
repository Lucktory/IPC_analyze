import { redirect } from 'next/navigation'

// Legacy URL — moved to /aumentos to match market terminology (Barreeo, Ubiquo).
export default function LegacyAjustesIpc() {
  redirect('/aumentos')
}
