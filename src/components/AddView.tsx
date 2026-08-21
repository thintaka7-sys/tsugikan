import React, { useState } from 'react';
import { parseVolumeRange } from '../utils/series';

type AddViewProps = {
  initialTitle?: string;
  onAdd: (
    title: string,
    ownedCount: number,
    readCount: number,
    reading?: string,
    customOwnedVolumes?: number[]
  ) => void;
  onCancel: () => void;
};

export const AddView: React.FC<AddViewProps> = ({
  initialTitle = '',
  onAdd,
  onCancel,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [ownedCountStr, setOwnedCountStr] = useState('1');
  const [readCountStr, setReadCountStr] = useState('1');
  const [customRangeStr, setCustomRangeStr] = useState('');
  const [isReadTouched, setIsReadTouched] = useState(false);
  const [error, setError] = useState('');

  const handleOwnedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setOwnedCountStr(val);
    if (!isReadTouched) {
      setReadCountStr(val);
    }
  };

  const handleReadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsReadTouched(true);
    setReadCountStr(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('シリーズ名を入力してください');
      return;
    }

    let customVolumes: number[] | undefined = undefined;
    if (customRangeStr.trim()) {
      const parsedRange = parseVolumeRange(customRangeStr);
      if (!parsedRange.valid) {
        setError(parsedRange.error);
        return;
      }
      customVolumes = parsedRange.volumes;
    }

    const owned = customVolumes && customVolumes.length > 0
      ? Math.max(...customVolumes)
      : parseInt(ownedCountStr, 10);

    if (isNaN(owned) || owned < 1) {
      setError('持っている巻数は1以上を入力してください');
      return;
    }

    let read = parseInt(readCountStr, 10);
    if (isNaN(read) || read < 0) {
      read = 0;
    }
    if (read > owned) {
      read = owned;
    }

    onAdd(cleanTitle, owned, read, undefined, customVolumes);
  };

  return (
    <div className="add-view">
      <header className="app-header">
        <button type="button" className="text-button" onClick={onCancel}>
          もどる
        </button>
        <h1 className="app-title">手動で追加</h1>
        <div style={{ width: '48px' }} />
      </header>

      <main className="form-main">
        <form onSubmit={handleSubmit} className="entry-form">
          {error && <p className="form-error">{error}</p>}

          <div className="form-group">
            <label htmlFor="series-title" className="form-label">
              シリーズ名
            </label>
            <input
              id="series-title"
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError('');
              }}
              placeholder="例: ワンピース"
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="owned-count" className="form-label">
              持っている巻数（最大巻）
            </label>
            <input
              id="owned-count"
              type="number"
              min="1"
              step="1"
              className="form-input"
              value={ownedCountStr}
              onChange={handleOwnedChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="custom-range" className="form-label">
              飛び番・まとめ指定（任意）
            </label>
            <input
              id="custom-range"
              type="text"
              className="form-input"
              value={customRangeStr}
              onChange={(e) => {
                setCustomRangeStr(e.target.value);
                if (error) setError('');
              }}
              placeholder="例: 1-10, 15（未入力時は1〜最大巻）"
            />
          </div>

          <div className="form-group">
            <label htmlFor="read-count" className="form-label">
              読んだ巻数
            </label>
            <input
              id="read-count"
              type="number"
              min="0"
              step="1"
              className="form-input"
              value={readCountStr}
              onChange={handleReadChange}
              required
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="primary-button save-button">
              棚に置く
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};
