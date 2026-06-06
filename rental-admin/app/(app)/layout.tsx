import { SideNav } from '@/components/shell/SideNav'
import { TopBar } from '@/components/shell/TopBar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-cream">
      <SideNav />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar pendientes={3} />
        <main className="flex-1 overflow-auto">
          <div className="max-w-shell mx-auto p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
