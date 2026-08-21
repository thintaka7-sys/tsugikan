import { StorageData, Series } from '../types';

export const CURRENT_SUPPORTED_VERSION = 2;

export type ValidationResult =
  | { valid: true; data: StorageData }
  | { valid: false; error: string };

export function validateStorageData(jsonString: string): ValidationResult {
  if (!jsonString || !jsonString.trim()) {
    return { valid: false, error: 'ファイルが空です。' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return { valid: false, error: 'JSONの形式が正しくありません。ファイルが破損している可能性があります。' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { valid: false, error: 'データ形式が不正です（オブジェクトではありません）。' };
  }

  const candidate = parsed as Record<string, unknown>;

  if (typeof candidate.version !== 'number' || !Number.isInteger(candidate.version)) {
    return { valid: false, error: 'バージョン情報（version）が正しくありません。' };
  }

  if (candidate.version < 1) {
    return { valid: false, error: `未対応の古いバージョン（version: ${candidate.version}）です。` };
  }

  if (candidate.version > CURRENT_SUPPORTED_VERSION) {
    return {
      valid: false,
      error: `未知の新しいバージョン（version: ${candidate.version}）のデータです。アプリを更新してください。`,
    };
  }

  if (!Array.isArray(candidate.series)) {
    return { valid: false, error: 'シリーズ一覧（series）が配列ではありません。' };
  }

  const validSeriesList: Series[] = [];

  for (let i = 0; i < candidate.series.length; i++) {
    const item = candidate.series[i];
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return { valid: false, error: `${i + 1}件目のシリーズデータが不正です。` };
    }

    const s = item as Record<string, unknown>;

    if (typeof s.id !== 'string' || !s.id.trim()) {
      return { valid: false, error: `${i + 1}件目のシリーズのIDが不正です。` };
    }

    if (typeof s.title !== 'string' || !s.title.trim()) {
      return { valid: false, error: `${i + 1}件目のシリーズのタイトルが不正です。` };
    }

    if (
      !Array.isArray(s.ownedVolumes) ||
      !s.ownedVolumes.every((v) => typeof v === 'number' && Number.isInteger(v) && v > 0)
    ) {
      return { valid: false, error: `「${s.title || `${i + 1}件目`}」の所持巻数データが不正です。` };
    }

    if (
      !Array.isArray(s.readVolumes) ||
      !s.readVolumes.every((v) => typeof v === 'number' && Number.isInteger(v) && v >= 0)
    ) {
      return { valid: false, error: `「${s.title || `${i + 1}件目`}」の既読巻数データが不正です。` };
    }

    if (typeof s.updatedAt !== 'number' || isNaN(s.updatedAt)) {
      return { valid: false, error: `「${s.title || `${i + 1}件目`}」の更新日時が不正です。` };
    }

    if (s.reading !== undefined && typeof s.reading !== 'string') {
      return { valid: false, error: `「${s.title || `${i + 1}件目`}」の読みがなデータが不正です。` };
    }

    validSeriesList.push({
      id: s.id.trim(),
      title: s.title.trim(),
      ownedVolumes: s.ownedVolumes,
      readVolumes: s.readVolumes,
      updatedAt: s.updatedAt,
      reading: typeof s.reading === 'string' ? s.reading.trim() : undefined,
    });
  }

  return {
    valid: true,
    data: {
      version: candidate.version,
      series: validSeriesList,
    },
  };
}
