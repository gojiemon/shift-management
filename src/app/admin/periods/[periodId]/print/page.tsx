"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { ja } from "date-fns/locale";
import { minToTimeStr, DAY_OF_WEEK_LABELS } from "@/lib/constants";

interface Period {
  id: string;
  startDate: string;
  endDate: string;
}

interface Staff {
  id: string;
  name: string;
}

interface Assignment {
  staffUserId: string;
  date: string;
  startMin: number;
  endMin: number;
}

export default function AdminPrintPage() {
  const params = useParams();
  const periodId = params.periodId as string;

  const [period, setPeriod] = useState<Period | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [periodRes, staffRes, assignRes] = await Promise.all([
        fetch(`/api/periods/${periodId}`),
        fetch("/api/staff"),
        fetch(`/api/assignments?periodId=${periodId}`),
      ]);

      if (periodRes.ok) {
        const { period } = await periodRes.json();
        setPeriod(period);
      }

      if (staffRes.ok) {
        const { staff } = await staffRes.json();
        setStaff(staff);
      }

      if (assignRes.ok) {
        const { assignments } = await assignRes.json();
        setAssignments(assignments);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }, [periodId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="text-center py-8">読み込み中...</div>;
  }

  if (!period) {
    return <div className="text-center py-8 text-red-600">期間が見つかりません</div>;
  }

  const days = eachDayOfInterval({
    start: parseISO(period.startDate),
    end: parseISO(period.endDate),
  });

  // Create assignment map: staffId -> date -> assignment
  const assignMap = new Map<string, Map<string, Assignment>>();
  for (const a of assignments) {
    if (!assignMap.has(a.staffUserId)) {
      assignMap.set(a.staffUserId, new Map());
    }
    const dateKey = format(parseISO(a.date), "yyyy-MM-dd");
    assignMap.get(a.staffUserId)!.set(dateKey, a);
  }

  return (
    <div>
      {/* Print button (hidden in print) */}
      <div className="no-print mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">印刷プレビュー</h1>
          <p className="text-gray-600">
            {format(parseISO(period.startDate), "yyyy/MM/dd (E)", { locale: ja })} 〜{" "}
            {format(parseISO(period.endDate), "MM/dd (E)", { locale: ja })}
          </p>
        </div>
        <button onClick={handlePrint} className="btn btn-primary">
          印刷
        </button>
      </div>

      {/* Print content */}
      <div className="bg-white p-2 print:p-0">
        {/* Header */}
        <div className="text-center mb-2 print-break-inside-avoid">
          <h1 className="text-lg font-bold">シフト表</h1>
          <p className="text-sm">
            {format(parseISO(period.startDate), "yyyy年M月d日", { locale: ja })} 〜{" "}
            {format(parseISO(period.endDate), "M月d日", { locale: ja })}
          </p>
          <p className="text-xs text-gray-600">
            作成日: {format(new Date(), "yyyy年M月d日", { locale: ja })}
          </p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-gray-400 bg-gray-100 px-1 py-0.5 text-left min-w-[60px]">
                  スタッフ
                </th>
                {days.map((day) => {
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const isSunday = day.getDay() === 0;
                  const isSaturday = day.getDay() === 6;
                  return (
                    <th
                      key={day.toISOString()}
                      className={`border border-gray-400 px-0.5 py-0.5 text-center min-w-[40px] ${
                        isSunday
                          ? "bg-red-100"
                          : isSaturday
                            ? "bg-blue-50"
                            : "bg-gray-100"
                      }`}
                    >
                      <span className={`text-xs ${isWeekend ? (isSunday ? "text-red-600" : "text-blue-600") : ""}`}>
                        {format(day, "d")}{DAY_OF_WEEK_LABELS[day.getDay()]}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="print-break-inside-avoid">
                  <td className="border border-gray-400 px-1 py-0.5 font-medium bg-gray-50 text-sm">
                    {s.name}
                  </td>
                  {days.map((day) => {
                    const dateKey = format(day, "yyyy-MM-dd");
                    const assignment = assignMap.get(s.id)?.get(dateKey);
                    const isSunday = day.getDay() === 0;
                    const isSaturday = day.getDay() === 6;

                    return (
                      <td
                        key={dateKey}
                        className={`border border-gray-400 px-0.5 py-0 text-center leading-tight ${
                          isSunday
                            ? "bg-red-50"
                            : isSaturday
                              ? "bg-blue-50/50"
                              : ""
                        }`}
                      >
                        {assignment ? (
                          <span className="text-xs whitespace-nowrap">
                            {minToTimeStr(assignment.startMin)}
                            <br />
                            {minToTimeStr(assignment.endMin)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-1 text-xs text-gray-600 print-break-inside-avoid">
          <p>営業時間: 10:00〜20:30</p>
        </div>
      </div>

      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }

          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .no-print {
            display: none !important;
          }

          table {
            font-size: 9px !important;
          }

          th,
          td {
            padding: 1px 2px !important;
          }
        }

        /* Screen compact styles */
        .leading-tight {
          line-height: 1.1;
        }
      `}</style>
    </div>
  );
}
