import { Series } from '../types';

export function getMaxVolume(volumes: number[]): number {
  if (!volumes || volumes.length === 0) return 0;
  return Math.max(...volumes);
}

export function getUnreadCount(series: Series): number {
  if (!series.ownedVolumes || series.ownedVolumes.length === 0) return 0;
  const readSet = new Set(series.readVolumes || []);
  return series.ownedVolumes.filter((v) => !readSet.has(v)).length;
}

export function createVolumeArray(count: number): number[] {
  const n = Math.max(0, Math.floor(count));
  return Array.from({ length: n }, (_, i) => i + 1);
}

/**
 * 1から最大巻数までの間で、所持していない巻（抜け巻）の番号配列を取得
 */
export function getMissingVolumes(ownedVolumes: number[]): number[] {
  if (!ownedVolumes || ownedVolumes.length === 0) return [];
  const max = Math.max(...ownedVolumes);
  const ownedSet = new Set(ownedVolumes);
  const missing: number[] = [];

  for (let i = 1; i < max; i++) {
    if (!ownedSet.has(i)) {
      missing.push(i);
    }
  }

  return missing;
}

export type ParseRangeResult =
  | { valid: true; volumes: number[] }
  | { valid: false; error: string };

/**
 * "3", "5-8", "3, 7, 12-14", "１-５，８" などの巻数指定文字列をパース
 */
export function parseVolumeRange(input: string): ParseRangeResult {
  const clean = (input || '')
    .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    .replace(/[，、]/g, ',')
    .replace(/[〜～ー−]/g, '-')
    .trim();

  if (!clean) {
    return { valid: false, error: '巻数を入力してください。' };
  }

  const parts = clean.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
  if (parts.length === 0) {
    return { valid: false, error: '巻数を入力してください。' };
  }

  const resultSet = new Set<number>();

  for (const part of parts) {
    if (part.includes('-')) {
      const rangeParts = part.split('-').map((s) => s.trim());
      if (rangeParts.length !== 2) {
        return { valid: false, error: `範囲指定の形式が正しくありません: "${part}"` };
      }

      const start = parseInt(rangeParts[0], 10);
      const end = parseInt(rangeParts[1], 10);

      if (isNaN(start) || isNaN(end)) {
        return { valid: false, error: `数字を入力してください: "${part}"` };
      }

      if (start <= 0 || end <= 0) {
        return { valid: false, error: '巻数は1以上の整数を指定してください。' };
      }

      if (start > end) {
        return { valid: false, error: `範囲の順序が不正です: "${part}"` };
      }

      if (end - start > 500) {
        return { valid: false, error: '一度に指定できる範囲は500巻以内です。' };
      }

      for (let i = start; i <= end; i++) {
        resultSet.add(i);
      }
    } else {
      const num = parseInt(part, 10);
      if (isNaN(num) || num <= 0) {
        return { valid: false, error: `巻数は1以上の整数を指定してください: "${part}"` };
      }
      resultSet.add(num);
    }
  }

  const sorted = Array.from(resultSet).sort((a, b) => a - b);
  return {
    valid: true,
    volumes: sorted,
  };
}

/**
 * 抜け巻の配列を "13-14", "3, 5, 8-10" のようにフォーマット
 */
export function formatMissingVolumes(missing: number[]): string {
  if (!missing || missing.length === 0) return '';

  const intervals: string[] = [];
  let start = missing[0];
  let end = missing[0];

  for (let i = 1; i < missing.length; i++) {
    if (missing[i] === end + 1) {
      end = missing[i];
    } else {
      intervals.push(start === end ? `${start}` : `${start}-${end}`);
      start = missing[i];
      end = missing[i];
    }
  }
  intervals.push(start === end ? `${start}` : `${start}-${end}`);

  return intervals.join(', ');
}

/**
 * シリーズIDから 1〜6 の背表紙番号を決定的に算出
 */
export function getSpineIndex(seriesId: string): number {
  if (!seriesId) return 1;
  let hash = 0;
  for (let i = 0; i < seriesId.length; i++) {
    hash = (hash << 5) - hash + seriesId.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 6) + 1;
}
