import { useState, useEffect, useCallback } from 'react';
import { Series, StorageData } from '../types';
import { createVolumeArray, getMaxVolume } from '../utils/series';

const STORAGE_KEY = 'tsugikan.v1';

/**
 * バージョンマイグレーション処理の集約エントリーポイント
 * Phase 5: version 1, 2 → version 3（lastExportedAt のサポート、version番号の更新）
 */
export function migrateData(data: StorageData): StorageData {
  switch (data.version) {
    case 1: {
      const migratedSeries = data.series.map((s) => ({
        ...s,
        reading: s.reading !== undefined ? s.reading : '',
      }));
      return {
        version: 3,
        series: migratedSeries,
        lastExportedAt: data.lastExportedAt,
      };
    }
    case 2: {
      const ensuredSeries = data.series.map((s) => ({
        ...s,
        reading: s.reading !== undefined ? s.reading : '',
      }));
      return {
        version: 3,
        series: ensuredSeries,
        lastExportedAt: data.lastExportedAt,
      };
    }
    case 3:
    default: {
      const ensuredSeries = data.series.map((s) => ({
        ...s,
        reading: s.reading !== undefined ? s.reading : '',
      }));
      return {
        version: 3,
        series: ensuredSeries,
        lastExportedAt: data.lastExportedAt,
      };
    }
  }
}

function loadFromStorage(): StorageData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { version: 3, series: [] };
    }
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.version === 'number' &&
      Array.isArray(parsed.series)
    ) {
      const validSeries: Series[] = parsed.series
        .filter((s: unknown): s is Series => {
          if (typeof s !== 'object' || s === null) return false;
          const candidate = s as Record<string, unknown>;
          return (
            typeof candidate.id === 'string' &&
            typeof candidate.title === 'string' &&
            Array.isArray(candidate.ownedVolumes) &&
            Array.isArray(candidate.readVolumes) &&
            typeof candidate.updatedAt === 'number'
          );
        })
        .map((s: Series) => ({
          id: s.id,
          title: s.title,
          ownedVolumes: s.ownedVolumes.map(Number).filter((n) => !isNaN(n) && n > 0),
          readVolumes: s.readVolumes.map(Number).filter((n) => !isNaN(n) && n >= 0),
          updatedAt: s.updatedAt,
          reading: typeof s.reading === 'string' ? s.reading : '',
        }));

      const storageData: StorageData = {
        version: parsed.version,
        series: validSeries,
        lastExportedAt: typeof parsed.lastExportedAt === 'number' ? parsed.lastExportedAt : undefined,
      };

      return migrateData(storageData);
    }
    return { version: 3, series: [] };
  } catch {
    return { version: 3, series: [] };
  }
}

function saveToStorage(data: StorageData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save to localStorage', error);
  }
}

export function useLibrary() {
  const [data, setData] = useState<StorageData>(() => loadFromStorage());

  useEffect(() => {
    saveToStorage(data);
  }, [data]);

  const seriesList = [...data.series].sort((a, b) => b.updatedAt - a.updatedAt);

  const getSeries = useCallback(
    (id: string): Series | undefined => {
      return data.series.find((s) => s.id === id);
    },
    [data.series]
  );

  const addSeries = useCallback(
    (
      title: string,
      ownedCount: number,
      readCount: number,
      reading?: string,
      customOwnedVolumes?: number[]
    ) => {
      const sanitizedTitle = title.trim();
      if (!sanitizedTitle) return;

      const safeOwned = Math.max(1, Math.floor(ownedCount || 1));
      const safeRead = Math.max(0, Math.min(Math.floor(readCount || 0), safeOwned));

      const ownedVolumes =
        customOwnedVolumes && customOwnedVolumes.length > 0
          ? [...customOwnedVolumes].sort((a, b) => a - b)
          : createVolumeArray(safeOwned);

      const newSeries: Series = {
        id: crypto.randomUUID(),
        title: sanitizedTitle,
        ownedVolumes,
        readVolumes: createVolumeArray(safeRead),
        updatedAt: Date.now(),
        reading: reading || '',
      };

      setData((prev) => ({
        ...prev,
        series: [newSeries, ...prev.series],
      }));
    },
    []
  );

  const addSeriesSingleVolume = useCallback(
    (title: string, volume: number, reading?: string) => {
      const sanitizedTitle = title.trim();
      if (!sanitizedTitle) return;

      const safeVolume = Math.max(1, Math.floor(volume || 1));

      const newSeries: Series = {
        id: crypto.randomUUID(),
        title: sanitizedTitle,
        ownedVolumes: [safeVolume],
        readVolumes: [],
        updatedAt: Date.now(),
        reading: reading || '',
      };

      setData((prev) => ({
        ...prev,
        series: [newSeries, ...prev.series],
      }));
    },
    []
  );

  const addVolumeToSeries = useCallback(
    (id: string, volume: number, reading?: string) => {
      const safeVolume = Math.max(1, Math.floor(volume || 1));

      setData((prev) => {
        const target = prev.series.find((s) => s.id === id);
        if (!target) return prev;

        const newOwned = target.ownedVolumes.includes(safeVolume)
          ? target.ownedVolumes
          : [...target.ownedVolumes, safeVolume].sort((a, b) => a - b);

        const newReading =
          (!target.reading || target.reading.trim() === '') && reading
            ? reading.trim()
            : target.reading || '';

        const updated: Series = {
          ...target,
          ownedVolumes: newOwned,
          reading: newReading,
          updatedAt: Date.now(),
        };

        return {
          ...prev,
          series: prev.series.map((s) => (s.id === id ? updated : s)),
        };
      });
    },
    []
  );

  const toggleVolume = useCallback((id: string, volume: number) => {
    const safeVolume = Math.max(1, Math.floor(volume));

    setData((prev) => {
      const target = prev.series.find((s) => s.id === id);
      if (!target) return prev;

      let newOwned: number[];
      let newRead = target.readVolumes;

      if (target.ownedVolumes.includes(safeVolume)) {
        // 所持から外す（既読からも外す）
        newOwned = target.ownedVolumes.filter((v) => v !== safeVolume);
        newRead = target.readVolumes.filter((v) => v !== safeVolume);
      } else {
        // 所持に追加
        newOwned = [...target.ownedVolumes, safeVolume].sort((a, b) => a - b);
      }

      const updated: Series = {
        ...target,
        ownedVolumes: newOwned,
        readVolumes: newRead,
        updatedAt: Date.now(),
      };

      return {
        ...prev,
        series: prev.series.map((s) => (s.id === id ? updated : s)),
      };
    });
  }, []);

  const setVolumesBatch = useCallback((id: string, volumes: number[], isOwned: boolean) => {
    if (!volumes || volumes.length === 0) return;

    setData((prev) => {
      const target = prev.series.find((s) => s.id === id);
      if (!target) return prev;

      let newOwned: number[];
      let newRead = target.readVolumes;
      const volSet = new Set(volumes);

      if (isOwned) {
        // 一括所持追加
        const mergedSet = new Set([...target.ownedVolumes, ...volumes]);
        newOwned = Array.from(mergedSet).sort((a, b) => a - b);
      } else {
        // 一括未所持設定（既読からも外す）
        newOwned = target.ownedVolumes.filter((v) => !volSet.has(v));
        newRead = target.readVolumes.filter((v) => !volSet.has(v));
      }

      const updated: Series = {
        ...target,
        ownedVolumes: newOwned,
        readVolumes: newRead,
        updatedAt: Date.now(),
      };

      return {
        ...prev,
        series: prev.series.map((s) => (s.id === id ? updated : s)),
      };
    });
  }, []);

  const updateSeries = useCallback(
    (
      id: string,
      updates: { title?: string; ownedCount?: number; readCount?: number; reading?: string }
    ) => {
      setData((prev) => {
        const target = prev.series.find((s) => s.id === id);
        if (!target) return prev;

        const newTitle = updates.title !== undefined ? updates.title.trim() : target.title;
        const newReading = updates.reading !== undefined ? updates.reading.trim() : target.reading || '';
        let newOwned = target.ownedVolumes;
        let newRead = target.readVolumes;

        // 最大巻数の変更（既存の抜けを保持する）
        if (updates.ownedCount !== undefined) {
          const newMax = Math.max(0, Math.floor(updates.ownedCount));
          const currentMax = getMaxVolume(target.ownedVolumes);

          if (newMax > currentMax) {
            // 最大値が増えた場合: 差分巻 (currentMax + 1 .. newMax) を追加（既存の抜けはそのまま）
            const additional: number[] = [];
            for (let v = currentMax + 1; v <= newMax; v++) {
              additional.push(v);
            }
            newOwned = [...target.ownedVolumes, ...additional].sort((a, b) => a - b);
          } else if (newMax < currentMax) {
            // 最大値が減った場合: newMax 以下の巻のみ残す
            newOwned = target.ownedVolumes.filter((v) => v <= newMax);
            newRead = target.readVolumes.filter((v) => v <= newMax);
          }
        }

        if (updates.readCount !== undefined) {
          const maxOwned = getMaxVolume(newOwned);
          const count = Math.max(0, Math.min(Math.floor(updates.readCount), maxOwned));
          newRead = createVolumeArray(count);
        } else if (updates.ownedCount !== undefined) {
          const maxOwned = getMaxVolume(newOwned);
          newRead = newRead.filter((v) => v <= maxOwned);
        }

        const updated: Series = {
          ...target,
          title: newTitle || target.title,
          ownedVolumes: newOwned,
          readVolumes: newRead,
          reading: newReading,
          updatedAt: Date.now(),
        };

        return {
          ...prev,
          series: prev.series.map((s) => (s.id === id ? updated : s)),
        };
      });
    },
    []
  );

  const buyNext = useCallback(
    (id: string): Series | null => {
      const target = data.series.find((s) => s.id === id);
      if (!target) return null;

      const snapshot: Series = {
        id: target.id,
        title: target.title,
        ownedVolumes: [...target.ownedVolumes],
        readVolumes: [...target.readVolumes],
        updatedAt: target.updatedAt,
        reading: target.reading,
      };

      const currentMax = getMaxVolume(target.ownedVolumes);
      const nextVol = currentMax + 1;
      const newOwned = target.ownedVolumes.includes(nextVol)
        ? target.ownedVolumes
        : [...target.ownedVolumes, nextVol].sort((a, b) => a - b);

      const updated: Series = {
        ...target,
        ownedVolumes: newOwned,
        updatedAt: Date.now(),
      };

      setData((prev) => ({
        ...prev,
        series: prev.series.map((s) => (s.id === id ? updated : s)),
      }));

      return snapshot;
    },
    [data.series]
  );

  const readNext = useCallback(
    (id: string): Series | null => {
      const target = data.series.find((s) => s.id === id);
      if (!target) return null;

      const ownedMax = getMaxVolume(target.ownedVolumes);
      const readMax = getMaxVolume(target.readVolumes);

      if (readMax >= ownedMax) {
        return null;
      }

      const snapshot: Series = {
        id: target.id,
        title: target.title,
        ownedVolumes: [...target.ownedVolumes],
        readVolumes: [...target.readVolumes],
        updatedAt: target.updatedAt,
        reading: target.reading,
      };

      const nextVol = readMax + 1;
      const newRead = target.readVolumes.includes(nextVol)
        ? target.readVolumes
        : [...target.readVolumes, nextVol].sort((a, b) => a - b);

      const updated: Series = {
        ...target,
        readVolumes: newRead,
        updatedAt: Date.now(),
      };

      setData((prev) => ({
        ...prev,
        series: prev.series.map((s) => (s.id === id ? updated : s)),
      }));

      return snapshot;
    },
    [data.series]
  );

  const restoreSeries = useCallback((snapshot: Series) => {
    setData((prev) => {
      const exists = prev.series.some((s) => s.id === snapshot.id);
      const restoredSeries: Series = {
        id: snapshot.id,
        title: snapshot.title,
        ownedVolumes: [...snapshot.ownedVolumes],
        readVolumes: [...snapshot.readVolumes],
        updatedAt: snapshot.updatedAt,
        reading: snapshot.reading,
      };

      if (!exists) {
        return {
          ...prev,
          series: [restoredSeries, ...prev.series],
        };
      }

      return {
        ...prev,
        series: prev.series.map((s) => (s.id === snapshot.id ? restoredSeries : s)),
      };
    });
  }, []);

  const deleteSeries = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      series: prev.series.filter((s) => s.id !== id),
    }));
  }, []);

  const exportData = useCallback((): StorageData => {
    const now = Date.now();
    const updatedData: StorageData = {
      ...data,
      version: 3,
      lastExportedAt: now,
    };
    setData(updatedData);
    return updatedData;
  }, [data]);

  const importData = useCallback((newData: StorageData) => {
    const migrated = migrateData(newData);
    setData(migrated);
  }, []);

  const fillMissingVolumes = useCallback(
    (id: string): Series | null => {
      const target = data.series.find((s) => s.id === id);
      if (!target) return null;

      const max = getMaxVolume(target.ownedVolumes);
      if (max <= 0) return null;

      const snapshot: Series = {
        id: target.id,
        title: target.title,
        ownedVolumes: [...target.ownedVolumes],
        readVolumes: [...target.readVolumes],
        updatedAt: target.updatedAt,
        reading: target.reading,
      };

      const newOwned = createVolumeArray(max);

      const updated: Series = {
        ...target,
        ownedVolumes: newOwned,
        updatedAt: Date.now(),
      };

      setData((prev) => ({
        ...prev,
        series: prev.series.map((s) => (s.id === id ? updated : s)),
      }));

      return snapshot;
    },
    [data.series]
  );

  const clearAll = useCallback(() => {
    setData({
      version: 3,
      series: [],
    });
  }, []);

  return {
    seriesList,
    lastExportedAt: data.lastExportedAt,
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
  };
}


