import { useCallback, useRef } from 'react';

const playTone = (context, frequency, startAt, duration, gainNode) => {
  const oscillator = context.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, startAt);
  oscillator.connect(gainNode);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration);
};

// Reproduce una confirmacion breve despues de que el backend acepta el pedido.
export const useOrderSuccessSound = () => {
  const audioContextRef = useRef(null);

  return useCallback(() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      const context = audioContextRef.current || new AudioContextClass();
      audioContextRef.current = context;

      if (context.state === 'suspended') {
        void context.resume();
      }

      const now = context.currentTime;
      const gainNode = context.createGain();
      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.62);
      gainNode.connect(context.destination);

      playTone(context, 523.25, now, 0.16, gainNode);
      playTone(context, 659.25, now + 0.14, 0.16, gainNode);
      playTone(context, 783.99, now + 0.28, 0.28, gainNode);
    } catch {
      // Si el navegador bloquea audio, la confirmacion visual sigue funcionando.
    }
  }, []);
};

export default useOrderSuccessSound;
