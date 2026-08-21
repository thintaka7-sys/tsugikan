import React, { useEffect, useRef } from 'react';

type UndoToastProps = {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  durationMs?: number;
};

export const UndoToast: React.FC<UndoToastProps> = ({
  message,
  onUndo,
  onDismiss,
  durationMs = 5000,
}) => {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const startTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        onDismiss();
      }, durationMs);
    };

    // 初回タイマー開始
    startTimer();

    // スクロールやタップ・クリック操作が発生したらタイマーをリセット
    const handleInteraction = () => {
      startTimer();
    };

    window.addEventListener('scroll', handleInteraction, { passive: true });
    window.addEventListener('touchstart', handleInteraction, { passive: true });
    window.addEventListener('pointerdown', handleInteraction, { passive: true });
    window.addEventListener('click', handleInteraction, { passive: true });

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      window.removeEventListener('scroll', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('pointerdown', handleInteraction);
      window.removeEventListener('click', handleInteraction);
    };
  }, [onDismiss, durationMs]);

  return (
    <div className="undo-toast" role="alert">
      <span className="undo-toast-message">{message}</span>
      <button
        type="button"
        className="undo-toast-button"
        onClick={() => {
          onUndo();
          onDismiss();
        }}
      >
        とりけす
      </button>
    </div>
  );
};
