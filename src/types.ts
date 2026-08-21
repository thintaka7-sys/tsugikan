export type Series = {
  id: string;
  title: string;
  ownedVolumes: number[]; // 所持している巻 例: [1,2,3,5]
  readVolumes: number[];  // 既読の巻
  updatedAt: number;
  reading?: string;       // 読みがな（カタカナ・ひらがな等）
};

export type StorageData = {
  version: number;
  series: Series[];
  lastExportedAt?: number; // 最後に書き出した日時（ミリ秒タイムスタンプ）
};

