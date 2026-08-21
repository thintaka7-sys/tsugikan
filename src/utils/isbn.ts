/**
 * ISBN-13 / 書籍バーコード判定ユーティリティ
 */

/**
 * 2段目（192で始まる分類・価格コード）など、無視すべきバーコードか判定
 */
export function isIgnoredBarcode(code: string): boolean {
  if (!code) return true;
  const clean = code.trim();
  return clean.startsWith('192');
}

/**
 * 有効な書籍ISBN-13（978または979始まり、チェックディジット一致）か判定
 */
export function isValidIsbn13(code: string): boolean {
  if (!code) return false;
  const clean = code.trim();

  // 13桁の数字かつ 978 または 979 始まり
  if (!/^(978|979)\d{10}$/.test(clean)) {
    return false;
  }

  // ISBN-13 モジュラス10 ウェイト1-3 チェックディジット検証
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(clean[i], 10);
    sum += i % 2 === 0 ? digit * 1 : digit * 3;
  }

  const remainder = sum % 10;
  const expectedCheckDigit = remainder === 0 ? 0 : 10 - remainder;
  const actualCheckDigit = parseInt(clean[12], 10);

  return expectedCheckDigit === actualCheckDigit;
}
