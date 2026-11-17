export const DATE_FORMATS = [
  { id: "zh", zh: "2026年11月17日", en: "Chinese date" },
  { id: "iso", zh: "2026-11-17", en: "Year-month-day" },
  { id: "dmy", zh: "17/11/2026", en: "Day/month/year" },
  { id: "en", zh: "Nov 17, 2026", en: "English date" },
] as const;

export type DateFormatId = (typeof DATE_FORMATS)[number]["id"];

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatStampDate(date: Date, id: DateFormatId): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  switch (id) {
    case "zh":
      return `${year}年${month}月${day}日`;
    case "iso":
      return `${year}-${mm}-${dd}`;
    case "dmy":
      return `${dd}/${mm}/${year}`;
    case "en":
      return `${MONTHS[date.getMonth()]} ${day}, ${year}`;
  }
}
