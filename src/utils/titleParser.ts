import { Series } from '../types';
import { normalizeForSearch } from './kana';

export type ParsedTitleResult = {
  seriesTitle: string;
  volume: number | null;
  existingSeries: Series | null;
};

/**
 * 漢数字（一〜九十九）を数値に変換
 */
function parseKanjiNumber(str: string): number | null {
  const kanjiDigits: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };

  const clean = str.trim();
  if (!clean) return null;

  if (clean === '十') return 10;

  // 十X (11〜19)
  if (clean.startsWith('十') && clean.length === 2 && kanjiDigits[clean[1]]) {
    return 10 + kanjiDigits[clean[1]];
  }

  // X十 (20, 30, ... 90)
  if (clean.endsWith('十') && clean.length === 2 && kanjiDigits[clean[0]]) {
    return kanjiDigits[clean[0]] * 10;
  }

  // X十Y (21〜99)
  if (clean.length === 3 && clean[1] === '十' && kanjiDigits[clean[0]] && kanjiDigits[clean[2]]) {
    return kanjiDigits[clean[0]] * 10 + kanjiDigits[clean[2]];
  }

  // 単独 1〜9
  if (clean.length === 1 && kanjiDigits[clean]) {
    return kanjiDigits[clean];
  }

  return null;
}

/**
 * 文字列から巻数（数値）を抽出する
 * 算用数字・全角数字・漢数字・上中下に対応
 */
export function extractVolumeFromText(text: string): number | null {
  if (!text) return null;
  const clean = text.trim();

  // 上・中・下 (1, 2, 3)
  if (clean === '上' || clean === '(上)' || clean === '（上）' || clean === '上巻') return 1;
  if (clean === '中' || clean === '(中)' || clean === '（中）' || clean === '中巻') return 2;
  if (clean === '下' || clean === '(下)' || clean === '（下）' || clean === '下巻') return 3;

  // 全角数字を半角に変換
  const normalized = clean.replace(/[０-９]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xfee0)
  );

  // パターン1: カッコ付き "(12)", "（12）"
  const matchParen = normalized.match(/^[（(]\s*(\d+)\s*[)）]$/);
  if (matchParen) {
    const num = parseInt(matchParen[1], 10);
    if (!isNaN(num) && num > 0) return num;
  }

  // パターン2: "第12巻", "12巻", "12", "vol.12"
  const matchNum = normalized.match(/(?:第|vol\.?|v\.?|volume)?\s*(\d+)\s*(?:巻)?/i);
  if (matchNum) {
    const num = parseInt(matchNum[1], 10);
    if (!isNaN(num) && num > 0) {
      return num;
    }
  }

  // パターン3: 漢数字 "第十二巻", "十二巻", "十二"
  const matchKanji = clean.match(/(?:第)?([一二三四五六七八九十]+)(?:巻)?/);
  if (matchKanji) {
    const num = parseKanjiNumber(matchKanji[1]);
    if (num !== null && num > 0) {
      return num;
    }
  }

  return null;
}

/**
 * openBD等の書籍タイトルからシリーズ名と巻数を判定
 */
export function parseBookTitle(
  rawTitle: string,
  existingSeriesList: Series[]
): ParsedTitleResult {
  const trimmedTitle = (rawTitle || '').trim();
  if (!trimmedTitle) {
    return {
      seriesTitle: '',
      volume: null,
      existingSeries: null,
    };
  }

  const normalizedRaw = normalizeForSearch(trimmedTitle);

  // ==========================================
  // ① 既存シリーズとの照合（最優先）
  // ==========================================
  // 一致長が長い既存シリーズから優先して比較
  const sortedCandidates = [...existingSeriesList]
    .map((s) => ({
      series: s,
      normalizedTitle: normalizeForSearch(s.title),
    }))
    .filter((c) => c.normalizedTitle.length > 0)
    .sort((a, b) => b.normalizedTitle.length - a.normalizedTitle.length);

  for (const candidate of sortedCandidates) {
    // 前方一致判定
    if (normalizedRaw.startsWith(candidate.normalizedTitle)) {
      // 既存シリーズ名と前方一致した場合、残りの文字列から巻数を抽出
      const rawPrefixMatch = trimmedTitle.slice(0, candidate.series.title.length);
      const isExactOrClosePrefix =
        normalizeForSearch(rawPrefixMatch) === candidate.normalizedTitle;

      const remainder = isExactOrClosePrefix
        ? trimmedTitle.slice(candidate.series.title.length).trim()
        : trimmedTitle.slice(candidate.normalizedTitle.length).trim();

      const extractedVolume = extractVolumeFromText(remainder);

      // 残りの文字列から巻数が抽出できた場合のみ、そのシリーズへの紐付けを成立させる
      if (extractedVolume !== null) {
        return {
          seriesTitle: candidate.series.title,
          volume: extractedVolume,
          existingSeries: candidate.series,
        };
      }
      // 巻数が抽出できなかった場合（例: 『ONE PIECE FILM RED ノベライズ』など）は
      // ①を失敗扱いとして紐付けず、②の末尾抽出へ進む
    }
  }

  // ==========================================
  // ② 末尾からの巻数抽出（①で見つからなかった場合）
  // ==========================================

  // 1. カッコ付き巻数: "呪術廻戦 (26)", "チェンソーマン（17）", "作品名(上)"
  const parenMatch = trimmedTitle.match(/^(.*?)\s*[（(]([0-9０-９]+|[一二三四五六七八九十]+|上|中|下)[)）]$/);
  if (parenMatch) {
    const prefix = parenMatch[1].trim();
    const volRaw = parenMatch[2];
    const vol = extractVolumeFromText(volRaw);
    if (vol !== null) {
      return {
        seriesTitle: prefix || trimmedTitle,
        volume: vol,
        existingSeries: null,
      };
    }
  }

  // 2. 上・中・下 (末尾): "新世紀エヴァンゲリオン 上", "作品名 上巻"
  const jochugeMatch = trimmedTitle.match(/^(.*?)\s*(上|中|下)(?:巻)?$/);
  if (jochugeMatch) {
    const prefix = jochugeMatch[1].trim();
    const vol = jochugeMatch[2] === '上' ? 1 : jochugeMatch[2] === '中' ? 2 : 3;
    return {
      seriesTitle: prefix || trimmedTitle,
      volume: vol,
      existingSeries: null,
    };
  }

  // 3. 算用数字・全角数字（末尾）: "鬼滅の刃 1", "葬送のフリーレン 13", "作品名 第12巻", "作品名 12巻"
  const trailingNumMatch = trimmedTitle.match(
    /^(.*?)(?:[\s　・_/-]+|(?=[第]))(?:第\s*)?([0-9０-９]+)\s*(?:巻)?$/i
  );
  if (trailingNumMatch) {
    const prefix = trailingNumMatch[1].trim();
    const rawNum = trailingNumMatch[2].replace(/[０-９]/g, (s) =>
      String.fromCharCode(s.charCodeAt(0) - 0xfee0)
    );
    const vol = parseInt(rawNum, 10);
    if (!isNaN(vol) && vol > 0) {
      return {
        seriesTitle: prefix || trimmedTitle,
        volume: vol,
        existingSeries: null,
      };
    }
  }

  // 4. 漢数字（末尾）: "鬼滅の刃 第二十三巻", "作品名 十巻"
  const trailingKanjiMatch = trimmedTitle.match(
    /^(.*?)(?:[\s　・_/-]+|(?=[第]))(?:第\s*)?([一二三四五六七八九十]+)\s*(?:巻)?$/
  );
  if (trailingKanjiMatch) {
    const prefix = trailingKanjiMatch[1].trim();
    const vol = parseKanjiNumber(trailingKanjiMatch[2]);
    if (vol !== null && vol > 0) {
      return {
        seriesTitle: prefix || trimmedTitle,
        volume: vol,
        existingSeries: null,
      };
    }
  }

  // ==========================================
  // ③ 判定不能時は巻数を空欄にして返す（推測で埋めない）
  // ==========================================
  return {
    seriesTitle: trimmedTitle,
    volume: null,
    existingSeries: null,
  };
}
