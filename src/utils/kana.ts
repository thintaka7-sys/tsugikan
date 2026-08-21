/**
 * 検索用文字列正規化ユーティリティ
 * - 全角英数を半角に変換
 * - 英字を小文字化
 * - カタカナ（ァ〜ヶ）をひらがな（ぁ〜ゖ）に変換
 * - 長音符「ー」を除去
 * - 記号・スペース（半角/全角スペース、・、！、？、〜、波ダッシュ、各種括弧、句読点など）を明示的に除去
 * ※ 漢字・ひらがな・カタカナ・英数字は確実に保持されます
 */
export function normalizeForSearch(text: string): string {
  if (!text) return '';

  return text
    // 1. 全角英数を半角に変換
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
      String.fromCharCode(s.charCodeAt(0) - 0xfee0)
    )
    // 2. 英字小文字化
    .toLowerCase()
    // 3. カタカナ（ァ〜ヶ）をひらがな（ぁ〜ゖ）に変換
    .replace(/[\u30a1-\u30f6]/g, (match) =>
      String.fromCharCode(match.charCodeAt(0) - 0x60)
    )
    // 4. 長音符「ー」を除去
    .replace(/ー/g, '')
    // 5. 除去対象の記号・スペースを明示的に指定して除去（漢字・ひらがな・英数字は除外）
    .replace(/[\s\u3000・！？!?〜~～「」『』()（）\[\]【】《》〈〉:：;；,，.．、。_＿\-\/／\\|｜#＃&＆%％+＋*＊=＝×✕]/g, '');
}
