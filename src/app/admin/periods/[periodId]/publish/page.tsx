"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";

interface Period {
  id: string;
  startDate: string;
  endDate: string;
  deadlineAt: string | null;
  isOpen: boolean;
  publishedAt: string | null;
}

export default function AdminPublishPage() {
  const params = useParams();
  const periodId = params.periodId as string;

  const [period, setPeriod] = useState<Period | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [lineEnabled, setLineEnabled] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [periodRes, lineRes] = await Promise.all([
        fetch(`/api/periods/${periodId}`),
        fetch("/api/line/status"),
      ]);

      if (periodRes.ok) {
        const { period } = await periodRes.json();
        setPeriod(period);
      }

      if (lineRes.ok) {
        const { enabled } = await lineRes.json();
        setLineEnabled(enabled);
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

  const publish = async (sendNotification: boolean) => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/periods/${periodId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publishedAt: new Date().toISOString() }),
      });

      if (res.ok) {
        if (sendNotification && lineEnabled) {
          await fetch("/api/line/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "publish",
              periodId,
            }),
          });
        }
        loadData();
      }
    } catch (error) {
      console.error("Failed to publish:", error);
    } finally {
      setPublishing(false);
    }
  };

  const sendReminder = async () => {
    setSendingReminder(true);
    try {
      await fetch("/api/line/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "reminder",
          periodId,
        }),
      });
      alert("リマインドを送信しました");
    } catch (error) {
      console.error("Failed to send reminder:", error);
    } finally {
      setSendingReminder(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">読み込み中...</div>;
  }

  if (!period) {
    return <div className="text-center py-8 text-red-600">期間が見つかりません</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">公開設定</h1>
          <p className="text-gray-600">
            {format(parseISO(period.startDate), "yyyy/MM/dd (E)", { locale: ja })} 〜{" "}
            {format(parseISO(period.endDate), "MM/dd (E)", { locale: ja })}
          </p>
        </div>
        <Link href="/admin/periods" className="btn btn-secondary">
          戻る
        </Link>
      </div>

      {/* Current status */}
      <div className="card">
        <h2 className="font-semibold mb-4">現在の状態</h2>
        <div className="space-y-2">
          <p>
            受付状態:{" "}
            <span className={period.isOpen ? "text-green-600" : "text-gray-600"}>
              {period.isOpen ? "受付中" : "受付停止"}
            </span>
          </p>
          <p>
            公開状態:{" "}
            {period.publishedAt ? (
              <span className="text-blue-600">
                公開済み ({format(parseISO(period.publishedAt), "yyyy/MM/dd HH:mm", { locale: ja })})
              </span>
            ) : (
              <span className="text-gray-600">未公開</span>
            )}
          </p>
        </div>
      </div>

      {/* Publish */}
      <div className="card">
        <h2 className="font-semibold mb-4">シフト公開</h2>
        {period.publishedAt ? (
          <div className="space-y-3">
            <p className="text-green-600">シフトは既に公開されています。</p>
            <p className="text-sm text-gray-600">
              スタッフは確定シフトを確認できます。
            </p>
            <Link
              href={`/admin/periods/${periodId}/print`}
              className="btn btn-secondary inline-block"
            >
              印刷ページへ
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600">
              シフトを公開すると、スタッフが確定シフトを確認できるようになります。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => publish(false)}
                disabled={publishing}
                className="btn btn-primary"
              >
                {publishing ? "公開中..." : "シフトを公開"}
              </button>
              {lineEnabled && (
                <button
                  onClick={() => publish(true)}
                  disabled={publishing}
                  className="btn btn-success"
                >
                  {publishing ? "公開中..." : "公開 + LINE通知"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* LINE Reminder (only if LINE is enabled) */}
      {lineEnabled && (
        <div className="card">
          <h2 className="font-semibold mb-4">LINE通知</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                提出リマインド
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                未提出のスタッフ（LINE連携済み）にリマインドを送信します。
              </p>
              <button
                onClick={sendReminder}
                disabled={sendingReminder || !period.isOpen}
                className="btn btn-secondary"
              >
                {sendingReminder ? "送信中..." : "リマインドを送信"}
              </button>
              {!period.isOpen && (
                <p className="text-sm text-orange-600 mt-2">
                  ※ 受付中の期間のみ送信できます
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
