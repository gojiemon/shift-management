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
  publishedAt: string | null;
}

interface Assignment {
  id: string;
  date: string;
  startMin: number;
  endMin: number;
  note: string | null;
}

export default function StaffSchedulePage() {
  const params = useParams();
  const periodId = params.periodId as string;

  const [period, setPeriod] = useState<Period | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [periodRes, assignRes] = await Promise.all([
        fetch(`/api/periods/${periodId}`),
        fetch(`/api/assignments?periodId=${periodId}`),
      ]);

      if (periodRes.ok) {
        const { period } = await periodRes.json();
        setPeriod(period);
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

  if (loading) {
    return <div className="text-center py-8">読み込み中...</div>;
  }

  if (!period) {
    return <div className="text-center py-8 text-red-600">期間が見つかりません</div>;
  }

  if (!period.publishedAt) {
    return (
      <div className="text-center py-8 text-gray-600">
        シフトはまだ公開されていません
      </div>
    );
  }

  const days = eachDayOfInterval({
    start: parseISO(period.startDate),
    end: parseISO(period.endDate),
  });

  const assignmentMap = new Map<string, Assignment>();
  for (const a of assignments) {
    const dateKey = format(parseISO(a.date), "yyyy-MM-dd");
    assignmentMap.set(dateKey, a);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">あなたのシフト</h1>
        <p className="text-gray-600">
          {format(parseISO(period.startDate), "yyyy/MM/dd (E)", { locale: ja })} 〜{" "}
          {format(parseISO(period.endDate), "yyyy/MM/dd (E)", { locale: ja })}
        </p>
      </div>

      <div className="card">
        <div className="space-y-2">
          {days.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const assignment = assignmentMap.get(dateKey);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            const dayLabel = DAY_OF_WEEK_LABELS[day.getDay()];

            return (
              <div
                key={dateKey}
                className={`flex items-center justify-between py-2 px-3 rounded-md ${
                  isWeekend ? "bg-red-50" : "bg-gray-50"
                }`}
              >
                <span className={isWeekend ? "text-red-600" : ""}>
                  {format(day, "M/d")} ({dayLabel})
                </span>
                <span className="font-medium">
                  {assignment ? (
                    <span className="text-blue-600">
                      {minToTimeStr(assignment.startMin)}-
                      {minToTimeStr(assignment.endMin)}
                    </span>
                  ) : (
                    <span className="text-gray-400">休み</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
