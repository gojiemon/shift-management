"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";

interface User {
  name: string;
  role: "ADMIN" | "STAFF";
}

interface StaffSummary {
  id: string;
  name: string;
  balance: number | null;
  monthsOfService: number | null;
  hasContract: boolean;
}

export default function AdminPaidLeavePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [staffList, setStaffList] = useState<StaffSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [meRes, staffRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/staff"),
        ]);
        const meData = await meRes.json();
        if (meData.user) setCurrentUser(meData.user);

        if (!staffRes.ok) throw new Error("Failed to fetch staff");
        const data = await staffRes.json();
        const users: { id: string; name: string }[] = data.staff ?? [];

        const summaries = await Promise.all(
          users.map(async (u) => {
            try {
              const r = await fetch(`/api/paid-leave/summary?userId=${u.id}`);
              const d = await r.json();
              if (d.summary) {
                return {
                  id: u.id,
                  name: u.name,
                  balance: d.summary.balance,
                  monthsOfService: d.summary.monthsOfService,
                  hasContract: true,
                };
              }
            } catch {}
            return {
              id: u.id,
              name: u.name,
              balance: null,
              monthsOfService: null,
              hasContract: false,
            };
          })
        );

        setStaffList(summaries);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {currentUser && (
        <Header userName={currentUser.name} userRole={currentUser.role} />
      )}
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">有給管理</h1>

        {loading ? (
          <div className="text-center py-12 text-gray-500">読み込み中...</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    スタッフ名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    勤続月数
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    残有給日数
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ステータス
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {staffList.map((staff) => (
                  <tr key={staff.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                      {staff.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {staff.monthsOfService !== null
                        ? `${staff.monthsOfService}ヶ月`
                        : "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {staff.balance !== null
                        ? `${staff.balance.toFixed(1)} 日`
                        : "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {staff.hasContract ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                          設定済
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
                          未設定
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Link
                        href={`/admin/paid-leave/${staff.id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        詳細
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
