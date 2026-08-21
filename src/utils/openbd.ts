/**
 * openBD API クライアント
 * https://api.openbd.jp/
 */

export type BookBibliographicData = {
  isbn: string;
  title: string;
  publisher: string;
  reading: string; // collationkey（読みがな）
};

export async function fetchBibliographicData(
  isbn: string,
  timeoutMs = 5000
): Promise<BookBibliographicData | null> {
  const cleanIsbn = isbn.trim();
  if (!cleanIsbn) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://api.openbd.jp/v1/get?isbn=${encodeURIComponent(cleanIsbn)}`;
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // openBDは配列で返却され、該当がない場合は [null] または空配列
    if (!Array.isArray(data) || data.length === 0 || data[0] === null) {
      return null;
    }

    const item = data[0];
    const summary = item.summary || {};
    const onix = item.onix || {};

    const rawTitle: string = summary.title || '';
    const publisher: string = summary.publisher || '';

    // onix から collationkey（読みがな）を取得
    // onix.DescriptiveDetail.TitleDetail.TitleElement.TitleText.collationkey
    let reading = '';
    const titleDetail = onix.DescriptiveDetail?.TitleDetail;
    const titleElement = titleDetail?.TitleElement;
    if (titleElement?.TitleText?.collationkey) {
      reading = String(titleElement.TitleText.collationkey).trim();
    }

    if (!rawTitle) {
      return null;
    }

    return {
      isbn: cleanIsbn,
      title: rawTitle.trim(),
      publisher: publisher.trim(),
      reading,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`openBD fetch timed out for ISBN ${cleanIsbn}`);
    } else {
      console.warn(`openBD fetch failed for ISBN ${cleanIsbn}:`, error);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
