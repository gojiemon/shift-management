"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface HeaderProps {
  userName: string;
  userRole: "ADMIN" | "STAFF";
}

export default function Header({ userName, userRole }: HeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href={userRole === "ADMIN" ? "/admin/periods" : "/staff/periods"} className="text-lg font-bold text-gray-900">
            シフト管理
          </Link>
          <nav className="flex gap-4">
            {userRole === "ADMIN" ? (
              <>
                <Link href="/admin/periods" className="text-gray-600 hover:text-gray-900">
                  期間管理
                </Link>
                <Link href="/admin/staff" className="text-gray-600 hover:text-gray-900">
                  スタッフ管理
                </Link>
              </>
            ) : (
              <>
                <Link href="/staff/periods" className="text-gray-600 hover:text-gray-900">
                  希望入力
                </Link>
                <Link href="/staff/settings" className="text-gray-600 hover:text-gray-900">
                  設定
                </Link>
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {userName}
            <span className="ml-2 px-2 py-1 text-xs rounded-full bg-gray-100">
              {userRole === "ADMIN" ? "店長" : "スタッフ"}
            </span>
          </span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ログアウト
          </button>
        </div>
      </div>
    </header>
  );
}
