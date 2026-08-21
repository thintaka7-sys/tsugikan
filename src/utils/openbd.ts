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

    const rawSummaryTitle: string = summary.title || '';
    const publisher: string = summary.publisher || '';

    // ONIX の TitleDetail / TitleElement から主題名・副題・読みがなを構造化取得
    let mainTitle = rawSummaryTitle;
    let subtitle = '';
    let reading = '';

    const rawTitleDetail = onix.DescriptiveDetail?.TitleDetail;
    const titleDetail = Array.isArray(rawTitleDetail) ? rawTitleDetail[0] : rawTitleDetail;
    const rawTitleElement = titleDetail?.TitleElement;
    const titleElement = Array.isArray(rawTitleElement) ? rawTitleElement[0] : rawTitleElement;

    if (titleElement) {
      // 主題名
      if (titleElement.TitleText) {
        if (typeof titleElement.TitleText === 'object' && titleElement.TitleText.content) {
          mainTitle = String(titleElement.TitleText.content).trim();
          if (titleElement.TitleText.collationkey) {
            reading = String(titleElement.TitleText.collationkey).trim();
          }
        } else if (typeof titleElement.TitleText === 'string') {
          mainTitle = titleElement.TitleText.trim();
        }
      }

      // 副題（サブタイトル）
      if (titleElement.Subtitle) {
        if (typeof titleElement.Subtitle === 'object' && titleElement.Subtitle.content) {
          subtitle = String(titleElement.Subtitle.content).trim();
        } else if (typeof titleElement.Subtitle === 'string') {
          subtitle = titleElement.Subtitle.trim();
        }
      }
    }

    // 主題名に副題が含まれていない場合は結合
    let fullTitle = mainTitle;
    if (subtitle && !mainTitle.includes(subtitle)) {
      fullTitle = `${mainTitle} ${subtitle}`.trim();
    }

    if (!fullTitle) {
      return null;
    }

    return {
      isbn: cleanIsbn,
      title: fullTitle,
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
