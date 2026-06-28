import { useState, useCallback } from "react";
import { useAppStore } from "../hooks/useAppStore";
import { db } from "../db/schema";

export default function LoginScreen() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useAppStore((s) => s.login);

  const handlePin = useCallback(
    async (num: number) => {
      if (pin.length >= 4 || loading) return;
      const newPin = pin + num;
      setPin(newPin);
      setError("");

      if (newPin.length === 4) {
  setLoading(true);
  try {
    // Get ANY nurse from the database
    const allNurses = await db.nurses.toArray();
    const nurse = allNurses[0];
    
    if (!nurse) {
      throw new Error('No nurse found in database');
    }
    
    login(nurse);
  } catch (err) {
    setError('Login failed: ' + (err as Error).message);
    setPin('');
  } finally {
    setLoading(false);
  }
}
    },
    [pin, loading, login],
  );

  const clearPin = useCallback(() => {
    setPin((p) => p.slice(0, -1));
    setError("");
  }, []);

  const shift = useAppStore((s) => s.currentShift);
  const ward = useAppStore((s) => s.currentWard);

  return (
    <div className="login-screen">
      <div className="logo-container">
        <div className="logo-glow" />
        <div className="logo">🔗</div>
      </div>
      <div className="app-name">Ward Link NG</div>
      <div className="tagline">Offline-First Handoff</div>

      {error && (
        <div
          style={{
            color: "#ff4757",
            fontSize: "14px",
            marginBottom: "20px",
            textAlign: "center",
          }}
        >
          {error}
        </div>
      )}

      <div className="pin-display">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`pin-dot ${i < pin.length ? "filled" : ""}`}
          />
        ))}
      </div>

      <div className="numpad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            className="numpad-btn"
            onClick={() => handlePin(num)}
            disabled={loading}
          >
            {num}
          </button>
        ))}
        <button className="numpad-btn" style={{ opacity: 0 }} disabled>
          •
        </button>
        <button
          className="numpad-btn"
          onClick={() => handlePin(0)}
          disabled={loading}
        >
          0
        </button>
        <button
          className="numpad-btn"
          onClick={clearPin}
          disabled={loading || pin.length === 0}
        >
          ⌫
        </button>
      </div>

      <div className="shift-info">
        Shift: <span>{shift.charAt(0).toUpperCase() + shift.slice(1)}</span> |
        Ward: <span>{ward}</span>
      </div>

      {loading && (
        <div style={{ marginTop: "20px", color: "#00d4ff", fontSize: "14px" }}>
          Unlocking...
        </div>
      )}
    </div>
  );
}
