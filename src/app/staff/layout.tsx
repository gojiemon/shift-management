import { requireStaff } from "@/lib/auth";
import Header from "@/components/Header";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireStaff();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userName={user.name} userRole="STAFF" />
      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
