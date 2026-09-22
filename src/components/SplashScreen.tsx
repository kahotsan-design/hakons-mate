import { useState, useEffect } from 'react';
import { useLang } from '../i18n';

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [phase, setPhase] = useState<'enter' | 'exit'>('enter');
  const { t } = useLang();

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('exit'), 400);
    const t2 = setTimeout(() => onFinish(), 700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onFinish]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: '#5B97CB',
      opacity: phase === 'exit' ? 0 : 1,
      transition: 'opacity 0.3s ease',
    }}>
      <div style={{ width: 120, height: 120 }}>
        <img
          src="/apple-touch-icon.png"
          alt="HAKON"
          style={{
            width: '100%', height: '100%',
            objectFit: 'contain',
            filter: 'drop-shadow(0 4px 24px rgba(186,230,253,0.35))',
          }}
        />
      </div>
      <div style={{
        marginTop: 20,
        fontSize: 26, fontWeight: 800, color: '#113050', letterSpacing: 2,
        textShadow: '0 2px 12px rgba(255,255,255,0.5)',
      }}>
        HAKON'S MATE
      </div>
      <div style={{
        marginTop: 8, fontSize: 16, color: 'rgba(22, 60, 91,0.8)', letterSpacing: 3,
      }}>
        {t('splash.tagline')}
      </div>    </div>
  );
}
