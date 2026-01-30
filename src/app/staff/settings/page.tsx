"use client";

import { useState, useEffect, useCallback } from "react";
import { isLineConfigured } from "@/lib/line";

interface LinkStatus {
  isLinked: boolean;
  linkedAt?: string;
}

export default function StaffSettingsPage() {
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [linkStatus, setLinkStatus] = useState<LinkStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [lineEnabled, setLineEnabled] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/line/link-status");
      if (res.ok) {
        const data = await res.json();
        setLinkStatus(data);
        setLineEnabled(data.lineEnabled);
      }
    } catch (error) {
      console.error("Failed to load link status:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const generateCode = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/line/link-code", {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        setLinkCode(data.code);
        setExpiresAt(data.expiresAt);
      }
    } catch (error) {
      console.error("Failed to generate code:", error);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">読み込み中...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">設定</h1>

      {/* LINE連携 (only show if LINE is configured) */}
      {lineEnabled && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">LINE連携</h2>

          {linkStatus?.isLinked ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                <span className="text-green-700">連携済み</span>
              </div>
              <p className="text-sm text-gray-600">
                LINEでシフトの通知を受け取れます。
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-600">
                LINEと連携すると、シフトの通知を受け取れるようになります。
              </p>

              {linkCode ? (
                <div className="bg-blue-50 p-4 rounded-md space-y-3">
                  <p className="font-medium">連携コード</p>
                  <p className="text-3xl font-mono font-bold text-center tracking-wider">
                    {linkCode}
                  </p>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>1. LINE公式アカウントを友だち追加してください</p>
                    <p>2. トーク画面でこのコードを送信してください</p>
                    <p className="text-orange-600">
                      ※ 有効期限: {expiresAt && new Date(expiresAt).toLocaleString("ja-JP")}
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={generateCode}
                  disabled={generating}
                  className="btn btn-primary"
                >
                  {generating ? "生成中..." : "連携コードを発行"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {!lineEnabled && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">LINE連携</h2>
          <p className="text-gray-500">
            LINE連携は現在設定されていません。
          </p>
        </div>
      )}
    </div>
  );
}
