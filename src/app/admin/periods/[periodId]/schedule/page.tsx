"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { ja } from "date-fns/locale";
import {
  minToTimeStr,
  BUSINESS_START_MIN,
  BUSINESS_END_MIN,
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
  staffUserId: string;
  date: string;
  status: "UNAVAILABLE" | "AVAILABLE" | "FREE" | "PREFER_OFF";
  startMin: number | null;
  endMin: number | null;
}

interface Assignment {
  id: string;
  staffUserId: string;
  date: string;
  startMin: number;
  endMin: number;
  breakMin: number | null;
  breakStartMin: number | null;
  staff: { id: string; name: string };
}

// Timeline constants - 15分単位
const SLOT_INTERVAL = 15;
const SLOT_WIDTH = 15;
const ROW_HEIGHT = 44;
// 営業時間10:00-20:30に合わせて10時〜21時を表示
const HOURS = Array.from({ length: 12 }, (_, i) => i + 10);
const HOUR_WIDTH = SLOT_WIDTH * 4;

type DragMode = "create" | "move" | "resize-start" | "resize-end" | "break-move" | null;

export default function AdminSchedulePage() {
  const params = useParams();
  const periodId = params.periodId as string;

  const [period, setPeriod] = useState<Period | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Selected assignment for break editing
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  // Staff schedule modal
  const [viewStaffId, setViewStaffId] = useState<string | null>(null);

  // Drag state
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [dragStaffId, setDragStaffId] = useState<string | null>(null);
  const [dragAssignmentId, setDragAssignmentId] = useState<string | null>(null);
  const [dragStartMin, setDragStartMin] = useState<number | null>(null);
  const [dragEndMin, setDragEndMin] = useState<number | null>(null);
  const [dragOriginalStart, setDragOriginalStart] = useState<number | null>(null);
  const [dragOriginalEnd, setDragOriginalEnd] = useState<number | null>(null);
  const [dragBreakStartMin, setDragBreakStartMin] = useState<number | null>(null);
  const [dragOriginalBreakStart, setDragOriginalBreakStart] = useState<number | null>(null);
  const dragStartX = useRef<number>(0);
  const timelineRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    try {
      const [periodRes, staffRes, availRes, assignRes] = await Promise.all([
        fetch(`/api/periods/${periodId}`),
        fetch("/api/staff"),
        fetch(`/api/availability?periodId=${periodId}`),
        fetch(`/api/assignments?periodId=${periodId}`),
      ]);

      if (periodRes.ok) {
        const { period } = await periodRes.json();
        setPeriod(period);
        if (!selectedDate) {
          setSelectedDate(format(parseISO(period.startDate), "yyyy-MM-dd"));
        }
      }

      if (staffRes.ok) {
        const { staff } = await staffRes.json();
        setStaff(staff);
      }

      if (availRes.ok) {
        const { availabilities } = await availRes.json();
        setAvailabilities(availabilities);
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
  }, [periodId, selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Convert pixel position to minutes (15分単位)
  const pixelToMin = (px: number): number => {
    const slots = Math.round(px / SLOT_WIDTH);
    return BUSINESS_START_MIN + slots * SLOT_INTERVAL;
  };

  // Convert minutes to pixel position
  const minToPixel = (min: number): number => {
    return ((min - BUSINESS_START_MIN) / SLOT_INTERVAL) * SLOT_WIDTH;
  };

  // Clamp minutes to business hours
  const clampMin = (min: number): number => {
    return Math.max(BUSINESS_START_MIN, Math.min(BUSINESS_END_MIN, min));
  };

  // Get client X from mouse or touch event
  const getClientX = (e: React.MouseEvent | React.TouchEvent): number => {
    if ("touches" in e) {
      return e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX ?? 0;
    }
    return e.clientX;
  };

  // Start drag for creating new assignment
  const startCreateDrag = (clientX: number, rect: DOMRect, staffId: string) => {
    const existingAssignment = assignments.find(
      (a) =>
        a.staffUserId === staffId &&
        format(parseISO(a.date), "yyyy-MM-dd") === selectedDate
    );
    if (existingAssignment) return;

    const x = clientX - rect.left;
    const min = clampMin(pixelToMin(x));

    setDragMode("create");
    setDragStaffId(staffId);
    setDragStartMin(min);
    setDragEndMin(min + SLOT_INTERVAL);
    dragStartX.current = clientX;
  };

  // Start drag for moving assignment
  const startMoveDrag = (clientX: number, assignment: Assignment) => {
    setDragMode("move");
    setDragAssignmentId(assignment.id);
    setDragStaffId(assignment.staffUserId);
    setDragStartMin(assignment.startMin);
    setDragEndMin(assignment.endMin);
    setDragOriginalStart(assignment.startMin);
    setDragOriginalEnd(assignment.endMin);
    dragStartX.current = clientX;
  };

  // Start drag for resizing
  const startResizeDrag = (clientX: number, assignment: Assignment, edge: "start" | "end") => {
    setDragMode(edge === "start" ? "resize-start" : "resize-end");
    setDragAssignmentId(assignment.id);
    setDragStaffId(assignment.staffUserId);
    setDragStartMin(assignment.startMin);
    setDragEndMin(assignment.endMin);
    setDragOriginalStart(assignment.startMin);
    setDragOriginalEnd(assignment.endMin);
    dragStartX.current = clientX;
  };

  // Start drag for moving break
  const startBreakDrag = (clientX: number, assignment: Assignment) => {
    if (!assignment.breakMin) return;
    // Calculate default break start if not set
    const shiftDuration = assignment.endMin - assignment.startMin;
    const breakStart = assignment.breakStartMin ??
      (assignment.startMin + Math.floor((shiftDuration - assignment.breakMin) / 2 / SLOT_INTERVAL) * SLOT_INTERVAL);

    setDragMode("break-move");
    setDragAssignmentId(assignment.id);
    setDragStaffId(assignment.staffUserId);
    setDragStartMin(assignment.startMin);
    setDragEndMin(assignment.endMin);
    setDragBreakStartMin(breakStart);
    setDragOriginalBreakStart(breakStart);
    dragStartX.current = clientX;
  };

  // Mouse event handlers
  const handleRowMouseDown = (e: React.MouseEvent, staffId: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    startCreateDrag(e.clientX, rect, staffId);
  };

  const handleBarMouseDown = (e: React.MouseEvent, assignment: Assignment) => {
    e.stopPropagation();
    e.preventDefault();
    startMoveDrag(e.clientX, assignment);
  };

  const handleResizeMouseDown = (e: React.MouseEvent, assignment: Assignment, edge: "start" | "end") => {
    e.stopPropagation();
    e.preventDefault();
    startResizeDrag(e.clientX, assignment, edge);
  };

  // Touch event handlers
  const handleRowTouchStart = (e: React.TouchEvent, staffId: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = getClientX(e);
    startCreateDrag(clientX, rect, staffId);
  };

  const handleBarTouchStart = (e: React.TouchEvent, assignment: Assignment) => {
    e.stopPropagation();
    const clientX = getClientX(e);
    startMoveDrag(clientX, assignment);
  };

  const handleResizeTouchStart = (e: React.TouchEvent, assignment: Assignment, edge: "start" | "end") => {
    e.stopPropagation();
    const clientX = getClientX(e);
    startResizeDrag(clientX, assignment, edge);
  };

  // Break drag event handlers
  const handleBreakMouseDown = (e: React.MouseEvent, assignment: Assignment) => {
    e.stopPropagation();
    e.preventDefault();
    startBreakDrag(e.clientX, assignment);
  };

  const handleBreakTouchStart = (e: React.TouchEvent, assignment: Assignment) => {
    e.stopPropagation();
    const clientX = getClientX(e);
    startBreakDrag(clientX, assignment);
  };

  // Handle move (mouse and touch)
  const handleMove = (clientX: number, containerRect: DOMRect) => {
    if (!dragMode) return;

    const deltaX = clientX - dragStartX.current;
    const deltaMin = Math.round(deltaX / SLOT_WIDTH) * SLOT_INTERVAL;

    if (dragMode === "create") {
      const x = clientX - containerRect.left;
      const min = clampMin(pixelToMin(x));
      setDragEndMin(min);
    } else if (dragMode === "move" && dragOriginalStart !== null && dragOriginalEnd !== null) {
      const duration = dragOriginalEnd - dragOriginalStart;
      let newStart = dragOriginalStart + deltaMin;
      let newEnd = newStart + duration;

      if (newStart < BUSINESS_START_MIN) {
        newStart = BUSINESS_START_MIN;
        newEnd = newStart + duration;
      }
      if (newEnd > BUSINESS_END_MIN) {
        newEnd = BUSINESS_END_MIN;
        newStart = newEnd - duration;
      }

      setDragStartMin(newStart);
      setDragEndMin(newEnd);
    } else if (dragMode === "resize-start" && dragOriginalStart !== null && dragEndMin !== null) {
      let newStart = clampMin(dragOriginalStart + deltaMin);
      if (newStart >= dragEndMin - SLOT_INTERVAL) {
        newStart = dragEndMin - SLOT_INTERVAL;
      }
      setDragStartMin(newStart);
    } else if (dragMode === "resize-end" && dragOriginalEnd !== null && dragStartMin !== null) {
      let newEnd = clampMin(dragOriginalEnd + deltaMin);
      if (newEnd <= dragStartMin + SLOT_INTERVAL) {
        newEnd = dragStartMin + SLOT_INTERVAL;
      }
      setDragEndMin(newEnd);
    } else if (dragMode === "break-move" && dragOriginalBreakStart !== null && dragStartMin !== null && dragEndMin !== null) {
      // Find the assignment to get break duration
      const assignment = assignments.find((a) => a.id === dragAssignmentId);
      if (assignment && assignment.breakMin) {
        let newBreakStart = dragOriginalBreakStart + deltaMin;
        // Clamp to shift bounds
        newBreakStart = Math.max(dragStartMin, Math.min(dragEndMin - assignment.breakMin, newBreakStart));
        // Round to 15 min intervals
        newBreakStart = Math.round(newBreakStart / SLOT_INTERVAL) * SLOT_INTERVAL;
        setDragBreakStartMin(newBreakStart);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragMode || !timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    handleMove(e.clientX, rect);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragMode || !timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clientX = getClientX(e);
    handleMove(clientX, rect);
  };

  // Handle end (mouse up and touch end)
  const handleEnd = () => {
    if (!dragMode || !selectedDate || dragStartMin === null || dragEndMin === null) {
      resetDrag();
      return;
    }

    const startMin = Math.min(dragStartMin, dragEndMin);
    const endMin = Math.max(dragStartMin, dragEndMin);

    if (endMin - startMin < SLOT_INTERVAL) {
      resetDrag();
      return;
    }

    // 値をキャプチャしてからドラッグ状態を即座にリセット
    const mode = dragMode;
    const staffId = dragStaffId;
    const assignmentId = dragAssignmentId;
    const breakStart = dragBreakStartMin;

    // ドラッグ状態を即リセット（マウス移動に反応しなくなる）
    resetDrag();

    // 移動/リサイズの場合、UIを先に更新（楽観的更新）
    if ((mode === "move" || mode === "resize-start" || mode === "resize-end") && assignmentId) {
      setAssignments((prev) =>
        prev.map((a) => (a.id === assignmentId ? { ...a, startMin, endMin } : a))
      );
    } else if (mode === "break-move" && assignmentId && breakStart !== null) {
      setAssignments((prev) =>
        prev.map((a) => (a.id === assignmentId ? { ...a, breakStartMin: breakStart } : a))
      );
    }

    // バックグラウンドでAPI保存
    (async () => {
      try {
        if (mode === "create" && staffId) {
          const res = await fetch("/api/assignments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              periodId,
              staffUserId: staffId,
              date: selectedDate,
              startMin,
              endMin,
            }),
          });

          if (res.ok) {
            const { assignment } = await res.json();
            setAssignments((prev) => [...prev, assignment]);
          } else {
            const data = await res.json();
            alert(data.error || "シフトの作成に失敗しました");
          }
        } else if ((mode === "move" || mode === "resize-start" || mode === "resize-end") && assignmentId) {
          const res = await fetch(`/api/assignments/${assignmentId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ startMin, endMin }),
          });

          if (res.ok) {
            const { assignment } = await res.json();
            setAssignments((prev) =>
              prev.map((a) => (a.id === assignmentId ? assignment : a))
            );
          } else {
            const data = await res.json();
            alert(data.error || "シフトの更新に失敗しました");
            // 失敗時はデータを再読み込み
            loadData();
          }
        } else if (mode === "break-move" && assignmentId && breakStart !== null) {
          const res = await fetch(`/api/assignments/${assignmentId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ breakStartMin: breakStart }),
          });

          if (res.ok) {
            const { assignment } = await res.json();
            setAssignments((prev) =>
              prev.map((a) => (a.id === assignmentId ? assignment : a))
            );
          } else {
            const data = await res.json();
            alert(data.error || "休憩位置の更新に失敗しました");
            loadData();
          }
        }
      } catch (error) {
        console.error("Failed to save assignment:", error);
        loadData();
      }
    })();
  };

  const resetDrag = () => {
    setDragMode(null);
    setDragStaffId(null);
    setDragAssignmentId(null);
    setDragStartMin(null);
    setDragEndMin(null);
    setDragOriginalStart(null);
    setDragOriginalEnd(null);
    setDragBreakStartMin(null);
    setDragOriginalBreakStart(null);
  };

  const deleteAssignment = async (assignmentId: string) => {
    if (!confirm("このシフトを削除しますか？")) return;

    try {
      const res = await fetch(`/api/assignments/${assignmentId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
        if (selectedAssignmentId === assignmentId) {
          setSelectedAssignmentId(null);
        }
      }
    } catch (error) {
      console.error("Failed to delete assignment:", error);
    }
  };

  const updateBreak = async (assignmentId: string, breakMin: number | null) => {
    try {
      const res = await fetch(`/api/assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ breakMin }),
      });

      if (res.ok) {
        const { assignment } = await res.json();
        setAssignments((prev) =>
          prev.map((a) => (a.id === assignment.id ? assignment : a))
        );
      } else {
        const data = await res.json();
        alert(data.error || "休憩の更新に失敗しました");
      }
    } catch (error) {
      console.error("Failed to update break:", error);
    }
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

  const getAvailability = (staffId: string) => {
    return availabilities.find(
      (a) =>
        a.staffUserId === staffId &&
        format(parseISO(a.date), "yyyy-MM-dd") === selectedDate
    );
  };

  const getStaffAssignment = (staffId: string) => {
    return assignments.find(
      (a) =>
        a.staffUserId === staffId &&
        format(parseISO(a.date), "yyyy-MM-dd") === selectedDate
    );
  };

  const getVisualAssignment = (staffId: string) => {
    const assignment = getStaffAssignment(staffId);
    // Create mode - no assignment to show
    if (dragMode === "create" && dragStaffId === staffId) {
      return null;
    }
    // Break move or shift move/resize - update the assignment visually
    if (assignment && dragAssignmentId === assignment.id) {
      if (dragMode === "break-move" && dragBreakStartMin !== null) {
        return {
          ...assignment,
          breakStartMin: dragBreakStartMin,
        };
      }
      if (dragStartMin !== null && dragEndMin !== null) {
        return {
          ...assignment,
          startMin: Math.min(dragStartMin, dragEndMin),
          endMin: Math.max(dragStartMin, dragEndMin),
        };
      }
    }
    return assignment;
  };

  const timelineWidth = HOURS.length * HOUR_WIDTH;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">シフト作成</h1>
          <p className="text-gray-600">
            {format(parseISO(period.startDate), "yyyy/MM/dd", { locale: ja })} 〜{" "}
            {format(parseISO(period.endDate), "MM/dd", { locale: ja })}
          </p>
        </div>
        <Link href="/admin/periods" className="btn btn-secondary">
          戻る
        </Link>
      </div>

      {/* Date selector */}
      <div className="card">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">日付:</span>
          {days.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            const isSelected = selectedDate === dateKey;
            const dayAssignCount = assignments.filter(
              (a) => format(parseISO(a.date), "yyyy-MM-dd") === dateKey
            ).length;

            return (
              <button
                key={dateKey}
                onClick={() => setSelectedDate(dateKey)}
                className={`px-3 py-2 rounded-md text-sm whitespace-nowrap transition-colors ${
                  isSelected
                    ? "bg-blue-600 text-white"
                    : isWeekend
                      ? "bg-red-50 text-red-600 hover:bg-red-100"
                      : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                {format(day, "M/d(E)", { locale: ja })}
                {dayAssignCount > 0 && (
                  <span className="ml-1 text-xs opacity-75">({dayAssignCount})</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Gantt chart */}
      <div className="card overflow-hidden select-none touch-none">
        <div className="flex">
          {/* Staff names column */}
          <div className="flex-shrink-0 border-r border-gray-300 bg-gray-50 z-10">
            <div className="h-10 border-b border-gray-300 px-3 flex items-center">
              <span className="text-sm font-medium">名前</span>
            </div>
            {staff.map((s) => {
              const avail = getAvailability(s.id);
              const statusColor = !avail || avail.status === "UNAVAILABLE"
                ? "bg-gray-100"
                : avail.status === "PREFER_OFF"
                  ? "bg-yellow-50"
                  : "bg-white";
              return (
                <div
                  key={s.id}
                  className={`border-b border-gray-200 px-3 flex items-center ${statusColor}`}
                  style={{ height: ROW_HEIGHT }}
                >
                  <button
                    className="text-sm font-medium truncate w-24 text-left hover:text-blue-600 hover:underline"
                    onClick={() => setViewStaffId(s.id)}
                  >
                    {s.name}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Timeline area */}
          <div className="flex-1 overflow-x-auto">
            <div
              ref={timelineRef}
              style={{ width: timelineWidth }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleEnd}
              onMouseLeave={() => dragMode && handleEnd()}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleEnd}
              onTouchCancel={handleEnd}
            >
              {/* Hour headers */}
              <div className="flex h-10 border-b border-gray-300 bg-gray-50">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="flex-shrink-0 border-l border-gray-300 flex items-end justify-start pb-1 pl-1"
                    style={{ width: HOUR_WIDTH }}
                  >
                    <span className="text-xs text-gray-600">{hour}</span>
                  </div>
                ))}
              </div>

              {/* Staff rows */}
              {staff.map((s) => {
                const avail = getAvailability(s.id);
                const visualAssignment = getVisualAssignment(s.id);
                const statusColor = !avail || avail.status === "UNAVAILABLE"
                  ? "bg-gray-100"
                  : avail.status === "PREFER_OFF"
                    ? "bg-yellow-50"
                    : "bg-white";

                const showDragPreview = dragMode === "create" && dragStaffId === s.id && dragStartMin !== null && dragEndMin !== null;

                return (
                  <div
                    key={s.id}
                    className={`relative border-b border-gray-200 ${statusColor} ${
                      visualAssignment ? "cursor-default" : "cursor-crosshair"
                    }`}
                    style={{ height: ROW_HEIGHT, width: timelineWidth }}
                    onMouseDown={(e) => handleRowMouseDown(e, s.id)}
                    onTouchStart={(e) => handleRowTouchStart(e, s.id)}
                  >
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {HOURS.map((hour, idx) => (
                        <div
                          key={hour}
                          className="flex-shrink-0 border-l border-gray-200 relative"
                          style={{ width: HOUR_WIDTH }}
                        >
                          <div
                            className="absolute border-l border-gray-100 h-full"
                            style={{ left: HOUR_WIDTH / 2 }}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Availability bar (blue line) */}
                    {avail && avail.status !== "UNAVAILABLE" && (() => {
                      // FREEの場合は営業時間全体、それ以外はstartMin/endMinを使用
                      const barStart = avail.status === "FREE" ? BUSINESS_START_MIN : avail.startMin;
                      const barEnd = avail.status === "FREE" ? BUSINESS_END_MIN : avail.endMin;
                      if (barStart == null || barEnd == null) return null;
                      return (
                        <div
                          className="absolute h-1.5 bg-blue-400 rounded-full pointer-events-none"
                          style={{
                            left: minToPixel(barStart),
                            width: minToPixel(barEnd) - minToPixel(barStart),
                            top: "50%",
                            transform: "translateY(-50%)",
                          }}
                        />
                      );
                    })()}

                    {/* Assignment bar */}
                    {visualAssignment && (() => {
                      const barWidth = minToPixel(visualAssignment.endMin) - minToPixel(visualAssignment.startMin);
                      const shiftDuration = visualAssignment.endMin - visualAssignment.startMin;
                      const breakWidth = visualAssignment.breakMin
                        ? minToPixel(visualAssignment.breakMin) - minToPixel(0)
                        : 0;
                      // 休憩開始位置（シフトバー内の相対位置）- デフォルトは中央
                      const defaultBreakStart = visualAssignment.breakMin
                        ? visualAssignment.startMin + Math.floor((shiftDuration - visualAssignment.breakMin) / 2 / SLOT_INTERVAL) * SLOT_INTERVAL
                        : visualAssignment.startMin;
                      const breakStartPos = visualAssignment.breakStartMin ?? defaultBreakStart;
                      const breakLeft = visualAssignment.breakMin
                        ? minToPixel(breakStartPos) - minToPixel(visualAssignment.startMin)
                        : 0;
                      const isSelected = selectedAssignmentId === visualAssignment.id;

                      return (
                        <div
                          className={`absolute top-1 bottom-1 bg-gray-800 rounded flex items-center justify-center cursor-move active:bg-gray-700 ${
                            isSelected ? "ring-2 ring-blue-500 ring-offset-1" : ""
                          }`}
                          style={{
                            left: minToPixel(visualAssignment.startMin),
                            width: barWidth,
                          }}
                          onMouseDown={(e) => handleBarMouseDown(e, visualAssignment)}
                          onTouchStart={(e) => handleBarTouchStart(e, visualAssignment)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAssignmentId(isSelected ? null : visualAssignment.id);
                          }}
                          onDoubleClick={() => deleteAssignment(visualAssignment.id)}
                        >
                          {/* Break overlay (red bar) - draggable */}
                          {visualAssignment.breakMin && breakWidth > 0 && (
                            <div
                              className="absolute top-0 bottom-0 bg-red-500 rounded cursor-ew-resize hover:bg-red-400 z-20"
                              style={{
                                left: breakLeft,
                                width: breakWidth,
                              }}
                              onMouseDown={(e) => handleBreakMouseDown(e, visualAssignment)}
                              onTouchStart={(e) => handleBreakTouchStart(e, visualAssignment)}
                            >
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-0.5 h-3 bg-red-300 rounded mx-0.5" />
                                <div className="w-0.5 h-3 bg-red-300 rounded mx-0.5" />
                              </div>
                            </div>
                          )}
                          {/* Left resize handle */}
                          <div
                            className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center z-10"
                            onMouseDown={(e) => handleResizeMouseDown(e, visualAssignment, "start")}
                            onTouchStart={(e) => handleResizeTouchStart(e, visualAssignment, "start")}
                          >
                            <div className="w-1 h-4 bg-gray-500 rounded opacity-50" />
                          </div>
                          {/* Center content */}
                          <span className="text-white text-xs font-medium truncate px-5 z-10 pointer-events-none">
                            {minToTimeStr(visualAssignment.startMin)}-{minToTimeStr(visualAssignment.endMin)}
                            {visualAssignment.breakMin && (
                              <span className="text-red-200 ml-1">({visualAssignment.breakMin}分休)</span>
                            )}
                          </span>
                          {/* Right resize handle */}
                          <div
                            className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center z-10"
                            onMouseDown={(e) => handleResizeMouseDown(e, visualAssignment, "end")}
                            onTouchStart={(e) => handleResizeTouchStart(e, visualAssignment, "end")}
                          >
                            <div className="w-1 h-4 bg-gray-500 rounded opacity-50" />
                          </div>
                        </div>
                      );
                    })()}

                    {/* Drag preview */}
                    {showDragPreview && (
                      <div
                        className="absolute top-1 bottom-1 bg-blue-500 opacity-60 rounded pointer-events-none"
                        style={{
                          left: minToPixel(Math.min(dragStartMin, dragEndMin)),
                          width: Math.max(SLOT_WIDTH, Math.abs(minToPixel(dragEndMin) - minToPixel(dragStartMin))),
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary column */}
          <div className="flex-shrink-0 border-l border-gray-300 bg-gray-50">
            <div className="h-10 border-b border-gray-300 px-2 flex items-center">
              <span className="text-xs font-medium text-gray-600">出退勤</span>
            </div>
            {staff.map((s) => {
              const assignment = getStaffAssignment(s.id);
              return (
                <div
                  key={s.id}
                  className="border-b border-gray-200 px-2 flex items-center text-xs"
                  style={{ height: ROW_HEIGHT }}
                >
                  {assignment ? (
                    <div className="whitespace-nowrap">
                      <span className="text-blue-600">
                        {minToTimeStr(assignment.startMin)}-{minToTimeStr(assignment.endMin)}
                      </span>
                      {assignment.breakMin && (
                        <span className="text-red-500 ml-1">({assignment.breakMin}休)</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-6 h-1.5 bg-blue-400 rounded-full"></div>
            <span>希望</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-5 bg-gray-800 rounded"></div>
            <span>シフト</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-5 bg-red-500 rounded"></div>
            <span>休憩</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-100 border"></div>
            <span>不可</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-50 border"></div>
            <span>休希望</span>
          </div>
        </div>
      </div>

      {/* Break selection panel */}
      {selectedAssignmentId && (() => {
        const selectedAssignment = assignments.find((a) => a.id === selectedAssignmentId);
        if (!selectedAssignment) return null;
        const shiftDuration = selectedAssignment.endMin - selectedAssignment.startMin;

        return (
          <div className="card bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <span className="font-medium">{selectedAssignment.staff.name}</span>
                <span className="text-gray-600 ml-2">
                  {minToTimeStr(selectedAssignment.startMin)}-{minToTimeStr(selectedAssignment.endMin)}
                </span>
                {selectedAssignment.breakMin && (
                  <span className="text-red-600 ml-2">（現在: {selectedAssignment.breakMin}分休憩）</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">休憩:</span>
                <button
                  onClick={() => updateBreak(selectedAssignmentId, null)}
                  className={`px-3 py-1.5 rounded text-sm ${
                    selectedAssignment.breakMin === null
                      ? "bg-gray-800 text-white"
                      : "bg-white border hover:bg-gray-100"
                  }`}
                >
                  なし
                </button>
                {[30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => updateBreak(selectedAssignmentId, mins)}
                    disabled={mins >= shiftDuration}
                    className={`px-3 py-1.5 rounded text-sm ${
                      selectedAssignment.breakMin === mins
                        ? "bg-red-500 text-white"
                        : mins >= shiftDuration
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-white border hover:bg-red-50"
                    }`}
                  >
                    {mins}分
                  </button>
                ))}
                <button
                  onClick={() => setSelectedAssignmentId(null)}
                  className="ml-2 px-2 py-1.5 text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Usage hint */}
      <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
        <p><strong>PC:</strong> ドラッグで作成・移動・伸縮、ダブルクリックで削除</p>
        <p><strong>スマホ:</strong> タッチ&ドラッグで操作、長押しは不要</p>
        <p><strong>休憩:</strong> シフトをクリックして選択後、休憩時間を設定。赤いバーをドラッグで移動可能</p>
      </div>

      {/* Daily summary */}
      {selectedDate && (
        <div className="card">
          <h3 className="font-semibold mb-3">
            {format(parseISO(selectedDate), "M月d日 (E)", { locale: ja })} のサマリー
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">出勤:</span>
              <span className="ml-2 font-medium">
                {assignments.filter((a) => format(parseISO(a.date), "yyyy-MM-dd") === selectedDate).length}人
              </span>
            </div>
            <div>
              <span className="text-gray-500">フリー:</span>
              <span className="ml-2 font-medium text-green-600">
                {availabilities.filter(
                  (a) =>
                    format(parseISO(a.date), "yyyy-MM-dd") === selectedDate &&
                    a.status === "FREE"
                ).length}人
              </span>
            </div>
            <div>
              <span className="text-gray-500">OK:</span>
              <span className="ml-2 font-medium text-blue-600">
                {availabilities.filter(
                  (a) =>
                    format(parseISO(a.date), "yyyy-MM-dd") === selectedDate &&
                    a.status === "AVAILABLE"
                ).length}人
              </span>
            </div>
            <div>
              <span className="text-gray-500">休希望:</span>
              <span className="ml-2 font-medium text-yellow-600">
                {availabilities.filter(
                  (a) =>
                    format(parseISO(a.date), "yyyy-MM-dd") === selectedDate &&
                    a.status === "PREFER_OFF"
                ).length}人
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Staff schedule modal */}
      {viewStaffId && (() => {
        const viewStaff = staff.find((s) => s.id === viewStaffId);
        if (!viewStaff) return null;

        const staffAssignments = assignments
          .filter((a) => a.staffUserId === viewStaffId)
          .sort((a, b) => a.date.localeCompare(b.date));

        const totalWorkMin = staffAssignments.reduce((sum, a) => {
          return sum + (a.endMin - a.startMin - (a.breakMin || 0));
        }, 0);
        const totalHours = Math.floor(totalWorkMin / 60);
        const totalMins = totalWorkMin % 60;

        return (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setViewStaffId(null)}
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-bold">{viewStaff.name} のシフト一覧</h2>
                <button
                  onClick={() => setViewStaffId(null)}
                  className="text-gray-500 hover:text-gray-700 text-xl"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 overflow-y-auto flex-1">
                {staffAssignments.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">シフトはまだありません</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="pb-2">日付</th>
                        <th className="pb-2">時間</th>
                        <th className="pb-2">実働</th>
                        <th className="pb-2">休憩</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffAssignments.map((a) => {
                        const workMin = a.endMin - a.startMin - (a.breakMin || 0);
                        const wH = Math.floor(workMin / 60);
                        const wM = workMin % 60;
                        const dateObj = parseISO(a.date);
                        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

                        return (
                          <tr
                            key={a.id}
                            className={`border-b hover:bg-gray-50 cursor-pointer ${
                              format(dateObj, "yyyy-MM-dd") === selectedDate ? "bg-blue-50" : ""
                            }`}
                            onClick={() => {
                              setSelectedDate(format(dateObj, "yyyy-MM-dd"));
                              setViewStaffId(null);
                            }}
                          >
                            <td className={`py-2 ${isWeekend ? "text-red-600" : ""}`}>
                              {format(dateObj, "M/d(E)", { locale: ja })}
                            </td>
                            <td className="py-2">
                              {minToTimeStr(a.startMin)}-{minToTimeStr(a.endMin)}
                            </td>
                            <td className="py-2">{wH}:{wM.toString().padStart(2, "0")}</td>
                            <td className="py-2 text-red-500">
                              {a.breakMin ? `${a.breakMin}分` : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="p-4 border-t bg-gray-50 rounded-b-lg">
                <div className="flex justify-between text-sm font-medium">
                  <span>出勤日数: {staffAssignments.length}日</span>
                  <span>合計実働: {totalHours}時間{totalMins > 0 ? `${totalMins}分` : ""}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
