import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export const UpdatePrompt: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r?: ServiceWorkerRegistration) {
      if (r) {
        console.log('SW Registered:', r);
      }
    },
    onRegisterError(error: unknown) {
      console.error('SW registration error', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="pwa-update-toast" role="alert">
      <p className="pwa-update-message">新しいバージョンがあります</p>
      <div className="pwa-update-actions">
        <button
          type="button"
          className="pwa-update-button"
          onClick={() => updateServiceWorker(true)}
        >
          今すぐ更新
        </button>
        <button
          type="button"
          className="pwa-update-dismiss"
          onClick={() => setNeedRefresh(false)}
        >
          あとで
        </button>
      </div>
    </div>
  );
};
