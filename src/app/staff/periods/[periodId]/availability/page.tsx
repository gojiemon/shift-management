"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import TimeSelect from "@/components/TimeSelect";
import {
  AVAILABILITY_STATUS_LABELS,
  EARLY_SHIFT_TEMPLATES,
  LATE_SHIFT_TEMPLATES,
  FREE_TEMPLATE,
  BUSINESS_START_MIN,
  BUSINESS_END_MIN,
  minToTimeStr,
} from "@/lib/constants";

type AvailabilityStatus = "UNAVAILABLE" | "AVAILABLE" | "FREE" | "PREFER_OFF";

interface DayAvailability {
  date: string;
  status: AvailabilityStatus;
  startMin: number | null;
  endMin: number | null;
  note: string;
}

interface Period {
  id: string;
  startDate: string;
  endDate: string;
  deadlineAt: string | null;
  isOpen: boolean;
}

export default function AvailabilityPage() {
  const params = useParams();
  const periodId = params.periodId as string;

  const [period, setPeriod] = useState<Period | null>(null);
  const [days, setDays] = useState<DayAvailability[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    try {
      // Fetch period
      const periodRes = await fetch(`/api/periods/${periodId}`);
      if (!periodRes.ok) throw new Error("期間の取得に失敗しました");
      const { period: periodData } = await periodRes.json();
      setPeriod(periodData);

      // Generate all days in period
      const start = parseISO(periodData.startDate);
      const end = parseISO(periodData.endDate);
      const allDays = eachDayOfInterval({ start, end });

      // Fetch existing availability
      const availRes = await fetch(`/api/availability?periodId=${periodId}`);
      const { availabilities } = await availRes.json();

      // Create map of existing data
      const availMap = new Map<string, DayAvailability>();
      for (const a of availabilities) {
        const dateKey = format(parseISO(a.date), "yyyy-MM-dd");
        availMap.set(dateKey, {
          date: dateKey,
          status: a.status,
          startMin: a.startMin,
          endMin: a.endMin,
          note: a.note || "",
        });
      }

      // Merge with all days
      const daysData: DayAvailability[] = allDays.map((d) => {
        const dateKey = format(d, "yyyy-MM-dd");
        return (
          availMap.get(dateKey) || {
            date: dateKey,
            status: "UNAVAILABLE" as AvailabilityStatus,
            startMin: null,
            endMin: null,
            note: "",
          }
        );
      });

      setDays(daysData);
      if (daysData.length > 0) {
        setSelectedDay(daysData[0].date);
      }

      // Check submission status
      const subRes = await fetch(`/api/submissions?periodId=${periodId}`);
      const { submission } = await subRes.json();
      setIsSubmitted(!!submission);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [periodId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateDay = (date: string, updates: Partial<DayAvailability>) => {
    setDays((prev) =>
      prev.map((d) => {
        if (d.date !== date) return d;
        const updated = { ...d, ...updates };

        // Auto-set times for FREE
        if (updates.status === "FREE") {
          updated.startMin = BUSINESS_START_MIN;
          updated.endMin = BUSINESS_END_MIN;
        }
        // Clear times for UNAVAILABLE
        if (updates.status === "UNAVAILABLE") {
          updated.startMin = null;
          updated.endMin = null;
        }
        // Default times for PREFER_OFF
        if (updates.status === "PREFER_OFF" && d.status !== "PREFER_OFF") {
          updated.startMin = BUSINESS_START_MIN;
          updated.endMin = BUSINESS_END_MIN;
        }

        return updated;
      })
    );
  };

  const applyTemplate = (startMin: number, endMin: number) => {
    if (!selectedDay) return;
    updateDay(selectedDay, {
      status: "AVAILABLE",
      startMin,
      endMin,
    });
  };

  const applyFreeTemplate = () => {
    if (!selectedDay) return;
    updateDay(selectedDay, {
      status: "FREE",
      startMin: BUSINESS_START_MIN,
      endMin: BUSINESS_END_MIN,
    });
  };

  const saveAvailability = async () => {
    setSaving(true);
    setError("");

    try {
      const items = days
        .filter((d) => d.status !== "UNAVAILABLE" || d.note)
        .map((d) => ({
          date: d.date,
          status: d.status,
          startMin: d.startMin,
          endMin: d.endMin,
          note: d.note || undefined,
        }));

      const res = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId, items }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "保存に失敗しました");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const [successMessage, setSuccessMessage] = useState("");

  const submitAvailability = async () => {
    setSuccessMessage("");
    await saveAvailability();
    if (error) return;

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "提出に失敗しました");
      }

      setIsSubmitted(true);
      setSuccessMessage(isSubmitted ? "更新しました！" : "提出しました！");
    } catch (err) {
      setError(err instanceof Error ? err.message : "提出に失敗しました");
    }
  };

  if (loading) {
    return <div className="text-center py-8">読み込み中...</div>;
  }

  if (!period) {
    return <div className="text-center py-8 text-red-600">期間が見つかりません</div>;
  }

  const selectedDayData = days.find((d) => d.date === selectedDay);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">シフト希望入力</h1>
          <p className="text-gray-600">
            {format(parseISO(period.startDate), "yyyy/MM/dd (E)", { locale: ja })} 〜{" "}
            {format(parseISO(period.endDate), "yyyy/MM/dd (E)", { locale: ja })}
          </p>
          {period.deadlineAt && (
            <p className="text-sm text-orange-600">
              締切: {format(parseISO(period.deadlineAt), "MM/dd (E) HH:mm", { locale: ja })}
            </p>
          )}
        </div>
        {isSubmitted && (
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
            提出済み
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md">{error}</div>
      )}

      {successMessage && (
        <div className="bg-green-50 text-green-600 p-3 rounded-md font-medium">
          {successMessage}
        </div>
      )}

      {!period.isOpen && (
        <div className="bg-yellow-50 text-yellow-700 p-3 rounded-md">
          この期間は現在受付を停止しています。編集はできません。
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Day list */}
        <div className="card">
          <h2 className="font-semibold mb-3">日付を選択</h2>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {days.map((day) => {
              const date = parseISO(day.date);
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              const statusLabel = AVAILABILITY_STATUS_LABELS[day.status];
              const timeLabel =
                day.status !== "UNAVAILABLE" && day.startMin && day.endMin
                  ? `${minToTimeStr(day.startMin)}-${minToTimeStr(day.endMin)}`
                  : "";

              return (
                <button
                  key={day.date}
                  onClick={() => setSelectedDay(day.date)}
                  className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                    selectedDay === day.date
                      ? "bg-blue-100 border-blue-500"
                      : "hover:bg-gray-100"
                  } ${isWeekend ? "text-red-600" : ""}`}
                >
                  <div className="flex justify-between items-center">
                    <span>
                      {format(date, "M/d (E)", { locale: ja })}
                    </span>
                    <span className="text-sm">
                      <span
                        className={`
                          ${day.status === "FREE" ? "text-green-600" : ""}
                          ${day.status === "AVAILABLE" ? "text-blue-600" : ""}
                          ${day.status === "PREFER_OFF" ? "text-yellow-600" : ""}
                          ${day.status === "UNAVAILABLE" ? "text-gray-400" : ""}
                        `}
                      >
                        {statusLabel}
                      </span>
                      {timeLabel && (
                        <span className="ml-2 text-gray-500">{timeLabel}</span>
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Day detail */}
        <div className="card">
          {selectedDayData ? (
            <>
              <h2 className="font-semibold mb-3">
                {format(parseISO(selectedDayData.date), "M月d日 (E)", { locale: ja })}の希望
              </h2>

              {/* Status selection */}
              <div className="space-y-3">
                <div>
                  <label className="label">ステータス</label>
                  <div className="flex flex-wrap gap-2">
                    {(
                      Object.entries(AVAILABILITY_STATUS_LABELS) as [
                        AvailabilityStatus,
                        string,
                      ][]
                    ).map(([status, label]) => (
                      <button
                        key={status}
                        onClick={() => updateDay(selectedDayData.date, { status })}
                        disabled={!period.isOpen}
                        className={`chip ${
                          selectedDayData.status === status
                            ? "chip-selected"
                            : "chip-default"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time selection (for AVAILABLE and PREFER_OFF) */}
                {(selectedDayData.status === "AVAILABLE" ||
                  selectedDayData.status === "PREFER_OFF") && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <TimeSelect
                        label="開始時間"
                        value={selectedDayData.startMin}
                        onChange={(v) =>
                          updateDay(selectedDayData.date, { startMin: v })
                        }
                        maxTime={selectedDayData.endMin ?? undefined}
                        disabled={!period.isOpen}
                      />
                      <TimeSelect
                        label="終了時間"
                        value={selectedDayData.endMin}
                        onChange={(v) =>
                          updateDay(selectedDayData.date, { endMin: v })
                        }
                        minTime={selectedDayData.startMin ?? undefined}
                        disabled={!period.isOpen}
                      />
                    </div>

                    {/* Templates */}
                    <div>
                      <label className="label">早番テンプレート</label>
                      <div className="flex flex-wrap gap-2">
                        {EARLY_SHIFT_TEMPLATES.map((t) => (
                          <button
                            key={t.label}
                            onClick={() => applyTemplate(t.startMin, t.endMin)}
                            disabled={!period.isOpen}
                            className="chip chip-default text-xs"
                          >
                            {t.label}
                          </button>
                        ))}
                        <button
                          onClick={applyFreeTemplate}
                          disabled={!period.isOpen}
                          className="chip chip-default text-xs bg-green-50"
                        >
                          {FREE_TEMPLATE.label}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="label">遅番テンプレート</label>
                      <div className="flex flex-wrap gap-2">
                        {LATE_SHIFT_TEMPLATES.map((t) => (
                          <button
                            key={t.label}
                            onClick={() => applyTemplate(t.startMin, t.endMin)}
                            disabled={!period.isOpen}
                            className="chip chip-default text-xs"
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Note */}
                <div>
                  <label className="label">メモ（任意）</label>
                  <textarea
                    value={selectedDayData.note}
                    onChange={(e) =>
                      updateDay(selectedDayData.date, { note: e.target.value })
                    }
                    className="input"
                    rows={2}
                    placeholder="備考があれば入力してください"
                    disabled={!period.isOpen}
                  />
                </div>
              </div>
            </>
          ) : (
            <p className="text-gray-500">日付を選択してください</p>
          )}
        </div>
      </div>

      {/* Actions */}
      {period.isOpen && (
        <div className="flex justify-end gap-3">
          <button
            onClick={saveAvailability}
            disabled={saving}
            className="btn btn-secondary"
          >
            {saving ? "保存中..." : "下書き保存"}
          </button>
          <button
            onClick={submitAvailability}
            disabled={saving}
            className="btn btn-primary"
          >
            {isSubmitted ? "更新する" : "提出する"}
          </button>
        </div>
      )}

      {/* Submitted status message */}
      {isSubmitted && period.isOpen && (
        <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm">
          提出済みです。内容を変更した場合は「更新する」ボタンで再提出できます。
        </div>
      )}
    </div>
  );
}
