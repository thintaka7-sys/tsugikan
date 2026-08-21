import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { Series } from '../types';
import { isIgnoredBarcode, isValidIsbn13 } from '../utils/isbn';
import { fetchBibliographicData, BookBibliographicData } from '../utils/openbd';
import { parseBookTitle, ParsedTitleResult } from '../utils/titleParser';

export type ScanSuccessPayload = {
  isbn: string;
  bookData: BookBibliographicData;
  parsedResult: ParsedTitleResult;
};

type ScannerViewProps = {
  seriesList: Series[];
  onBack: () => void;
  onScanSuccess: (payload: ScanSuccessPayload) => void;
  onManualFallback: (isbn?: string) => void;
};

export const ScannerView: React.FC<ScannerViewProps> = ({
  seriesList,
  onBack,
  onScanSuccess,
  onManualFallback,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const isProcessingRef = useRef(false);

  const [isLoadingBook, setIsLoadingBook] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedIsbn, setLastFailedIsbn] = useState<string | null>(null);
  const [manualIsbnInput, setManualIsbnInput] = useState('');

  const processIsbn = useCallback(
    async (rawIsbn: string) => {
      // 全角数字を半角化し、ハイフンやスペースを除去
      const cleanIsbn = rawIsbn
        .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
        .replace(/[-\s]/g, '')
        .trim();

      if (!cleanIsbn) {
        setErrorMessage('ISBN番号を入力してください。');
        return;
      }

      // 1. チェックディジットおよび13桁形式の検証（openBDに問い合わせる前に必ず検証）
      if (!isValidIsbn13(cleanIsbn)) {
        setLastFailedIsbn(null);
        setErrorMessage('番号が正しくありません。桁を確認してください');
        setIsLoadingBook(false);
        isProcessingRef.current = false;
        return;
      }

      isProcessingRef.current = true;
      setIsLoadingBook(true);
      setErrorMessage(null);

      // 2. openBD から書誌情報を取得
      try {
        const bookData = await fetchBibliographicData(cleanIsbn, 5000);

        if (!bookData) {
          setLastFailedIsbn(cleanIsbn);
          setErrorMessage(`「${cleanIsbn}」の本の情報が見つかりませんでした。`);
          setIsLoadingBook(false);
          isProcessingRef.current = false;
          return;
        }

        // 3. シリーズ名と巻数の判定
        const parsed = parseBookTitle(bookData.title, seriesList);

        // 4. 確認画面へ遷移
        onScanSuccess({
          isbn: cleanIsbn,
          bookData,
          parsedResult: parsed,
        });
      } catch (err) {
        console.error('Failed to process ISBN:', err);
        setLastFailedIsbn(cleanIsbn);
        setErrorMessage('書誌情報の取得に失敗しました。');
        setIsLoadingBook(false);
        isProcessingRef.current = false;
      }
    },
    [seriesList, onScanSuccess]
  );

  useEffect(() => {
    let isMounted = true;
    isProcessingRef.current = false;

    const codeReader = new BrowserMultiFormatReader();

    const startScanning = async () => {
      try {
        if (!videoRef.current) return;

        // 背面カメラを優先指定
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };

        const controls = await codeReader.decodeFromConstraints(
          constraints,
          videoRef.current,
          async (result, _error) => {
            if (!isMounted || !result || isProcessingRef.current) {
              return;
            }

            const rawText = result.getText();
            if (!rawText) return;

            // 2段目の分類コード (192...) は無視して継続
            if (isIgnoredBarcode(rawText)) {
              return;
            }

            // カメラで読み取った場合も共通の処理を実行
            await processIsbn(rawText);
          }
        );

        if (isMounted) {
          controlsRef.current = controls;
        } else {
          controls.stop();
        }
      } catch (err) {
        if (!isMounted) return;
        console.warn('Camera access could not be initialized:', err);
        setCameraError('カメラを起動できませんでした。下の入力欄からISBN番号を直接入力できます。');
      }
    };

    startScanning();

    return () => {
      isMounted = false;
      // カメラストリームの完全な停止
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [processIsbn]);

  const handleManualIsbnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoadingBook) return;
    await processIsbn(manualIsbnInput);
  };

  const handleRetry = () => {
    setErrorMessage(null);
    setLastFailedIsbn(null);
    setIsLoadingBook(false);
    isProcessingRef.current = false;
  };

  return (
    <div className="scanner-view">
      <header className="app-header">
        <button type="button" className="text-button" onClick={onBack}>
          もどる
        </button>
        <h1 className="app-title">バーコードをスキャン</h1>
        <div style={{ width: '48px' }} />
      </header>

      <main className="scanner-main">
        {/* カメラビューポート（カメラエラー時は案内ボックスを表示） */}
        {!cameraError ? (
          <div className="scanner-viewport">
            <video ref={videoRef} className="scanner-video" playsInline muted autoPlay />
            <div className="scanner-overlay">
              <div className="scanner-guide-box" />
              <p className="scanner-guide-text">
                書籍のバーコード（上段のISBN）を枠内に写してください
              </p>
            </div>

            {isLoadingBook && (
              <div className="scanner-loading-overlay">
                <p className="scanner-loading-text">本を探しています...</p>
              </div>
            )}
          </div>
        ) : (
          <div className="scanner-camera-disabled-card">
            <p className="scanner-disabled-text">{cameraError}</p>
          </div>
        )}

        {/* エラーメッセージおよび手動登録フォールバック */}
        {errorMessage && (
          <div className="scanner-error-card">
            <p className="form-error">{errorMessage}</p>
            <div className="scanner-error-actions">
              {lastFailedIsbn ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => onManualFallback(lastFailedIsbn)}
                >
                  手動で本を追加する
                </button>
              ) : null}
              <button
                type="button"
                className="secondary-button"
                onClick={handleRetry}
              >
                もう一度試す
              </button>
            </div>
          </div>
        )}

        {/* 正式なISBN手入力導線（バーコードが読めないときやカメラ非対応環境用） */}
        <section className="scanner-isbn-section">
          <h2 className="scanner-isbn-title">バーコードが読めないときは番号を入力</h2>
          <form onSubmit={handleManualIsbnSubmit} className="scanner-isbn-form">
            <input
              type="text"
              inputMode="numeric"
              className="form-input scanner-isbn-input"
              placeholder="9784-------- (13桁)"
              value={manualIsbnInput}
              onChange={(e) => {
                setManualIsbnInput(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              disabled={isLoadingBook}
            />
            <button
              type="submit"
              className="secondary-button scanner-isbn-button"
              disabled={isLoadingBook || !manualIsbnInput.trim()}
            >
              {isLoadingBook ? '取得中' : '送信'}
            </button>
          </form>
        </section>

        <div className="scanner-footer">
          <button
            type="button"
            className="text-link-button"
            onClick={() => onManualFallback()}
          >
            タイトルを手動入力して追加する
          </button>
        </div>
      </main>
    </div>
  );
};
