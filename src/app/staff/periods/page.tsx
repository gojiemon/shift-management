import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";
import Link from "next/link";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

// Always fetch fresh data (no caching)
export const dynamic = "force-dynamic";

export default async function StaffPeriodsPage() {
  const user = await requireStaff();

  const periods = await prisma.shiftPeriod.findMany({
    orderBy: { startDate: "desc" },
    include: {
      submissions: {
        where: { staffUserId: user.id },
        select: { submittedAt: true },
      },
    },
  });

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
                      {format(period.startDate, "yyyy/MM/dd (E)", { locale: ja })} 〜{" "}
                      {format(period.endDate, "yyyy/MM/dd (E)", { locale: ja })}
                    </p>
                    {period.deadlineAt && (
                      <p className="text-sm text-gray-500">
                        締切: {format(period.deadlineAt, "MM/dd (E) HH:mm", { locale: ja })}
                      </p>
                    )}
                    <p className="text-sm mt-1">
                      {isSubmitted ? (
                        <span className="text-green-600">提出済み</span>
                      ) : (
                        <span className="text-orange-600">未提出</span>
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
                    {format(period.startDate, "yyyy/MM/dd (E)", { locale: ja })} 〜{" "}
                    {format(period.endDate, "yyyy/MM/dd (E)", { locale: ja })}
                  </p>
                  <p className="text-sm text-gray-500">
                    公開日: {format(period.publishedAt!, "MM/dd (E) HH:mm", { locale: ja })}
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
                  {format(period.startDate, "yyyy/MM/dd (E)", { locale: ja })} 〜{" "}
                  {format(period.endDate, "yyyy/MM/dd (E)", { locale: ja })}
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
