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
 * 文字列が純粋な巻数表現のみで構成されているかを判定
 * （「外伝」「公式ファンブック」などの文字が混入している場合は false）
 */
export function isPureVolumeRemainder(text: string): boolean {
  if (!text) return false;
  const clean = text
    .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    .replace(/[＃]/g, '#')
    .trim();

  if (!clean) return false;

  // 許容される純粋な巻数パターン
  // 例: "13", "(13)", "（13）", "第13巻", "13巻", "#13", "volume 13", "volume13", "VOLUME.13", "vol 13", "vol.13", "Vol,13", "v.13", "上", "中", "下", "上巻", "中巻", "下巻", "第十三巻"
  const purePattern =
    /^[（(]?(?:[\s　・_/-]|第|vol\.?|v\.?|volume|#)*\s*(?:\d+|[一二三四五六七八九十]+|上|中|下)(?:\s*巻)?\s*[)）]?$/i;

  return purePattern.test(clean);
}

/**
 * 文字列から巻数（数値）を抽出する
 * 算用数字・全角数字・漢数字・上中下・volume / vol / # 表記に対応
 */
export function extractVolumeFromText(text: string): number | null {
  if (!text) return null;
  const clean = text.trim();

  // 上・中・下 (1, 2, 3)
  if (clean === '上' || clean === '(上)' || clean === '（上）' || clean === '上巻') return 1;
  if (clean === '中' || clean === '(中)' || clean === '（中）' || clean === '中巻') return 2;
  if (clean === '下' || clean === '(下)' || clean === '（下）' || clean === '下巻') return 3;

  // 全角数字・記号を半角に正規化
  const normalized = clean
    .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    .replace(/[＃]/g, '#');

  // パターン1: カッコ付き "(12)", "（12）"
  const matchParen = normalized.match(/^[（(]\s*(\d+)\s*[)）]$/);
  if (matchParen) {
    const num = parseInt(matchParen[1], 10);
    if (!isNaN(num) && num > 0) return num;
  }

  // パターン2: "volume 7", "volume7", "VOLUME.7", "Volume,7", "vol 7", "vol.7", "Vol,7", "v.7", "v7", "#7", "第12巻", "12巻"
  const matchVolumeNotation = normalized.match(
    /(?:第|volume|vol|v|[#])\s*[.,]?\s*(\d+)\s*(?:巻)?/i
  );
  if (matchVolumeNotation) {
    const num = parseInt(matchVolumeNotation[1], 10);
    if (!isNaN(num) && num > 0) {
      return num;
    }
  }

  // パターン3: 単純な数字 "12", "12巻"
  const matchSimpleNum = normalized.match(/^(\d+)\s*(?:巻)?$/);
  if (matchSimpleNum) {
    const num = parseInt(matchSimpleNum[1], 10);
    if (!isNaN(num) && num > 0) {
      return num;
    }
  }

  // パターン4: 漢数字 "第十二巻", "十二巻", "十二"
  const matchKanji = clean.match(/^(?:第)?([一二三四五六七八九十]+)(?:巻)?$/);
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
      // 既存シリーズ名を除いた残りの文字列を抽出
      const rawPrefixMatch = trimmedTitle.slice(0, candidate.series.title.length);
      const isExactOrClosePrefix =
        normalizeForSearch(rawPrefixMatch) === candidate.normalizedTitle;

      const remainder = isExactOrClosePrefix
        ? trimmedTitle.slice(candidate.series.title.length).trim()
        : trimmedTitle.slice(candidate.normalizedTitle.length).trim();

      // 残りの文字列が「純粋な巻数表記のみ」で構成されている場合のみ紐付けを成立させる
      // （「外伝」「ラブコメディが始まらない」などの文字が含まれている場合は不成立にして新規候補へ）
      if (isPureVolumeRemainder(remainder)) {
        const extractedVolume = extractVolumeFromText(remainder);
        if (extractedVolume !== null) {
          return {
            seriesTitle: candidate.series.title,
            volume: extractedVolume,
            existingSeries: candidate.series,
          };
        }
      }
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

  // 3. volume 形式 / # 形式 / 算用数字・全角数字（末尾）
  // 例: "バーサス volume7", "バーサス volume 7", "バーサス vol.7", "バーサス #7", "鬼滅の刃 1", "葬送のフリーレン 13", "作品名 第12巻", "作品名 12巻"
  const trailingNumMatch = trimmedTitle.match(
    /^(.*?)(?:[\s　・_/-]+|(?=[第#＃vV]))(?:(?:第\s*)?([0-9０-９]+)\s*(?:巻)?|(?:volume|vol|v)[.,\s　]*([0-9０-９]+)|[#＃]\s*([0-9０-９]+))$/i
  );
  if (trailingNumMatch) {
    const prefix = trailingNumMatch[1].trim();
    const rawNum = trailingNumMatch[2] || trailingNumMatch[3] || trailingNumMatch[4];
    if (rawNum) {
      const cleanNum = rawNum.replace(/[０-９]/g, (s) =>
        String.fromCharCode(s.charCodeAt(0) - 0xfee0)
      );
      const vol = parseInt(cleanNum, 10);
      if (!isNaN(vol) && vol > 0) {
        return {
          seriesTitle: prefix || trimmedTitle,
          volume: vol,
          existingSeries: null,
        };
      }
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
