import { requireAdmin } from "@/lib/auth";
import Header from "@/components/Header";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userName={user.name} userRole="ADMIN" />
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
