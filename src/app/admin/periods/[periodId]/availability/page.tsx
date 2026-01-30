"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { ja } from "date-fns/locale";
import {
  AVAILABILITY_STATUS_LABELS,
  minToTimeStr,
  DAY_OF_WEEK_LABELS,
} from "@/lib/constants";

interface Period {
  id: string;
  startDate: string;
  endDate: string;
}

interface Staff {
  id: string;
  name: string;
}

interface Availability {
  id: string;
  staffUserId: string;
  date: string;
  status: "UNAVAILABLE" | "AVAILABLE" | "FREE" | "PREFER_OFF";
  startMin: number | null;
  endMin: number | null;
  note: string | null;
  staff: { id: string; name: string };
}

interface Submission {
  staffUserId: string;
  submittedAt: string;
}

export default function AdminAvailabilityPage() {
  const params = useParams();
  const periodId = params.periodId as string;

  const [period, setPeriod] = useState<Period | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [periodRes, staffRes, availRes, subRes] = await Promise.all([
        fetch(`/api/periods/${periodId}`),
        fetch("/api/staff"),
        fetch(`/api/availability?periodId=${periodId}`),
        fetch(`/api/submissions?periodId=${periodId}`),
      ]);

      if (periodRes.ok) {
        const { period } = await periodRes.json();
        setPeriod(period);
      }

      if (staffRes.ok) {
        const { staff } = await staffRes.json();
        setStaff(staff);
      }

      if (availRes.ok) {
        const { availabilities } = await availRes.json();
        setAvailabilities(availabilities);
      }

      if (subRes.ok) {
        const { submissions } = await subRes.json();
        setSubmissions(submissions || []);
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

  const submittedIds = new Set(submissions.map((s) => s.staffUserId));

  // Create availability map: staffId -> date -> availability
  const availMap = new Map<string, Map<string, Availability>>();
  for (const a of availabilities) {
    if (!availMap.has(a.staffUserId)) {
      availMap.set(a.staffUserId, new Map());
    }
    const dateKey = format(parseISO(a.date), "yyyy-MM-dd");
    availMap.get(a.staffUserId)!.set(dateKey, a);
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "FREE":
        return "bg-green-100 text-green-700";
      case "AVAILABLE":
        return "bg-blue-100 text-blue-700";
      case "PREFER_OFF":
        return "bg-yellow-100 text-yellow-700";
      case "UNAVAILABLE":
        return "bg-gray-100 text-gray-500";
      default:
        return "bg-gray-50 text-gray-400";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">希望一覧</h1>
          <p className="text-gray-600">
            {format(parseISO(period.startDate), "yyyy/MM/dd (E)", { locale: ja })} 〜{" "}
            {format(parseISO(period.endDate), "MM/dd (E)", { locale: ja })}
          </p>
        </div>
        <Link href="/admin/periods" className="btn btn-secondary">
          戻る
        </Link>
      </div>

      {/* Submission status */}
      <div className="card">
        <h2 className="font-semibold mb-2">提出状況</h2>
        <div className="flex flex-wrap gap-2">
          {staff.map((s) => (
            <span
              key={s.id}
              className={`px-3 py-1 rounded-full text-sm ${
                submittedIds.has(s.id)
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {s.name}: {submittedIds.has(s.id) ? "提出済" : "未提出"}
            </span>
          ))}
        </div>
      </div>

      {/* Availability table */}
      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-2 sticky left-0 bg-white">スタッフ</th>
              {days.map((day) => {
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <th
                    key={day.toISOString()}
                    className={`text-center py-2 px-1 min-w-[60px] ${
                      isWeekend ? "text-red-600" : ""
                    }`}
                  >
                    <div>{format(day, "M/d")}</div>
                    <div className="text-xs">{DAY_OF_WEEK_LABELS[day.getDay()]}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="border-b hover:bg-gray-50">
                <td className="py-2 px-2 font-medium sticky left-0 bg-white">
                  {s.name}
                </td>
                {days.map((day) => {
                  const dateKey = format(day, "yyyy-MM-dd");
                  const avail = availMap.get(s.id)?.get(dateKey);

                  return (
                    <td key={dateKey} className="py-1 px-1 text-center">
                      {avail ? (
                        <div
                          className={`rounded px-1 py-0.5 text-xs ${getStatusColor(
                            avail.status
                          )}`}
                          title={avail.note || undefined}
                        >
                          {avail.status === "FREE" && "フリー"}
                          {avail.status === "AVAILABLE" &&
                            `${minToTimeStr(avail.startMin!)}-${minToTimeStr(avail.endMin!)}`}
                          {avail.status === "PREFER_OFF" && (
                            <span>
                              休希望
                              {avail.startMin && avail.endMin && (
                                <span className="block text-[10px]">
                                  {minToTimeStr(avail.startMin)}-{minToTimeStr(avail.endMin)}
                                </span>
                              )}
                            </span>
                          )}
                          {avail.status === "UNAVAILABLE" && "不可"}
                        </div>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="card">
        <h3 className="font-semibold mb-2">凡例</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <span className={`px-2 py-1 rounded ${getStatusColor("FREE")}`}>
            フリー（終日OK）
          </span>
          <span className={`px-2 py-1 rounded ${getStatusColor("AVAILABLE")}`}>
            出勤OK（時間指定）
          </span>
          <span className={`px-2 py-1 rounded ${getStatusColor("PREFER_OFF")}`}>
            できれば休み
          </span>
          <span className={`px-2 py-1 rounded ${getStatusColor("UNAVAILABLE")}`}>
            不可
          </span>
        </div>
      </div>
    </div>
  );
}
