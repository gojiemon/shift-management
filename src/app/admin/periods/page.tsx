"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format, parseISO, startOfMonth, endOfMonth, setDate } from "date-fns";
import { ja } from "date-fns/locale";

interface Period {
  id: string;
  startDate: string;
  endDate: string;
  deadlineAt: string | null;
  isOpen: boolean;
  publishedAt: string | null;
  submissions?: { staffUserId: string }[];
}

interface SubmissionStats {
  total: number;
  submitted: number;
}

export default function AdminPeriodsPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [staffCount, setStaffCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Form state for new period
  const [newPeriodType, setNewPeriodType] = useState<"first" | "second">("first");
  const [newPeriodMonth, setNewPeriodMonth] = useState(() => {
    const now = new Date();
    return format(now, "yyyy-MM");
  });

  const loadData = useCallback(async () => {
    try {
      const [periodsRes, staffRes] = await Promise.all([
        fetch("/api/periods?includeSubmissions=true"),
        fetch("/api/staff"),
      ]);

      if (periodsRes.ok) {
        const { periods } = await periodsRes.json();
        setPeriods(periods);
      }

      if (staffRes.ok) {
        const { staff } = await staffRes.json();
        setStaffCount(staff.length);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createPeriod = async () => {
    setCreating(true);
    try {
      const [year, month] = newPeriodMonth.split("-").map(Number);
      const baseDate = new Date(year, month - 1, 1);

      let startDate: Date;
      let endDate: Date;

      if (newPeriodType === "first") {
        // 1-15日
        startDate = setDate(baseDate, 1);
        endDate = setDate(baseDate, 15);
      } else {
        // 16-月末
        startDate = setDate(baseDate, 16);
        endDate = endOfMonth(baseDate);
      }

      const res = await fetch("/api/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: format(startDate, "yyyy-MM-dd"),
          endDate: format(endDate, "yyyy-MM-dd"),
        }),
      });

      if (res.ok) {
        loadData();
      }
    } catch (error) {
      console.error("Failed to create period:", error);
    } finally {
      setCreating(false);
    }
  };

  const toggleOpen = async (periodId: string, isOpen: boolean) => {
    try {
      await fetch(`/api/periods/${periodId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOpen: !isOpen }),
      });
      loadData();
    } catch (error) {
      console.error("Failed to toggle period:", error);
    }
  };

  const deletePeriod = async (periodId: string) => {
    if (!confirm("この期間を削除しますか？関連するデータも全て削除されます。")) {
      return;
    }

    try {
      await fetch(`/api/periods/${periodId}`, { method: "DELETE" });
      loadData();
    } catch (error) {
      console.error("Failed to delete period:", error);
    }
  };

  if (loading) {
    return <div className="text-center py-8">読み込み中...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">期間管理</h1>

      {/* Create new period */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">新規期間作成</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="label">年月</label>
            <input
              type="month"
              value={newPeriodMonth}
              onChange={(e) => setNewPeriodMonth(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">期間タイプ</label>
            <select
              value={newPeriodType}
              onChange={(e) => setNewPeriodType(e.target.value as "first" | "second")}
              className="input"
            >
              <option value="first">前半 (1日〜15日)</option>
              <option value="second">後半 (16日〜月末)</option>
            </select>
          </div>
          <button
            onClick={createPeriod}
            disabled={creating}
            className="btn btn-primary"
          >
            {creating ? "作成中..." : "期間を作成"}
          </button>
        </div>
      </div>

      {/* Period list */}
      <div className="space-y-4">
        {periods.map((period) => {
          const submittedCount = period.submissions?.length || 0;

          return (
            <div key={period.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">
                      {format(parseISO(period.startDate), "yyyy/MM/dd (E)", { locale: ja })} 〜{" "}
                      {format(parseISO(period.endDate), "MM/dd (E)", { locale: ja })}
                    </h3>
                    {period.isOpen && (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                        受付中
                      </span>
                    )}
                    {period.publishedAt && (
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                        公開済み
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-gray-600 space-y-1">
                    {period.deadlineAt && (
                      <p>
                        締切: {format(parseISO(period.deadlineAt), "MM/dd (E) HH:mm", { locale: ja })}
                      </p>
                    )}
                    <p>
                      提出状況: {submittedCount}/{staffCount}人
                      {submittedCount < staffCount && (
                        <span className="text-orange-600 ml-2">
                          (未提出: {staffCount - submittedCount}人)
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => toggleOpen(period.id, period.isOpen)}
                    className={`btn ${period.isOpen ? "btn-secondary" : "btn-success"}`}
                  >
                    {period.isOpen ? "受付停止" : "受付開始"}
                  </button>
                  <Link
                    href={`/admin/periods/${period.id}/availability`}
                    className="btn btn-secondary"
                  >
                    希望一覧
                  </Link>
                  <Link
                    href={`/admin/periods/${period.id}/schedule`}
                    className="btn btn-secondary"
                  >
                    シフト作成
                  </Link>
                  <Link
                    href={`/admin/periods/${period.id}/publish`}
                    className="btn btn-secondary"
                  >
                    公開設定
                  </Link>
                  <Link
                    href={`/admin/periods/${period.id}/print`}
                    className="btn btn-secondary"
                  >
                    印刷(一覧)
                  </Link>
                  <Link
                    href={`/admin/periods/${period.id}/print-daily`}
                    className="btn btn-secondary"
                  >
                    印刷(日別)
                  </Link>
                  <button
                    onClick={() => deletePeriod(period.id)}
                    className="btn btn-danger"
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {periods.length === 0 && (
          <div className="card text-center text-gray-500">
            <p>期間がありません。新規期間を作成してください。</p>
          </div>
        )}
      </div>
    </div>
  );
}
