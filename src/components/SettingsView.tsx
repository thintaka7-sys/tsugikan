import React, { useRef, useState } from 'react';
import { StorageData } from '../types';
import { validateStorageData } from '../utils/validation';
import { exportLibraryAsJson } from '../utils/export';

type SettingsViewProps = {
  onBack: () => void;
  lastExportedAt?: number;
  exportData: () => StorageData;
  importData: (data: StorageData) => void;
  clearAll: () => void;
};

function formatExportDate(timestamp?: number): string {
  if (!timestamp) return 'まだ一度も書き出していません';
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}年${month}月${date}日 ${hours}:${minutes}`;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onBack,
  lastExportedAt,
  exportData,
  importData,
  clearAll,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isExportStale = !lastExportedAt || Date.now() - lastExportedAt > 30 * 24 * 60 * 60 * 1000;

  const handleExport = () => {
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const data = exportData();
      exportLibraryAsJson(data);
      setSuccessMessage('データをファイルに書き出しました。');
    } catch {
      setErrorMessage('データの書き出しに失敗しました。');
    }
  };

  const handleImportButtonClick = () => {
    setErrorMessage('');
    setSuccessMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    try {
      const text = await file.text();
      const result = validateStorageData(text);

      if (!result.valid) {
        setErrorMessage(`読み込みエラー: ${result.error}`);
        return;
      }

      // 取り込み前に現在のデータを自動バックアップとしてダウンロード
      const currentData = exportData();
      exportLibraryAsJson(currentData);

      const count = result.data.series.length;
      const ok = window.confirm(
        `${count}件のシリーズを読み込みます。今の棚の内容は置き換わります。\n（現在のデータの自動バックアップをダウンロードしました）`
      );

      if (!ok) {
        return;
      }

      importData(result.data);
      setSuccessMessage(`${count}件のシリーズを読み込みました。`);
    } catch {
      setErrorMessage('ファイルの読み取りに失敗しました。');
    }
  };

  const handleClearAll = () => {
    setErrorMessage('');
    setSuccessMessage('');

    const ok = window.confirm(
      '棚のすべての本を消去します。この操作は取り消せません。本当によろしいですか？\n（実行前に現在のバックアップを自動ダウンロードします）'
    );

    if (!ok) return;

    try {
      // 全消去前に自動バックアップ
      const currentData = exportData();
      exportLibraryAsJson(currentData);

      clearAll();
      setSuccessMessage('すべての本を棚から消去しました。');
    } catch {
      setErrorMessage('消去処理に失敗しました。');
    }
  };

  return (
    <div className="settings-view">
      <header className="app-header">
        <button type="button" className="text-button" onClick={onBack}>
          一覧にもどる
        </button>
        <h1 className="app-title">設定</h1>
        <div style={{ width: '48px' }} />
      </header>

      <main className="settings-main">
        {errorMessage && <p className="form-error settings-message">{errorMessage}</p>}
        {successMessage && <p className="settings-success settings-message">{successMessage}</p>}

        <div className="settings-list">
          <section className="settings-section">
            <h2 className="settings-section-title">データの保存と復元</h2>

            <div className="settings-export-status">
              <p className="settings-last-export-label">最後に書き出した日時</p>
              <p className="settings-last-export-value">{formatExportDate(lastExportedAt)}</p>
            </div>

            {isExportStale && (
              <div className="settings-stale-notice">
                <p className="settings-stale-text">
                  {lastExportedAt
                    ? '前回の書き出しから30日以上経過しています。端末の故障やデータ消失に備え、定期的なファイル書き出しをおすすめします。'
                    : 'まだデータの書き出しが行われていません。端末の故障やデータ消失に備え、定期的なファイル書き出しをおすすめします。'}
                </p>
              </div>
            )}

            <div className="settings-actions">
              <button
                type="button"
                className="secondary-button settings-button"
                onClick={handleExport}
              >
                データを書き出す
              </button>

              <button
                type="button"
                className="secondary-button settings-button"
                onClick={handleImportButtonClick}
              >
                データを読み込む
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>
          </section>

          <section className="settings-section danger-section">
            <h2 className="settings-section-title">初期化</h2>
            <div className="settings-actions">
              <button
                type="button"
                className="danger-button settings-button"
                onClick={handleClearAll}
              >
                すべて消す
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};
