"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";

interface Period {
  id: string;
  startDate: string;
  endDate: string;
  deadlineAt: string | null;
  isOpen: boolean;
  publishedAt: string | null;
  submissions: { submittedAt: string }[];
}

export default function StaffPeriodsPage() {
  const router = useRouter();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/staff/periods", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to fetch");
      }
      const data = await res.json();
      setPeriods(data.periods);
    } catch (error) {
      console.error("Failed to load periods:", error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  // 画面表示のたびに最新データを取得
  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return <div className="text-center py-8">読み込み中...</div>;
  }

  const openPeriods = periods.filter((p) => p.isOpen);
  const publishedPeriods = periods.filter((p) => p.publishedAt);
  const otherPeriods = periods.filter((p) => !p.isOpen && !p.publishedAt);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">シフト希望入力</h1>

      {/* Open periods */}
      {openPeriods.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3 text-green-700">
            受付中の期間
          </h2>
          <div className="space-y-3">
            {openPeriods.map((period) => {
              const isSubmitted = period.submissions.length > 0;
              return (
                <div
                  key={period.id}
                  className="card flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {format(parseISO(period.startDate), "yyyy/MM/dd (E)", { locale: ja })} 〜{" "}
                      {format(parseISO(period.endDate), "yyyy/MM/dd (E)", { locale: ja })}
                    </p>
                    {period.deadlineAt && (
                      <p className="text-sm text-gray-500">
                        締切: {format(parseISO(period.deadlineAt), "MM/dd (E) HH:mm", { locale: ja })}
                      </p>
                    )}
                    <p className="text-sm mt-1">
                      {isSubmitted ? (
                        <span className="inline-block px-3 py-1 bg-green-100 text-green-700 font-bold rounded-full">
                          提出完了
                        </span>
                      ) : (
                        <span className="inline-block px-3 py-1 bg-orange-100 text-orange-700 font-bold rounded-full">
                          未提出
                        </span>
                      )}
                    </p>
                  </div>
                  <Link
                    href={`/staff/periods/${period.id}/availability`}
                    className="btn btn-primary"
                  >
                    {isSubmitted ? "編集する" : "入力する"}
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Published periods */}
      {publishedPeriods.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">確定シフト</h2>
          <div className="space-y-3">
            {publishedPeriods.map((period) => (
              <div
                key={period.id}
                className="card flex items-center justify-between"
              >
                <div>
                  <p className="font-medium">
                    {format(parseISO(period.startDate), "yyyy/MM/dd (E)", { locale: ja })} 〜{" "}
                    {format(parseISO(period.endDate), "yyyy/MM/dd (E)", { locale: ja })}
                  </p>
                  <p className="text-sm text-gray-500">
                    公開日: {format(parseISO(period.publishedAt!), "MM/dd (E) HH:mm", { locale: ja })}
                  </p>
                </div>
                <Link
                  href={`/staff/schedule/${period.id}`}
                  className="btn btn-secondary"
                >
                  シフトを見る
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Other periods */}
      {otherPeriods.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3 text-gray-500">
            その他の期間
          </h2>
          <div className="space-y-3">
            {otherPeriods.map((period) => (
              <div key={period.id} className="card opacity-60">
                <p className="font-medium">
                  {format(parseISO(period.startDate), "yyyy/MM/dd (E)", { locale: ja })} 〜{" "}
                  {format(parseISO(period.endDate), "yyyy/MM/dd (E)", { locale: ja })}
                </p>
                <p className="text-sm text-gray-500">受付終了</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {periods.length === 0 && (
        <div className="card text-center text-gray-500">
          <p>現在、登録されている期間はありません</p>
        </div>
      )}
    </div>
  );
}
