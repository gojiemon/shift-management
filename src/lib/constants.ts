// 営業時間 (分単位: 10:00 = 600, 20:30 = 1230)
export const BUSINESS_START_MIN = 600; // 10:00
export const BUSINESS_END_MIN = 1230; // 20:30
export const TIME_SLOT_INTERVAL = 30; // 30分刻み

// 時間を分に変換
export function timeToMin(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}

// 分を時間文字列に変換 (例: 600 -> "10:00")
export function minToTimeStr(min: number): string {
  const hours = Math.floor(min / 60);
  const minutes = min % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

// 時間文字列を分に変換 (例: "10:00" -> 600)
export function timeStrToMin(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return timeToMin(hours, minutes);
}

// 営業時間内の時間スロットを生成
export function generateTimeSlots(): { value: number; label: string }[] {
  const slots: { value: number; label: string }[] = [];
  for (let min = BUSINESS_START_MIN; min <= BUSINESS_END_MIN; min += TIME_SLOT_INTERVAL) {
    slots.push({ value: min, label: minToTimeStr(min) });
  }
  return slots;
}

// 早番テンプレート
export const EARLY_SHIFT_TEMPLATES = [
  { label: "10:00-13:00", startMin: 600, endMin: 780 },
  { label: "10:00-15:00", startMin: 600, endMin: 900 },
  { label: "10:00-16:00", startMin: 600, endMin: 960 },
  { label: "10:00-17:00", startMin: 600, endMin: 1020 },
];

// 遅番テンプレート
export const LATE_SHIFT_TEMPLATES = [
  { label: "16:00-20:30", startMin: 960, endMin: 1230 },
  { label: "17:00-20:30", startMin: 1020, endMin: 1230 },
  { label: "18:00-20:30", startMin: 1080, endMin: 1230 },
];

// フリーテンプレート
export const FREE_TEMPLATE = {
  label: "フリー (終日OK)",
  startMin: BUSINESS_START_MIN,
  endMin: BUSINESS_END_MIN,
};

// ステータスラベル
export const AVAILABILITY_STATUS_LABELS = {
  UNAVAILABLE: "不可",
  AVAILABLE: "出勤OK",
  FREE: "フリー",
  PREFER_OFF: "できれば休み",
} as const;

// 曜日ラベル
export const DAY_OF_WEEK_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
