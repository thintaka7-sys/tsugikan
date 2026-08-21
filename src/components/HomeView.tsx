import React, { useState, useMemo, useEffect } from 'react';
import { Series } from '../types';
import { getMaxVolume, getUnreadCount, getMissingVolumes } from '../utils/series';
import { normalizeForSearch } from '../utils/kana';

type HomeViewProps = {
  seriesList: Series[];
  onSelectSeries: (id: string) => void;
  onNavigateAdd: (initialTitle?: string) => void;
  onNavigateScanner: () => void;
  onNavigateSettings: () => void;
};

export const HomeView: React.FC<HomeViewProps> = ({
  seriesList,
  onSelectSeries,
  onNavigateAdd,
  onNavigateScanner,
  onNavigateSettings,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedNoResult, setDebouncedNoResult] = useState(false);

  const filteredSeriesList = useMemo(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return seriesList;

    const normalizedQuery = normalizeForSearch(trimmed);
    if (!normalizedQuery) return seriesList;

    return seriesList.filter((s) => {
      const matchTitle = normalizeForSearch(s.title).includes(normalizedQuery);
      const matchReading = s.reading
        ? normalizeForSearch(s.reading).includes(normalizedQuery)
        : false;
      return matchTitle || matchReading;
    });
  }, [seriesList, searchQuery]);

  // 検索0件時のシオリ表示を500msデバウンス
  useEffect(() => {
    if (seriesList.length > 0 && filteredSeriesList.length === 0 && searchQuery.trim() !== '') {
      const timer = window.setTimeout(() => setDebouncedNoResult(true), 500);
      return () => window.clearTimeout(timer);
    } else {
      setDebouncedNoResult(false);
    }
  }, [searchQuery, filteredSeriesList.length, seriesList.length]);

  return (
    <div className="home-view">
      <header className="app-header">
        <h1 className="app-title">ツギカン</h1>
        <button
          type="button"
          className="text-button header-settings-button"
          onClick={onNavigateSettings}
        >
          設定
        </button>
      </header>

      {seriesList.length > 0 && (
        <div className="search-bar-container">
          <input
            type="search"
            className="search-input"
            placeholder="タイトル・読みがなで絞り込み..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      <main className="home-main">
        {seriesList.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-content">
              <img src="/img/shiori_searching.webp" alt="" className="empty-shiori-img" />
              <p className="empty-message">棚はまだ暗いままです。まず一冊、灯をともしましょう。</p>
              <div className="empty-actions">
                <button
                  type="button"
                  className="primary-button scanner-primary-button"
                  onClick={onNavigateScanner}
                >
                  バーコードで追加
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onNavigateAdd()}
                >
                  手動で追加
                </button>
              </div>
            </div>
          </div>
        ) : filteredSeriesList.length === 0 ? (
          <div className="search-empty-state">
            {debouncedNoResult && (
              <img
                src="/img/shiori_searching.webp"
                alt=""
                className="search-empty-shiori-img"
              />
            )}
            <p className="empty-message">「{searchQuery.trim()}」は見つかりませんでした。</p>
            <button
              type="button"
              className="primary-button search-add-button"
              onClick={() => onNavigateAdd(searchQuery.trim())}
            >
              この名前で棚に追加する
            </button>
          </div>
        ) : (
          <div className="series-list">
            {filteredSeriesList.map((series) => {
              const maxOwned = getMaxVolume(series.ownedVolumes);
              const unreadCount = getUnreadCount(series);
              const missingList = getMissingVolumes(series.ownedVolumes);
              const missingCount = missingList.length;

              return (
                <article
                  key={series.id}
                  className="series-card"
                  onClick={() => onSelectSeries(series.id)}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectSeries(series.id);
                    }
                  }}
                >
                  <div className="card-header-row">
                    <h2 className="series-title">{series.title}</h2>
                    {missingCount > 0 && (
                      <span className="missing-badge">{missingCount}冊抜け</span>
                    )}
                  </div>

                  <div className="series-owned-display">
                    <span className="series-owned-number">{maxOwned}巻</span>
                    <span className="series-owned-suffix">まで持ってる</span>
                  </div>

                  <div className="series-unread">
                    {unreadCount === 0 ? 'ぜんぶ読んだ' : `未読 ${unreadCount}冊`}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {seriesList.length > 0 && (
        <footer className="footer-action dual-actions">
          <button
            type="button"
            className="primary-button scanner-bottom-button"
            onClick={onNavigateScanner}
          >
            バーコードで追加
          </button>
          <button
            type="button"
            className="secondary-button add-manual-button"
            onClick={() => onNavigateAdd()}
          >
            手動で追加
          </button>
        </footer>
      )}
    </div>
  );
};
