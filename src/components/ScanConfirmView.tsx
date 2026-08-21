import React, { useState } from 'react';
import { Series } from '../types';
import { ScanSuccessPayload } from './ScannerView';
import { getMaxVolume } from '../utils/series';

type ScanConfirmViewProps = {
  scanPayload: ScanSuccessPayload;
  seriesList: Series[];
  onSave: (title: string, volume: number, existingSeriesId: string | null, reading?: string) => void;
  onScanNext: () => void;
  onBackToHome: () => void;
};

export const ScanConfirmView: React.FC<ScanConfirmViewProps> = ({
  scanPayload,
  seriesList,
  onSave,
  onScanNext,
  onBackToHome,
}) => {
  const { bookData, parsedResult } = scanPayload;

  const [title, setTitle] = useState(parsedResult.seriesTitle || bookData.title);
  const [volumeStr, setVolumeStr] = useState(
    parsedResult.volume !== null ? String(parsedResult.volume) : '1'
  );
  const [error, setError] = useState('');

  // 編集中のタイトルから改めて紐付く既存シリーズを判定
  const matchedExistingSeries =
    parsedResult.existingSeries ||
    seriesList.find((s) => s.title.trim() === title.trim()) ||
    null;

  const parsedVolume = parseInt(volumeStr, 10);
  const isValidVolume = !isNaN(parsedVolume) && parsedVolume > 0;

  // 重複チェック
  const isAlreadyOwned =
    matchedExistingSeries !== null &&
    isValidVolume &&
    matchedExistingSeries.ownedVolumes.includes(parsedVolume);

  // 飛び番チェック
  let missingGapText: string | null = null;
  if (matchedExistingSeries && isValidVolume && !isAlreadyOwned) {
    const maxOwned = getMaxVolume(matchedExistingSeries.ownedVolumes);
    if (parsedVolume > maxOwned + 1) {
      const missingVols: number[] = [];
      for (let v = maxOwned + 1; v < parsedVolume; v++) {
        if (!matchedExistingSeries.ownedVolumes.includes(v)) {
          missingVols.push(v);
        }
      }
      if (missingVols.length > 0) {
        missingGapText = `${missingVols.join('・')}巻が抜けます`;
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('シリーズ名を入力してください');
      return;
    }

    if (!isValidVolume) {
      setError('巻数は1以上の整数を入力してください');
      return;
    }

    if (isAlreadyOwned) {
      setError('この巻はすでに所持しています');
      return;
    }

    onSave(
      cleanTitle,
      parsedVolume,
      matchedExistingSeries ? matchedExistingSeries.id : null,
      bookData.reading
    );
  };

  return (
    <div className="scan-confirm-view">
      <header className="app-header">
        <button type="button" className="text-button" onClick={onBackToHome}>
          一覧にもどる
        </button>
        <h1 className="app-title">本の確認</h1>
        <div style={{ width: '48px' }} />
      </header>

      <main className="form-main">
        {matchedExistingSeries ? (
          <div className="status-notice notice-existing">
            <span className="notice-badge">続巻の追加</span>
            <p className="notice-text">
              「{matchedExistingSeries.title}」の {isValidVolume ? `${parsedVolume}巻` : '続巻'} を追加します
            </p>
          </div>
        ) : (
          <div className="status-notice notice-new">
            <span className="notice-badge">新しい本</span>
            <p className="notice-text">新しく棚に置きます</p>
          </div>
        )}

        {isAlreadyOwned && (
          <div className="status-warning" role="alert">
            <p className="warning-text">この巻はもう持っています</p>
          </div>
        )}

        {missingGapText && !isAlreadyOwned && (
          <div className="status-gap-notice" role="alert">
            <p className="gap-text">{missingGapText}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="entry-form">
          {error && <p className="form-error">{error}</p>}

          <div className="form-group">
            <label htmlFor="confirm-title" className="form-label">
              シリーズ名
            </label>
            <input
              id="confirm-title"
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError('');
              }}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirm-volume" className="form-label">
              巻数
            </label>
            <input
              id="confirm-volume"
              type="number"
              min="1"
              step="1"
              className="form-input"
              value={volumeStr}
              onChange={(e) => {
                setVolumeStr(e.target.value);
                if (error) setError('');
              }}
              required
            />
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="primary-button save-button"
              disabled={isAlreadyOwned || !isValidVolume}
            >
              棚に置く
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={onScanNext}
            >
              {isAlreadyOwned ? '次をスキャン' : 'やめる'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};
