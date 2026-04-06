"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";

interface User {
  name: string;
  role: "ADMIN" | "STAFF";
}

interface Summary {
  monthsOfService: number;
  entitlementDays: number;
  totalGranted: number;
  totalUsedDays: number;
  balance: number;
  nextGrantDate: string | null;
  nextGrantDays: number | null;
  monthlyStats: Array<{
    yearMonth: string;
    attendanceRate: number;
    availableDays: number;
    assignedDays: number;
  }>;
}

interface Usage {
  id: string;
  usageDate: string;
  hours: number;
  note: string;
}

export default function StaffPaidLeavePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [usages, setUsages] = useState<Usage[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [meRes, summaryRes, usagesRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/paid-leave/summary"),
          fetch("/api/paid-leave/usage"),
        ]);
        const meData = await meRes.json();
        if (meData.user) setCurrentUser(meData.user);

        const summaryData = await summaryRes.json();
        const usagesData = await usagesRes.json();

        if (summaryData.summary) setSummary(summaryData.summary);
        if (summaryData.message) setMessage(summaryData.message);
        setUsages(usagesData.usages ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="p-6 text-center text-gray-500">読み込み中...</div>;
  }

  if (!summary) {
    return (
      <div className="min-h-screen bg-gray-50">
        {currentUser && (
          <Header userName={currentUser.name} userRole={currentUser.role} />
        )}
        <div className="p-6 max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">有給休暇</h1>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">{message || "契約情報が登録されていません。管理者にお問い合わせください。"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {currentUser && (
        <Header userName={currentUser.name} userRole={currentUser.role} />
      )}
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">有給休暇</h1>

        {/* Balance card */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-700 rounded-2xl p-8 text-white text-center mb-8 shadow-lg">
          <div className="text-6xl font-black mb-2">{summary.balance.toFixed(1)}</div>
          <div className="text-xl opacity-90">残有給日数</div>
          <div className="mt-4 text-sm opacity-75">
            付与累計: {summary.totalGranted}日 / 取得済み: {summary.totalUsedDays.toFixed(1)}日
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-gray-800">{summary.monthsOfService}</div>
            <div className="text-sm text-gray-500">勤続月数</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-gray-800">{summary.entitlementDays}</div>
            <div className="text-sm text-gray-500">法定付与日数</div>
          </div>
        </div>

        {/* Next grant */}
        {summary.nextGrantDate && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <p className="text-blue-800 text-sm">
              次回付与予定: <strong>{new Date(summary.nextGrantDate).toLocaleDateString("ja-JP")}</strong> に{" "}
              <strong>{summary.nextGrantDays}日</strong>
            </p>
          </div>
        )}

        {/* Monthly attendance */}
        {summary.monthlyStats.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-3">月別出勤率</h2>
            <div className="space-y-2">
              {summary.monthlyStats.slice(-12).map((m) => (
                <div key={m.yearMonth} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-20 shrink-0">{m.yearMonth}</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        m.attendanceRate >= 0.8 ? "bg-green-500" : "bg-red-400"
                      }`}
                      style={{ width: `${Math.min(100, m.attendanceRate * 100)}%` }}
                    />
                  </div>
                  <span
                    className={`text-sm font-medium w-12 text-right ${
                      m.attendanceRate >= 0.8 ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {(m.attendanceRate * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Usage history */}
        <div>
          <h2 className="text-lg font-semibold mb-3">取得履歴</h2>
          {usages.length === 0 ? (
            <p className="text-gray-500 text-sm">取得記録がありません</p>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">日付</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">時間</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">メモ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {usages.map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-3 text-gray-900">
                        {new Date(u.usageDate).toLocaleDateString("ja-JP")}
                      </td>
                      <td className="px-4 py-3 text-right text-red-500 font-medium">
                        {u.hours}h
                      </td>
                      <td className="px-4 py-3 text-gray-700">{u.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
