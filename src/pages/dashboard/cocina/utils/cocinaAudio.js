import { supabase } from '../../../../lib/supabaseClient';

const SOUND_BUCKET = 'notificacion';

const SOUND_FILES = Object.freeze({
  nuevoPedido: 'cocina-nuevo-pedido.mp3',
  pedidoListo: 'cocina-pedido-listo.mp3',
  altaDemanda: 'cocina-alta-demanda.mp3'
});

const SOUND_COOLDOWN_MS = Object.freeze({
  nuevoPedido: 1500,
  pedidoListo: 800,
  altaDemanda: 8000
});

const buildPublicAudioUrl = (filename) => {
  const { data } = supabase.storage.from(SOUND_BUCKET).getPublicUrl(filename);
  return String(data?.publicUrl || '').trim();
};

export const createCocinaAudioManager = () => {
  const audios = {};
  const lastPlayedAt = new Map();

  Object.entries(SOUND_FILES).forEach(([key, filename]) => {
    const url = buildPublicAudioUrl(filename);
    if (!url) return;
    const audio = new Audio(url);
    audio.preload = 'auto';
    audios[key] = audio;
  });

  const safePlay = async (key) => {
    const audio = audios[key];
    if (!audio) return false;

    const now = Date.now();
    const last = lastPlayedAt.get(key) || 0;
    const cooldown = SOUND_COOLDOWN_MS[key] || 0;
    if (now - last < cooldown) return false;

    lastPlayedAt.set(key, now);
    try {
      audio.currentTime = 0;
      await audio.play();
      return true;
    } catch {
      return false;
    }
  };

  const dispose = () => {
    Object.values(audios).forEach((audio) => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // AM: no romper flujo si el navegador bloquea APIs de audio.
      }
    });
  };

  return {
    playNuevoPedido: () => safePlay('nuevoPedido'),
    playPedidoListo: () => safePlay('pedidoListo'),
    playAltaDemanda: () => safePlay('altaDemanda'),
    dispose
  };
};
