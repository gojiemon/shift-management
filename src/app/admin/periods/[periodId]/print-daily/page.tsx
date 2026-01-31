"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { ja } from "date-fns/locale";
import { minToTimeStr, BUSINESS_START_MIN, BUSINESS_END_MIN } from "@/lib/constants";

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
  breakMin: number | null;
  breakStartMin: number | null;
  staff: { id: string; name: string };
}

// 時間軸 10時〜22時
const HOURS = Array.from({ length: 13 }, (_, i) => i + 10);

export default function AdminPrintDailyPage() {
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

  // Group assignments by date
  const assignmentsByDate = new Map<string, Assignment[]>();
  for (const a of assignments) {
    const dateKey = format(parseISO(a.date), "yyyy-MM-dd");
    if (!assignmentsByDate.has(dateKey)) {
      assignmentsByDate.set(dateKey, []);
    }
    assignmentsByDate.get(dateKey)!.push(a);
  }

  // Calculate bar position (percentage)
  const minToPercent = (min: number) => {
    const totalMinutes = BUSINESS_END_MIN - BUSINESS_START_MIN + 90; // 10:00-22:00 = 720min
    return ((min - BUSINESS_START_MIN) / totalMinutes) * 100;
  };

  const minToWidth = (duration: number) => {
    const totalMinutes = BUSINESS_END_MIN - BUSINESS_START_MIN + 90;
    return (duration / totalMinutes) * 100;
  };

  // Calculate work hours
  const calcWorkHours = (startMin: number, endMin: number, breakMin: number | null) => {
    const totalMin = endMin - startMin - (breakMin || 0);
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    return mins > 0 ? `${hours}:${mins.toString().padStart(2, "0")}` : `${hours}:00`;
  };

  return (
    <div className="print-daily-page">
      {/* Print button (hidden in print) */}
      <div className="no-print mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">日別シフト表印刷</h1>
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
      <div className="bg-white print:bg-white">
        {/* Page header */}
        <div className="text-right text-xs mb-2 no-print-margin">
          作成日: {format(new Date(), "yyyy年M月d日", { locale: ja })}
        </div>

        {/* Daily tables */}
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayAssignments = assignmentsByDate.get(dateKey) || [];
          const dayOfWeek = ["日", "月", "火", "水", "木", "金", "土"][day.getDay()];
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;

          // Skip days with no assignments
          if (dayAssignments.length === 0) return null;

          // Sort by start time
          dayAssignments.sort((a, b) => a.startMin - b.startMin);

          return (
            <div key={dateKey} className="mb-3 daily-table">
              {/* Date header */}
              <h2 className={`text-sm font-bold mb-1 ${isWeekend ? "text-red-600" : ""}`}>
                {format(day, "yyyy年M月d日", { locale: ja })}（{dayOfWeek}）シフト表
              </h2>

              {/* Legend */}
              <div className="flex gap-3 text-xs mb-1">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-2 bg-black"></span>勤務
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-2 bg-orange-500"></span>休憩
                </span>
              </div>

              {/* Table */}
              <table className="w-full border-collapse text-xs table-fixed">
                <thead>
                  <tr>
                    <th className="border border-gray-400 bg-gray-100 px-1 py-0.5 text-left w-16">
                      名前
                    </th>
                    <th className="border border-gray-400 bg-gray-100 px-1 py-0.5 text-center w-12">
                      勤務時間
                    </th>
                    {HOURS.map((hour) => (
                      <th
                        key={hour}
                        className="border border-gray-400 bg-gray-100 px-0 py-0.5 text-center"
                        style={{ width: `${100 / HOURS.length}%` }}
                      >
                        {hour}
                      </th>
                    ))}
                    <th className="border border-gray-400 bg-gray-100 px-1 py-0.5 text-center w-14">
                      実働時間
                    </th>
                    <th className="border border-gray-400 bg-gray-100 px-1 py-0.5 text-center w-14">
                      備考
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dayAssignments.map((assignment) => {
                    const staffName = assignment.staff?.name || staff.find(s => s.id === assignment.staffUserId)?.name || "Unknown";
                    const shiftDuration = assignment.endMin - assignment.startMin;
                    const defaultBreakStart = assignment.breakMin
                      ? assignment.startMin + Math.floor((shiftDuration - assignment.breakMin) / 2 / 15) * 15
                      : assignment.startMin;
                    const breakStartPos = assignment.breakStartMin ?? defaultBreakStart;

                    return (
                      <tr key={assignment.staffUserId}>
                        <td className="staff-name border border-gray-400 px-1 py-0.5 font-medium text-sm">
                          {staffName}
                        </td>
                        <td className="border border-gray-400 px-1 py-0.5 text-center text-xs">
                          {minToTimeStr(assignment.startMin)}-{minToTimeStr(assignment.endMin)}
                        </td>
                        <td
                          colSpan={HOURS.length}
                          className="border border-gray-400 p-0 relative"
                          style={{ height: "10px" }}
                        >
                          {/* Grid lines */}
                          <div className="absolute inset-0 flex">
                            {HOURS.map((hour, idx) => (
                              <div
                                key={hour}
                                className={`flex-1 ${idx > 0 ? "border-l border-gray-200" : ""}`}
                              />
                            ))}
                          </div>
                          {/* Shift bar */}
                          <div
                            className="absolute bg-black rounded-sm"
                            style={{
                              left: `${minToPercent(assignment.startMin)}%`,
                              width: `${minToWidth(assignment.endMin - assignment.startMin)}%`,
                              top: "50%",
                              transform: "translateY(-50%)",
                              height: "8px",
                            }}
                          />
                          {/* Break bar */}
                          {assignment.breakMin && (
                            <div
                              className="absolute bg-orange-500 rounded-sm"
                              style={{
                                left: `${minToPercent(breakStartPos)}%`,
                                width: `${minToWidth(assignment.breakMin)}%`,
                                top: "50%",
                                transform: "translateY(-50%)",
                                height: "8px",
                              }}
                            />
                          )}
                        </td>
                        <td className="border border-gray-400 px-1 py-0.5 text-center">
                          {calcWorkHours(assignment.startMin, assignment.endMin, assignment.breakMin)}
                        </td>
                        <td className="border border-gray-400 px-1 py-0.5 text-center">
                          {assignment.breakMin && `${assignment.breakMin}分休`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }

          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-size: 9px !important;
          }

          .no-print {
            display: none !important;
          }

          .print-daily-page {
            padding: 0 !important;
          }

          .daily-table {
            page-break-inside: avoid;
            margin-bottom: 8px !important;
          }

          table {
            font-size: 8px !important;
          }

          th, td {
            padding: 1px 2px !important;
          }

          /* Staff name column - larger font */
          table td.staff-name,
          .daily-table td.staff-name {
            font-size: 11px !important;
            font-weight: 500 !important;
          }

          h2 {
            font-size: 10px !important;
            margin-bottom: 2px !important;
          }
        }

        @media screen {
          .print-daily-page {
            max-width: 800px;
            margin: 0 auto;
          }
        }
      `}</style>
    </div>
  );
}
