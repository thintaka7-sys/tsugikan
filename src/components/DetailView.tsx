import React, { useState, useRef } from 'react';
import { Series } from '../types';
import { getMaxVolume, getMissingVolumes, parseVolumeRange, formatMissingVolumes, getSpineIndex } from '../utils/series';
import { UndoToast } from './UndoToast';

type DetailViewProps = {
  series: Series;
  onBack: () => void;
  onBuyNext: (id: string) => Series | null;
  onReadNext: (id: string) => Series | null;
  onRestore: (snapshot: Series) => void;
  onUpdate: (id: string, updates: { title?: string; ownedCount?: number; readCount?: number; reading?: string }) => void;
  onToggleVolume: (id: string, volume: number) => void;
  onSetVolumesBatch: (id: string, volumes: number[], isOwned: boolean) => void;
  onFillMissing: (id: string) => Series | null;
  onDelete: (id: string) => void;
};

type UndoState = {
  key: number;
  message: string;
  snapshot: Series;
};

export const DetailView: React.FC<DetailViewProps> = ({
  series,
  onBack,
  onBuyNext,
  onReadNext,
  onRestore,
  onUpdate,
  onToggleVolume,
  onSetVolumesBatch,
  onFillMissing,
  onDelete,
}) => {
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newlyLitVol, setNewlyLitVol] = useState<number | null>(null);
  const [showJoy, setShowJoy] = useState(false);
  const joyTimerRef = useRef<number | null>(null);

  // 一括範囲変更用の状態
  const [rangeInput, setRangeInput] = useState('');
  const [rangeError, setRangeError] = useState('');

  // 編集フォーム状態
  const maxOwned = getMaxVolume(series.ownedVolumes);
  const maxRead = getMaxVolume(series.readVolumes);
  const missingVolumes = getMissingVolumes(series.ownedVolumes);
  const unreadVolumes = series.ownedVolumes
    .filter((v) => !series.readVolumes.includes(v))
    .sort((a, b) => a - b);
  const spineIndex = getSpineIndex(series.id);

  const [editTitle, setEditTitle] = useState(series.title);
  const [editOwnedStr, setEditOwnedStr] = useState(String(maxOwned));
  const [editReadStr, setEditReadStr] = useState(String(maxRead));
  const [editReading, setEditReading] = useState(series.reading || '');
  const [editError, setEditError] = useState('');

  const [inlineReading, setInlineReading] = useState(series.reading || '');

  React.useEffect(() => {
    setInlineReading(series.reading || '');
  }, [series.reading]);

  const handleInlineReadingBlur = () => {
    const trimmed = inlineReading.trim();
    if (trimmed !== (series.reading || '')) {
      onUpdate(series.id, { reading: trimmed });
    }
  };

  const handleBuy = () => {
    const nextVol = maxOwned + 1;
    setNewlyLitVol(nextVol);
    setTimeout(() => setNewlyLitVol(null), 800);

    // シオリ「喜ぶ」の0.5秒表示（連打時はタイマーリセットで多重表示防止）
    if (joyTimerRef.current !== null) {
      window.clearTimeout(joyTimerRef.current);
    }
    setShowJoy(true);
    joyTimerRef.current = window.setTimeout(() => {
      setShowJoy(false);
      joyTimerRef.current = null;
    }, 500);

    const snapshot = onBuyNext(series.id);
    if (snapshot) {
      setUndoState({
        key: Date.now(),
        message: '買った（+1巻）',
        snapshot,
      });
    }
  };

  const handleRead = () => {
    if (maxRead >= maxOwned) return;
    const snapshot = onReadNext(series.id);
    if (snapshot) {
      setUndoState({
        key: Date.now(),
        message: '読んだ（+1巻）',
        snapshot,
      });
    }
  };

  const handleUndo = () => {
    if (undoState) {
      onRestore(undoState.snapshot);
      setUndoState(null);
    }
  };

  const handleBack = () => {
    setUndoState(null);
    onBack();
  };

  const handleToggleSpine = (vol: number) => {
    onToggleVolume(series.id, vol);
  };

  const handleFillMissing = () => {
    const missingCount = missingVolumes.length;
    const snapshot = onFillMissing(series.id);
    if (snapshot) {
      setUndoState({
        key: Date.now(),
        message: `抜けている${missingCount}巻をすべて埋めました`,
        snapshot,
      });
    }
  };

  const handleBatchRangeSubmit = (isOwned: boolean) => {
    setRangeError('');
    const res = parseVolumeRange(rangeInput);
    if (!res.valid) {
      setRangeError(res.error);
      return;
    }

    onSetVolumesBatch(series.id, res.volumes, isOwned);
    setRangeInput('');
  };

  const startEdit = () => {
    setEditTitle(series.title);
    setEditOwnedStr(String(getMaxVolume(series.ownedVolumes)));
    setEditReadStr(String(getMaxVolume(series.readVolumes)));
    setEditReading(series.reading || '');
    setEditError('');
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditError('');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = editTitle.trim();
    if (!cleanTitle) {
      setEditError('シリーズ名を入力してください');
      return;
    }

    const targetOwnedCount = parseInt(editOwnedStr, 10);
    if (isNaN(targetOwnedCount) || targetOwnedCount < 0) {
      setEditError('持っている巻数は0以上を入力してください');
      return;
    }

    // 減らす場合の確認
    if (targetOwnedCount < maxOwned) {
      const willDrop = series.ownedVolumes.filter((v) => v > targetOwnedCount);
      if (willDrop.length > 0) {
        const ok = window.confirm(
          `所持最大巻を${targetOwnedCount}巻に減らすと、${willDrop.join('・')}巻が所持から外れます。よろしいですか？`
        );
        if (!ok) return;
      }
    }

    let read = parseInt(editReadStr, 10);
    if (isNaN(read) || read < 0) {
      read = 0;
    }
    if (read > targetOwnedCount) {
      read = targetOwnedCount;
    }

    onUpdate(series.id, {
      title: cleanTitle,
      ownedCount: targetOwnedCount,
      readCount: read,
      reading: editReading.trim(),
    });
    setIsEditing(false);
  };

  const handleDelete = () => {
    const ok = window.confirm(`「${series.title}」を棚から外しますか？この操作は取り消せません。`);
    if (ok) {
      setUndoState(null);
      onDelete(series.id);
      onBack();
    }
  };

  // 帯表現用の区間分割計算 (maxOwned >= 31)
  const renderContinuousBar = () => {
    if (maxOwned === 0) return null;

    const intervals: { start: number; end: number; isOwned: boolean }[] = [];
    const ownedSet = new Set(series.ownedVolumes);

    let curStart = 1;
    let curOwned = ownedSet.has(1);

    for (let v = 2; v <= maxOwned; v++) {
      const isO = ownedSet.has(v);
      if (isO !== curOwned) {
        intervals.push({ start: curStart, end: v - 1, isOwned: curOwned });
        curStart = v;
        curOwned = isO;
      }
    }
    intervals.push({ start: curStart, end: maxOwned, isOwned: curOwned });

    return (
      <div className="shelf-bar-wrapper">
        <div className="shelf-continuous-bar">
          {intervals.map((inter, idx) => {
            const span = inter.end - inter.start + 1;
            const isLit = newlyLitVol !== null && newlyLitVol >= inter.start && newlyLitVol <= inter.end;
            return (
              <div
                key={idx}
                className={`bar-segment ${inter.isOwned ? 'bar-owned' : 'bar-missing'} ${isLit ? 'bar-lit-anim' : ''}`}
                style={{ flex: span }}
                title={`${inter.start}〜${inter.end}巻: ${inter.isOwned ? '所持' : '未所持'}`}
              />
            );
          })}
        </div>

        <div className="bar-labels-row">
          <span className="bar-start-label">1巻</span>
          <span className="bar-missing-summary">
            {missingVolumes.length > 0 ? `${formatMissingVolumes(missingVolumes)}巻 抜け` : ''}
          </span>
          <span className="bar-end-label">{maxOwned}巻</span>
        </div>
      </div>
    );
  };

  return (
    <div className="detail-view">
      <header className="app-header">
        <button type="button" className="text-button" onClick={handleBack}>
          一覧にもどる
        </button>
        <h1 className="app-title">{isEditing ? '編集' : '本の詳細'}</h1>
        <div style={{ width: '48px' }} />
      </header>

      <main className="detail-main">
        {!isEditing ? (
          <div className="detail-content">
            <div className="detail-header-card">
              <h2 className="detail-title">{series.title}</h2>
              <div className="detail-reading-container">
                <input
                  type="text"
                  className="detail-reading-input"
                  placeholder="読みがなで検索したいときに入力します"
                  value={inlineReading}
                  onChange={(e) => setInlineReading(e.target.value)}
                  onBlur={handleInlineReadingBlur}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                />
              </div>
            </div>

            {/* 本棚ビジュアル表現（3状態） */}
            <div className="shelf-visual-container">
              {showJoy && (
                <div className="shiori-joy-popup" aria-hidden="true">
                  <img src="/img/shiori_joy.webp" alt="" className="shiori-joy-img" />
                </div>
              )}

              <div className="shelf-visual-header">
                <span className="shelf-visual-title">棚の状況</span>
                <span className="shelf-max-status">{maxOwned}巻まで</span>
              </div>

              {/* 未読の巻範囲表示（未読が0件のときは非表示） */}
              {unreadVolumes.length > 0 && (
                <p className="shelf-unread-line">
                  未読：{formatMissingVolumes(unreadVolumes)}巻
                </p>
              )}

              {/* ① 抜けなし */}
              {missingVolumes.length === 0 && maxOwned > 0 && (
                <div className="shelf-complete-box">
                  <span className="shelf-complete-icon">✓</span>
                  <p className="shelf-complete-text">1〜{maxOwned}巻 すべて揃っています</p>
                </div>
              )}

              {/* ② 抜けあり & 30巻以下: 背表紙並び */}
              {missingVolumes.length > 0 && maxOwned <= 30 && (
                <div className="shelf-spines-container">
                  <div className="shelf-spines-grid">
                    {Array.from({ length: maxOwned }, (_, i) => i + 1).map((vol) => {
                      const isOwned = series.ownedVolumes.includes(vol);
                      const isRead = series.readVolumes.includes(vol);
                      const isLit = newlyLitVol === vol;
                      const spineStyle: React.CSSProperties | undefined = isOwned
                        ? { backgroundImage: `url('/img/spine_${spineIndex}.webp')` }
                        : undefined;

                      return (
                        <button
                          key={vol}
                          type="button"
                          className={`spine-item ${isOwned ? 'spine-owned' : 'spine-missing'} ${isLit ? 'spine-lit-anim' : ''}`}
                          style={spineStyle}
                          onClick={() => handleToggleSpine(vol)}
                          title={`${vol}巻: ${isOwned ? '持ってる (タップで未所持に変更)' : '持っていない (タップで所持に変更)'}`}
                        >
                          <span className="spine-number">{vol}</span>
                          {isOwned && !isRead && <span className="spine-unread-dot" title="未読" />}
                        </button>
                      );
                    })}
                  </div>
                  <div className="shelf-plank" />
                  <p className="shelf-spine-hint">背表紙をタップして所持・未所持を切り替え</p>
                </div>
              )}

              {/* ③ 抜けあり & 31巻以上: 連続帯（バー） */}
              {missingVolumes.length > 0 && maxOwned >= 31 && renderContinuousBar()}

              {/* 抜けが2つ以上あるときのみ表示する一括埋めボタン */}
              {missingVolumes.length >= 2 && (
                <button
                  type="button"
                  className="secondary-button fill-missing-button"
                  onClick={handleFillMissing}
                >
                  抜けている{missingVolumes.length}巻をすべて埋める
                </button>
              )}
            </div>

            {/* アクションボタン */}
            <div className="action-buttons">
              <button
                type="button"
                className="big-action-button buy-button"
                onClick={handleBuy}
              >
                買った +1
              </button>

              <button
                type="button"
                className="big-action-button read-button"
                onClick={handleRead}
                disabled={maxRead >= maxOwned}
              >
                読んだ +1
              </button>
            </div>

            {/* 範囲指定による巻数変更 */}
            <div className="batch-range-card">
              <h3 className="batch-range-title">巻を指定して変更</h3>
              <div className="batch-range-form">
                <input
                  type="text"
                  className="form-input batch-range-input"
                  placeholder="例: 3, 5-8"
                  value={rangeInput}
                  onChange={(e) => {
                    setRangeInput(e.target.value);
                    if (rangeError) setRangeError('');
                  }}
                />
                <div className="batch-range-buttons">
                  <button
                    type="button"
                    className="secondary-button batch-btn"
                    onClick={() => handleBatchRangeSubmit(true)}
                  >
                    所持にする
                  </button>
                  <button
                    type="button"
                    className="secondary-button batch-btn"
                    onClick={() => handleBatchRangeSubmit(false)}
                  >
                    未所持にする
                  </button>
                </div>
              </div>
              {rangeError && <p className="form-error range-error">{rangeError}</p>}
            </div>

            <div className="detail-footer-links">
              <button type="button" className="text-link-button" onClick={startEdit}>
                タイトルや巻数を直接編集する
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveEdit} className="entry-form edit-form">
            {editError && <p className="form-error">{editError}</p>}

            <div className="form-group">
              <label htmlFor="edit-title" className="form-label">
                シリーズ名
              </label>
              <input
                id="edit-title"
                type="text"
                className="form-input"
                value={editTitle}
                onChange={(e) => {
                  setEditTitle(e.target.value);
                  if (editError) setEditError('');
                }}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-reading" className="form-label">
                読みがな（カタカナ・ひらがな）
              </label>
              <input
                id="edit-reading"
                type="text"
                className="form-input"
                value={editReading}
                onChange={(e) => setEditReading(e.target.value)}
                placeholder="例: ソウソウ ノ フリーレン"
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-owned" className="form-label">
                持っている巻数（最大巻）
              </label>
              <input
                id="edit-owned"
                type="number"
                min="0"
                step="1"
                className="form-input"
                value={editOwnedStr}
                onChange={(e) => setEditOwnedStr(e.target.value)}
                required
              />
              <span className="form-hint">※数値を増やしても、既存の抜け巻は保持されます</span>
            </div>

            <div className="form-group">
              <label htmlFor="edit-read" className="form-label">
                読んだ巻数
              </label>
              <input
                id="edit-read"
                type="number"
                min="0"
                step="1"
                className="form-input"
                value={editReadStr}
                onChange={(e) => setEditReadStr(e.target.value)}
                required
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="primary-button save-button">
                変更を保存
              </button>
              <button type="button" className="secondary-button" onClick={cancelEdit}>
                とりやめる
              </button>
            </div>

            <div className="danger-zone">
              <button
                type="button"
                className="danger-button"
                onClick={handleDelete}
              >
                この本を棚から外す
              </button>
            </div>
          </form>
        )}
      </main>

      {undoState && (
        <UndoToast
          key={undoState.key}
          message={undoState.message}
          onUndo={handleUndo}
          onDismiss={() => setUndoState(null)}
          durationMs={5000}
        />
      )}
    </div>
  );
};
