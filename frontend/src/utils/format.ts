/**
 * 通用格式化工具函数。
 */
import dayjs from 'dayjs';

/**
 * 格式化日期时间。后端返回的是 ISO 格式字符串。
 */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const d = dayjs(value);
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : '-';
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const d = dayjs(value);
  return d.isValid() ? d.format('YYYY-MM-DD') : '-';
}

/**
 * 格式化数字（保留指定小数位，默认 2 位）。
 */
export function formatNumber(
  value: number | string | null | undefined,
  decimals = 2,
): string {
  if (value === null || value === undefined || value === '') return '-';
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num)) return '-';
  return num.toFixed(decimals);
}

/**
 * 格式化金额（万元）。
 */
export function formatMoney(
  value: number | string | null | undefined,
  decimals = 2,
): string {
  if (value === null || value === undefined || value === '') return '-';
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num)) return '-';
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * 格式化系数（保留 4 位小数）。
 */
export function formatCoeff(value: number | string | null | undefined): string {
  return formatNumber(value, 4);
}

/**
 * 格式化百分比。value 取值 0~1。
 */
export function formatPercent(
  value: number | string | null | undefined,
  decimals = 2,
): string {
  if (value === null || value === undefined || value === '') return '-';
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num)) return '-';
  return `${(num * 100).toFixed(decimals)}%`;
}

/**
 * 从手机号取后 6 位作为初始密码（仅做显示提示用）。
 */
export function initialPasswordFromPhone(phone: string): string {
  return phone ? phone.slice(-6) : '';
}

/**
 * 触发浏览器下载 Blob 为文件。
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 从 Content-Disposition 响应头中提取文件名，失败则返回默认名。
 */
export function extractFilename(disposition: string | undefined, fallback: string): string {
  if (!disposition) return fallback;
  // 支持 filename*=UTF-8''xxx 与 filename="xxx"
  const starMatch = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (starMatch) {
    try {
      return decodeURIComponent(starMatch[1]);
    } catch {
      return starMatch[1];
    }
  }
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  return match ? match[1] : fallback;
}
