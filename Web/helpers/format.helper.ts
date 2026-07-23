export const formatFileSize = (bytes: number): string => {
  // If < 1024, show in Bytes
  if (bytes < 1024) return bytes + " B";

  // If < 1MB, show in KB
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";

  // If >= 1MB, show in MB
  return (bytes / 1048576).toFixed(2) + " MB";
};

export function timeAgo(date: Date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const intervals: any = {
    year: 31536000,
    month: 2592000,
    day: 86400,
    hour: 3600,
    minute: 60,
  };
  for (const key in intervals) {
    const value = Math.floor(seconds / intervals[key]);
    if (value >= 1) {
      return `${value} ${key}${value > 1 ? "s" : ""} ago`;
    }
  }
  return "Just now";
}

export const formatDateTime = (date: Date | string | number | undefined): string => {
  if (!date) return "";
  return new Date(date).toLocaleString("vi-VN");
};

export const formatVND = (amount: number | string | undefined): string => {
  if (amount === undefined || amount === null || amount === "") return "0 ₫";
  const num = typeof amount === "number" ? amount : parseFloat(amount);
  if (isNaN(num)) return "0 ₫";
  return num.toLocaleString("vi-VN") + " ₫";
};