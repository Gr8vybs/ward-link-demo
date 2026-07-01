import { useState, useEffect } from 'react';
import { useAppStore } from './hooks/useAppStore';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import HandoffScreen from './screens/HandoffScreen';
import AcknowledgeScreen from './screens/AcknowledgeScreen';
import SettingsScreen from './screens/SettingsScreen';

// PWA install prompt interface
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function App() {
  const currentScreen = useAppStore((s) => s.currentScreen);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallBanner(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setInstallPrompt(null);
  };

  const dismissInstall = () => {
    setShowInstallBanner(false);
  };

  return (
    <div className="phone-frame">
      {showInstallBanner && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(0, 212, 255, 0.05))',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(0, 212, 255, 0.3)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            animation: 'slideDown 0.4s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>📱</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>Install Ward Link</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Add to home screen for offline access</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button
              onClick={dismissInstall}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                border: '1px solid var(--glass-border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Later
            </button>
            <button
              onClick={handleInstall}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(0, 212, 255, 0.4)',
                background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.25), rgba(0, 212, 255, 0.1))',
                color: 'var(--primary)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 0 20px rgba(0, 212, 255, 0.15)',
              }}
            >
              Install
            </button>
          </div>
        </div>
      )}

      {/* FIX: Changed overflow from 'hidden' to 'auto' */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        {currentScreen === 'login' && <LoginScreen />}
        {currentScreen === 'dashboard' && <DashboardScreen />}
        {currentScreen === 'handoff' && <HandoffScreen />}
        {currentScreen === 'acknowledge' && <AcknowledgeScreen />}
        {currentScreen === 'settings' && <SettingsScreen />}
      </div>
    </div>
  );
}