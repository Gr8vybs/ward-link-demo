import { useAppStore } from './hooks/useAppStore';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import HandoffScreen from './screens/HandoffScreen';
import AcknowledgeScreen from './screens/AcknowledgeScreen';
import SettingsScreen from './screens/SettingsScreen';

export default function App() {
  const currentScreen = useAppStore((s) => s.currentScreen);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#050505',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '430px',
          height: '100%',
          maxHeight: '932px',
          background: '#050505',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {currentScreen === 'login' && <LoginScreen />}
        {currentScreen === 'dashboard' && <DashboardScreen />}
        {currentScreen === 'handoff' && <HandoffScreen />}
        {currentScreen === 'acknowledge' && <AcknowledgeScreen />}
        {currentScreen === 'settings' && <SettingsScreen />}
      </div>
    </div>
  );
}