"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const res = await fetch("/api/setup");
        const data = await res.json();
        if (!data.setupRequired) {
          router.push("/login");
        } else {
          setSetupRequired(true);
        }
      } catch {
        setError("確認に失敗しました");
      } finally {
        setLoading(false);
      }
    };
    checkSetup();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }

    if (password.length < 6) {
      setError("パスワードは6文字以上必要です");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPassword: password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "セットアップに失敗しました");
      }

      alert("セットアップ完了！ログインIDは「admin」です。");
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">読み込み中...</div>;
  }

  if (!setupRequired) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">初期セットアップ</h1>
        <p className="text-gray-600 mb-6 text-center">
          管理者アカウントを作成します。<br />
          ログインIDは「admin」になります。
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">管理者パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="6文字以上"
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="label">パスワード（確認）</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input"
              placeholder="もう一度入力"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary w-full"
          >
            {submitting ? "セットアップ中..." : "セットアップ完了"}
          </button>
        </form>
      </div>
    </div>
  );
}
