"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface Staff {
  id: string;
  name: string;
  loginId: string;
  createdAt: string;
  lineLink: { linkedAt: string } | null;
}

interface User {
  name: string;
  role: "ADMIN" | "STAFF";
}

export default function StaffManagementPage() {
  const [user, setUser] = useState<User | null>(null);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add staff form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLoginId, setNewLoginId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);

  // Password reset modal
  const [resetTarget, setResetTarget] = useState<Staff | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetting, setResetting] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [meRes, staffRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/staff"),
      ]);

      if (!meRes.ok) {
        window.location.href = "/login";
        return;
      }

      const meData = await meRes.json();
      if (meData.user.role !== "ADMIN") {
        window.location.href = "/staff/periods";
        return;
      }
      setUser(meData.user);

      if (staffRes.ok) {
        const staffData = await staffRes.json();
        setStaffList(staffData.staff);
      }
    } catch {
      setError("データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    setAdding(true);

    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          loginId: newLoginId,
          password: newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAddError(data.error || "スタッフの追加に失敗しました");
        return;
      }

      // Refresh list
      await fetchData();
      setShowAddForm(false);
      setNewName("");
      setNewLoginId("");
      setNewPassword("");
    } catch {
      setAddError("スタッフの追加に失敗しました");
    } finally {
      setAdding(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    setResetError("");
    setResetting(true);

    try {
      const res = await fetch(`/api/staff/${resetTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResetError(data.error || "パスワードのリセットに失敗しました");
        return;
      }

      setResetTarget(null);
      setResetPassword("");
    } catch {
      setResetError("パスワードのリセットに失敗しました");
    } finally {
      setResetting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/staff/${deleteTarget.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "スタッフの削除に失敗しました");
        return;
      }

      await fetchData();
      setDeleteTarget(null);
    } catch {
      alert("スタッフの削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userName={user.name} userRole={user.role} />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">スタッフ管理</h1>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            スタッフを追加
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  名前
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ログインID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  登録日
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  LINE連携
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {staffList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    スタッフが登録されていません
                  </td>
                </tr>
              ) : (
                staffList.map((staff) => (
                  <tr key={staff.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {staff.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {staff.loginId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(staff.createdAt), "yyyy/MM/dd", { locale: ja })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {staff.lineLink ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          連携済み
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          未連携
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => {
                          setResetTarget(staff);
                          setResetPassword("");
                          setResetError("");
                        }}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        PW変更
                      </button>
                      <button
                        onClick={() => setDeleteTarget(staff)}
                        className="text-red-600 hover:text-red-900"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Add Staff Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold mb-4">スタッフを追加</h2>
            <form onSubmit={handleAddStaff}>
              {addError && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
                  {addError}
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  名前
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ログインID
                </label>
                <input
                  type="text"
                  value={newLoginId}
                  onChange={(e) => setNewLoginId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  minLength={3}
                />
                <p className="mt-1 text-xs text-gray-500">3文字以上</p>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  パスワード
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  minLength={6}
                />
                <p className="mt-1 text-xs text-gray-500">6文字以上</p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setAddError("");
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {adding ? "追加中..." : "追加"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold mb-4">パスワード変更</h2>
            <p className="text-sm text-gray-600 mb-4">
              <span className="font-medium">{resetTarget.name}</span> さんのパスワードを変更します
            </p>
            {resetError && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
                {resetError}
              </div>
            )}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                新しいパスワード
              </label>
              <input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                minLength={6}
              />
              <p className="mt-1 text-xs text-gray-500">6文字以上</p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                キャンセル
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resetting || resetPassword.length < 6}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {resetting ? "変更中..." : "変更"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold mb-4 text-red-600">スタッフを削除</h2>
            <p className="text-sm text-gray-600 mb-2">
              <span className="font-medium">{deleteTarget.name}</span> さんを削除しますか？
            </p>
            <p className="text-sm text-red-600 mb-6">
              この操作は取り消せません。関連するシフト希望・割り当てデータも全て削除されます。
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "削除中..." : "削除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
