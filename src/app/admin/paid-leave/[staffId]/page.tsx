"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "@/components/Header";

interface User {
  name: string;
  role: "ADMIN" | "STAFF";
}

interface Contract {
  id?: string;
  joinDate: string;
  contractDaysPerWeek: number;
  requiresWeekend: boolean;
  weekendDays: string;
  avgDailyHours: number;
  notes: string;
}

interface Grant {
  id: string;
  grantDate: string;
  days: number;
  reason: string;
  expiryDate?: string;
}

interface Usage {
  id: string;
  usageDate: string;
  hours: number;
  note: string;
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
    unscheduledDays: number;
  }>;
}

export default function StaffPaidLeaveDetailPage() {
  const params = useParams();
  const router = useRouter();
  const staffId = params.staffId as string;

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "contract" | "grants">(
    "summary"
  );
  const [summary, setSummary] = useState<Summary | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [usages, setUsages] = useState<Usage[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffName, setStaffName] = useState("");

  // Contract form state
  const [contractForm, setContractForm] = useState<Contract>({
    joinDate: "",
    contractDaysPerWeek: 3,
    requiresWeekend: false,
    weekendDays: "",
    avgDailyHours: 7.0,
    notes: "",
  });

  // Grant form state
  const [grantForm, setGrantForm] = useState({
    grantDate: "",
    days: 10,
    reason: "法定付与",
    expiryDate: "",
  });

  // Usage form state
  const [usageForm, setUsageForm] = useState({
    usageDate: "",
    hours: 7.0,
    note: "",
  });

  useEffect(() => {
    async function load() {
      try {
        // Load current user and staff info
        const [meRes, staffRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/staff"),
        ]);
        const meData = await meRes.json();
        if (meData.user) setCurrentUser(meData.user);

        if (staffRes.ok) {
          const data = await staffRes.json();
          const users: { id: string; name: string }[] = data.staff ?? [];
          const found = users.find((u) => u.id === staffId);
          if (found) setStaffName(found.name);
        }

        // Load summary
        const summaryRes = await fetch(`/api/paid-leave/summary?userId=${staffId}`);
        const summaryData = await summaryRes.json();
        if (summaryData.summary) setSummary(summaryData.summary);

        // Load contract
        const contractRes = await fetch(`/api/paid-leave/contract?userId=${staffId}`);
        const contractData = await contractRes.json();
        if (contractData.contract) {
          setContract(contractData.contract);
          setContractForm({
            ...contractData.contract,
            joinDate: contractData.contract.joinDate.split("T")[0],
          });
        }

        // Load grants
        const grantsRes = await fetch(`/api/paid-leave/grants?userId=${staffId}`);
        const grantsData = await grantsRes.json();
        setGrants(grantsData.grants ?? []);

        // Load usages
        const usagesRes = await fetch(`/api/paid-leave/usage?userId=${staffId}`);
        const usagesData = await usagesRes.json();
        setUsages(usagesData.usages ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [staffId]);

  async function saveContract(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/paid-leave/contract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...contractForm, userId: staffId }),
    });
    if (res.ok) {
      const data = await res.json();
      setContract(data.contract);
      alert("契約情報を保存しました");
    }
  }

  async function addGrant(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/paid-leave/grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...grantForm, userId: staffId }),
    });
    if (res.ok) {
      const data = await res.json();
      setGrants((prev) => [data.grant, ...prev]);
      setGrantForm({ grantDate: "", days: 10, reason: "法定付与", expiryDate: "" });
    }
  }

  async function deleteGrant(id: string) {
    if (!confirm("この付与記録を削除しますか？")) return;
    const res = await fetch(`/api/paid-leave/grants/${id}`, { method: "DELETE" });
    if (res.ok) setGrants((prev) => prev.filter((g) => g.id !== id));
  }

  async function addUsage(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/paid-leave/usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...usageForm, userId: staffId }),
    });
    if (res.ok) {
      const data = await res.json();
      setUsages((prev) => [data.usage, ...prev]);
      setUsageForm({ usageDate: "", hours: 7.0, note: "" });
    }
  }

  async function deleteUsage(id: string) {
    if (!confirm("この利用記録を削除しますか？")) return;
    const res = await fetch(`/api/paid-leave/usage/${id}`, { method: "DELETE" });
    if (res.ok) setUsages((prev) => prev.filter((u) => u.id !== id));
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">読み込み中...</div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {currentUser && (
        <Header userName={currentUser.name} userRole={currentUser.role} />
      )}
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-700"
          >
            ← 戻る
          </button>
          <h1 className="text-2xl font-bold">{staffName} の有給管理</h1>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex gap-6">
            {(["summary", "contract", "grants"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab === "summary" ? "サマリー" : tab === "contract" ? "契約情報" : "付与・利用"}
              </button>
            ))}
          </nav>
        </div>

        {/* Summary Tab */}
        {activeTab === "summary" && (
          <div>
            {summary ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-white rounded-lg shadow p-4 text-center">
                    <div className="text-3xl font-bold text-blue-600">
                      {summary.balance.toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">残有給日数</div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4 text-center">
                    <div className="text-3xl font-bold text-green-600">
                      {summary.totalGranted.toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">累計付与日数</div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4 text-center">
                    <div className="text-3xl font-bold text-red-500">
                      {summary.totalUsedDays.toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">累計取得日数</div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4 text-center">
                    <div className="text-3xl font-bold text-gray-700">
                      {summary.monthsOfService}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">勤続月数</div>
                  </div>
                </div>

                {summary.nextGrantDate && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <p className="text-blue-800">
                      次回付与予定: <strong>{new Date(summary.nextGrantDate).toLocaleDateString("ja-JP")}</strong> に{" "}
                      <strong>{summary.nextGrantDays}日</strong> 付与予定
                    </p>
                  </div>
                )}

                {summary.monthlyStats.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold mb-3">月別出勤率</h2>
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">年月</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">出勤可能日</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">実勤務日</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">出勤率</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {summary.monthlyStats.map((m) => (
                            <tr key={m.yearMonth}>
                              <td className="px-4 py-3 text-gray-900">{m.yearMonth}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{m.availableDays}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{m.assignedDays}</td>
                              <td className="px-4 py-3 text-right">
                                <span
                                  className={`font-medium ${
                                    m.attendanceRate >= 0.8
                                      ? "text-green-600"
                                      : "text-red-500"
                                  }`}
                                >
                                  {(m.attendanceRate * 100).toFixed(0)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-gray-500">契約情報を登録してください。</p>
            )}
          </div>
        )}

        {/* Contract Tab */}
        {activeTab === "contract" && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">契約情報</h2>
            <form onSubmit={saveContract} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  入社日
                </label>
                <input
                  type="date"
                  value={contractForm.joinDate}
                  onChange={(e) =>
                    setContractForm((p) => ({ ...p, joinDate: e.target.value }))
                  }
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  週所定労働日数
                </label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={contractForm.contractDaysPerWeek}
                  onChange={(e) =>
                    setContractForm((p) => ({
                      ...p,
                      contractDaysPerWeek: parseInt(e.target.value),
                    }))
                  }
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  1日平均労働時間
                </label>
                <input
                  type="number"
                  step={0.5}
                  min={1}
                  max={12}
                  value={contractForm.avgDailyHours}
                  onChange={(e) =>
                    setContractForm((p) => ({
                      ...p,
                      avgDailyHours: parseFloat(e.target.value),
                    }))
                  }
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  備考
                </label>
                <textarea
                  value={contractForm.notes}
                  onChange={(e) =>
                    setContractForm((p) => ({ ...p, notes: e.target.value }))
                  }
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
              >
                保存
              </button>
            </form>
          </div>
        )}

        {/* Grants & Usage Tab */}
        {activeTab === "grants" && (
          <div className="space-y-8">
            {/* Grant form */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">有給付与を追加</h2>
              <form onSubmit={addGrant} className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">付与日</label>
                  <input
                    type="date"
                    value={grantForm.grantDate}
                    onChange={(e) => setGrantForm((p) => ({ ...p, grantDate: e.target.value }))}
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">付与日数</label>
                  <input
                    type="number"
                    step={0.5}
                    min={0.5}
                    value={grantForm.days}
                    onChange={(e) => setGrantForm((p) => ({ ...p, days: parseFloat(e.target.value) }))}
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">理由</label>
                  <input
                    type="text"
                    value={grantForm.reason}
                    onChange={(e) => setGrantForm((p) => ({ ...p, reason: e.target.value }))}
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">有効期限（任意）</label>
                  <input
                    type="date"
                    value={grantForm.expiryDate}
                    onChange={(e) => setGrantForm((p) => ({ ...p, expiryDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <button
                    type="submit"
                    className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700"
                  >
                    付与を追加
                  </button>
                </div>
              </form>
            </div>

            {/* Grants list */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold">付与履歴</h2>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">付与日</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">日数</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">理由</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">有効期限</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {grants.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        付与記録がありません
                      </td>
                    </tr>
                  ) : (
                    grants.map((g) => (
                      <tr key={g.id}>
                        <td className="px-4 py-3 text-gray-900">
                          {new Date(g.grantDate).toLocaleDateString("ja-JP")}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-green-600">
                          +{g.days}日
                        </td>
                        <td className="px-4 py-3 text-gray-700">{g.reason}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {g.expiryDate
                            ? new Date(g.expiryDate).toLocaleDateString("ja-JP")
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => deleteGrant(g.id)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            削除
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Usage form */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">有給利用を追加</h2>
              <form onSubmit={addUsage} className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">利用日</label>
                  <input
                    type="date"
                    value={usageForm.usageDate}
                    onChange={(e) => setUsageForm((p) => ({ ...p, usageDate: e.target.value }))}
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">時間数</label>
                  <input
                    type="number"
                    step={0.5}
                    min={0.5}
                    value={usageForm.hours}
                    onChange={(e) => setUsageForm((p) => ({ ...p, hours: parseFloat(e.target.value) }))}
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
                  <input
                    type="text"
                    value={usageForm.note}
                    onChange={(e) => setUsageForm((p) => ({ ...p, note: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-span-3">
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    利用を追加
                  </button>
                </div>
              </form>
            </div>

            {/* Usages list */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold">利用履歴</h2>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">利用日</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">時間数</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">メモ</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {usages.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                        利用記録がありません
                      </td>
                    </tr>
                  ) : (
                    usages.map((u) => (
                      <tr key={u.id}>
                        <td className="px-4 py-3 text-gray-900">
                          {new Date(u.usageDate).toLocaleDateString("ja-JP")}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-red-500">
                          -{u.hours}h
                        </td>
                        <td className="px-4 py-3 text-gray-700">{u.note || "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => deleteUsage(u.id)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            削除
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
