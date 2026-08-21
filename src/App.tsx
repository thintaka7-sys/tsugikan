import { useState, useEffect, useCallback } from 'react';
import { useLibrary } from './hooks/useLibrary';
import { HomeView } from './components/HomeView';
import { AddView } from './components/AddView';
import { DetailView } from './components/DetailView';
import { SettingsView } from './components/SettingsView';
import { ScannerView, ScanSuccessPayload } from './components/ScannerView';
import { ScanConfirmView } from './components/ScanConfirmView';
import { UpdatePrompt } from './components/UpdatePrompt';

type ViewMode = 'home' | 'add' | 'detail' | 'settings' | 'scanner' | 'scan-confirm';

type HistoryState = {
  view: ViewMode;
  id?: string | null;
  initialTitle?: string;
  scanPayload?: ScanSuccessPayload | null;
};

export function App() {
  const [currentView, setCurrentView] = useState<ViewMode>('home');
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [initialAddTitle, setInitialAddTitle] = useState<string | undefined>(undefined);
  const [scanPayload, setScanPayload] = useState<ScanSuccessPayload | null>(null);

  const {
    seriesList,
    lastExportedAt,
    getSeries,
    addSeries,
    addSeriesSingleVolume,
    addVolumeToSeries,
    toggleVolume,
    setVolumesBatch,
    fillMissingVolumes,
    updateSeries,
    buyNext,
    readNext,
    restoreSeries,
    deleteSeries,
    exportData,
    importData,
    clearAll,
  } = useLibrary();

  // History API との連動
  const navigateTo = useCallback(
    (
      view: ViewMode,
      options?: {
        id?: string | null;
        initialTitle?: string;
        scanPayload?: ScanSuccessPayload | null;
        replace?: boolean;
      }
    ) => {
      const targetId = options?.id !== undefined ? options.id : null;
      const targetTitle = options?.initialTitle !== undefined ? options.initialTitle : undefined;
      const targetPayload = options?.scanPayload !== undefined ? options.scanPayload : null;

      setSelectedSeriesId(targetId);
      setInitialAddTitle(targetTitle);
      setScanPayload(targetPayload);
      setCurrentView(view);

      const state: HistoryState = {
        view,
        id: targetId,
        initialTitle: targetTitle,
        scanPayload: targetPayload,
      };

      if (options?.replace) {
        window.history.replaceState(state, '');
      } else {
        window.history.pushState(state, '');
      }
    },
    []
  );

  useEffect(() => {
    // 初回ロード時の履歴ステート設定
    if (!window.history.state || !window.history.state.view) {
      window.history.replaceState({ view: 'home' } as HistoryState, '');
    }

    const handlePopState = (e: PopStateEvent) => {
      const state = e.state as HistoryState | null;
      if (state && state.view) {
        setCurrentView(state.view);
        setSelectedSeriesId(state.id || null);
        setInitialAddTitle(state.initialTitle || undefined);
        setScanPayload(state.scanPayload || null);
      } else {
        setCurrentView('home');
        setSelectedSeriesId(null);
        setInitialAddTitle(undefined);
        setScanPayload(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSelectSeries = (id: string) => {
    navigateTo('detail', { id });
  };

  const handleNavigateAdd = (initialTitle?: string) => {
    navigateTo('add', { initialTitle });
  };

  const handleNavigateScanner = () => {
    navigateTo('scanner');
  };

  const handleNavigateSettings = () => {
    navigateTo('settings');
  };

  const handleBack = () => {
    // 画面内の「もどる」ボタンもブラウザの戻る操作と連動
    if (window.history.length > 1 && currentView !== 'home') {
      window.history.back();
    } else {
      navigateTo('home', { replace: true });
    }
  };

  const handleAddSubmit = (
    title: string,
    ownedCount: number,
    readCount: number,
    reading?: string,
    customOwnedVolumes?: number[]
  ) => {
    addSeries(title, ownedCount, readCount, reading, customOwnedVolumes);
    navigateTo('home', { replace: true });
  };

  const handleScanSuccess = (payload: ScanSuccessPayload) => {
    navigateTo('scan-confirm', { scanPayload: payload });
  };

  const handleScanConfirmSave = (
    title: string,
    volume: number,
    existingSeriesId: string | null,
    reading?: string
  ) => {
    if (existingSeriesId) {
      addVolumeToSeries(existingSeriesId, volume, reading);
    } else {
      addSeriesSingleVolume(title, volume, reading);
    }

    // 書店で複数冊連続スキャンするため、保存後はスキャナ画面へ復帰
    navigateTo('scanner', { replace: true });
  };

  const handleScanNext = () => {
    navigateTo('scanner', { replace: true });
  };

  const handleManualFallbackFromScanner = (isbn?: string) => {
    navigateTo('add', { initialTitle: isbn || undefined, replace: true });
  };

  const selectedSeries = selectedSeriesId ? getSeries(selectedSeriesId) : undefined;

  return (
    <div className="app-container">
      {currentView === 'home' && (
        <HomeView
          seriesList={seriesList}
          onSelectSeries={handleSelectSeries}
          onNavigateAdd={handleNavigateAdd}
          onNavigateScanner={handleNavigateScanner}
          onNavigateSettings={handleNavigateSettings}
        />
      )}

      {currentView === 'scanner' && (
        <ScannerView
          seriesList={seriesList}
          onBack={handleBack}
          onScanSuccess={handleScanSuccess}
          onManualFallback={handleManualFallbackFromScanner}
        />
      )}

      {currentView === 'scan-confirm' && scanPayload && (
        <ScanConfirmView
          scanPayload={scanPayload}
          seriesList={seriesList}
          onSave={handleScanConfirmSave}
          onScanNext={handleScanNext}
          onBackToHome={handleBack}
        />
      )}

      {currentView === 'add' && (
        <AddView
          initialTitle={initialAddTitle}
          onAdd={handleAddSubmit}
          onCancel={handleBack}
        />
      )}

      {currentView === 'detail' && selectedSeries && (
        <DetailView
          series={selectedSeries}
          onBack={handleBack}
          onBuyNext={buyNext}
          onReadNext={readNext}
          onRestore={restoreSeries}
          onUpdate={updateSeries}
          onToggleVolume={toggleVolume}
          onSetVolumesBatch={setVolumesBatch}
          onFillMissing={fillMissingVolumes}
          onDelete={deleteSeries}
        />
      )}

      {currentView === 'detail' && !selectedSeries && (
        <div className="empty-state">
          <p className="empty-message">本が見つかりませんでした。</p>
          <button type="button" className="primary-button" onClick={handleBack}>
            一覧にもどる
          </button>
        </div>
      )}

      {currentView === 'settings' && (
        <SettingsView
          onBack={handleBack}
          lastExportedAt={lastExportedAt}
          exportData={exportData}
          importData={importData}
          clearAll={clearAll}
        />
      )}

      {/* Service Worker 更新通知プロンプト */}
      <UpdatePrompt />
    </div>
  );
}

export default App;

