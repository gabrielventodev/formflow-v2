import Link from "next/link";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="flex h-14 items-center gap-6 px-6">
          <Link href="/admin/forms" className="font-semibold tracking-tight">
            FormFlow
          </Link>
          <nav className="flex gap-4 text-sm text-zinc-600">
            <Link href="/admin/forms" className="hover:text-zinc-900">
              Formularios
            </Link>
          </nav>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
