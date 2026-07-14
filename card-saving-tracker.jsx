import React, { useState, useEffect, useCallback, useMemo } from "react";

// ---------- Timezone helpers (Asia/Jakarta, UTC+7, no DST) ----------
function jakartaDateString(d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d); // YYYY-MM-DD
}

function addDaysStr(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function formatIndoDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const bulan = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  return `${d} ${bulan[m - 1]} ${y}`;
}

// ---------- Default state ----------
const DEFAULT_SETTINGS = { reward_name: "Pack", target_days: 2 };

export default function CardSavingTracker() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [logs, setLogs] = useState({}); // { "YYYY-MM-DD": "no_spend" | "spend" }
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCelebration, setShowCelebration] = useState(null); // { days, rewardName }
  const [viewMonth, setViewMonth] = useState(() => {
    const t = jakartaDateString();
    return t.slice(0, 7); // YYYY-MM
  });
  const [error, setError] = useState("");

  const today = jakartaDateString();

  // ---------- Load from persistent storage ----------
  useEffect(() => {
    (async () => {
      try {
        let s = DEFAULT_SETTINGS;
        try {
          const r = await window.storage.get("settings", false);
          if (r && r.value) s = { ...DEFAULT_SETTINGS, ...JSON.parse(r.value) };
        } catch (_) {}

        let l = {};
        try {
          const r = await window.storage.get("logs", false);
          if (r && r.value) l = JSON.parse(r.value);
        } catch (_) {}

        setSettings(s);
        setLogs(l);
      } catch (e) {
        setError("Gagal memuat data. Coba muat ulang.");
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persistSettings = useCallback(async (next) => {
    try {
      await window.storage.set("settings", JSON.stringify(next), false);
    } catch (_) {
      setError("Gagal menyimpan pengaturan.");
    }
  }, []);

  const persistLogs = useCallback(async (next) => {
    try {
      await window.storage.set("logs", JSON.stringify(next), false);
    } catch (_) {
      setError("Gagal menyimpan data check-in.");
    }
  }, []);

  // ---------- Core computation: streak / best streak / rewards ----------
  const computed = useMemo(() => {
    const dates = Object.keys(logs).sort(); // ascending YYYY-MM-DD
    const targetDays = Math.max(1, Number(settings.target_days) || 2);

    let streak = 0;
    let best = 0;
    const rewards = [];

    for (const date of dates) {
      const status = logs[date];
      if (status === "no_spend") {
        streak += 1;
        if (streak > best) best = streak;
        if (streak >= targetDays) {
          rewards.push({ earned_date: date, reward_name: settings.reward_name, days: streak });
          streak = 0;
        }
      } else if (status === "spend") {
        streak = 0;
      }
    }

    return {
      currentStreak: streak,
      bestStreak: best,
      totalPack: rewards.length,
      rewards: rewards.reverse(), // most recent first
      targetDays,
    };
  }, [logs, settings]);

  const alreadyCheckedIn = Object.prototype.hasOwnProperty.call(logs, today);
  const todayStatus = logs[today];

  // ---------- Check-in handler ----------
  const handleCheckIn = useCallback(
    async (status) => {
      if (alreadyCheckedIn || saving) return;
      setSaving(true);
      setError("");
      try {
        const nextLogs = { ...logs, [today]: status };

        // Determine if this check-in completes a reward (recompute quickly)
        const targetDays = Math.max(1, Number(settings.target_days) || 2);
        let streak = 0;
        const dates = Object.keys(nextLogs).sort();
        let justEarned = null;
        for (const date of dates) {
          const s = nextLogs[date];
          if (s === "no_spend") {
            streak += 1;
            if (streak >= targetDays) {
              if (date === today) justEarned = streak;
              streak = 0;
            }
          } else {
            streak = 0;
          }
        }

        setLogs(nextLogs);
        await persistLogs(nextLogs);

        if (justEarned) {
          setShowCelebration({ days: justEarned, rewardName: settings.reward_name });
        }
      } finally {
        setSaving(false);
      }
    },
    [alreadyCheckedIn, saving, logs, today, settings, persistLogs]
  );

  // ---------- Settings save ----------
  const handleSaveSettings = useCallback(
    async (nextSettings) => {
      setSettings(nextSettings);
      await persistSettings(nextSettings);
      setShowSettings(false);
    },
    [persistSettings]
  );

  // ---------- Calendar data for viewMonth ----------
  const calendarDays = useMemo(() => {
    const [y, m] = viewMonth.split("-").map(Number);
    const firstOfMonth = new Date(Date.UTC(y, m - 1, 1));
    const startWeekday = firstOfMonth.getUTCDay(); // 0=Sun
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ day: d, dateStr, status: logs[dateStr] || null });
    }
    return cells;
  }, [viewMonth, logs]);

  const monthLabel = useMemo(() => {
    const [y, m] = viewMonth.split("-").map(Number);
    const bulan = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember",
    ];
    return `${bulan[m - 1]} ${y}`;
  }, [viewMonth]);

  const shiftMonth = (delta) => {
    const [y, m] = viewMonth.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
    setViewMonth(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`);
  };

  const progressPct = Math.min(100, Math.round((computed.currentStreak / computed.targetDays) * 100));

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", background: "#12121b", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#8d8ba3", fontFamily: "Inter, sans-serif" }}>Memuat…</div>
      </div>
    );
  }

  return (
    <div className="cst-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap');

        .cst-root {
          --bg: #12121b;
          --surface: #1c1c29;
          --surface-2: #242435;
          --border: #2f2f42;
          --gold: #f2c14e;
          --holo: #8b7cf6;
          --success: #43d17a;
          --danger: #ef5b6b;
          --text: #f1f0f5;
          --text-muted: #8d8ba3;
          min-height: 100vh;
          background:
            radial-gradient(circle at 20% -10%, rgba(139,124,246,0.18), transparent 45%),
            radial-gradient(circle at 90% 0%, rgba(242,193,78,0.12), transparent 40%),
            var(--bg);
          color: var(--text);
          font-family: 'Inter', sans-serif;
          padding: 20px 16px 48px;
        }
        .cst-max { max-width: 480px; margin: 0 auto; }
        .cst-eyebrow {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--holo);
        }
        .cst-h1 {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 26px;
          margin: 4px 0 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .cst-gear {
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--text-muted);
          width: 36px; height: 36px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          font-size: 16px;
        }
        .cst-gear:hover { color: var(--gold); border-color: var(--gold); }

        .cst-stats-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 12px;
        }
        .cst-stat-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 14px;
        }
        .cst-stat-label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-muted);
          margin-bottom: 6px;
        }
        .cst-stat-value {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 24px;
        }

        .cst-progress-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 16px;
          margin-bottom: 12px;
        }
        .cst-progress-top {
          display: flex; justify-content: space-between; align-items: baseline;
          margin-bottom: 10px;
        }
        .cst-progress-title { font-size: 13px; color: var(--text-muted); }
        .cst-progress-count {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          color: var(--gold);
        }
        .cst-progress-track {
          height: 10px;
          border-radius: 999px;
          background: var(--surface-2);
          overflow: hidden;
          border: 1px solid var(--border);
        }
        .cst-progress-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, var(--holo), var(--gold));
          transition: width 0.4s ease;
        }

        .cst-pack-card {
          background: linear-gradient(135deg, rgba(139,124,246,0.16), rgba(242,193,78,0.12));
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 16px;
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 18px;
        }
        .cst-pack-label { font-size: 13px; color: var(--text-muted); }
        .cst-pack-value {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700; font-size: 26px;
        }

        .cst-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 22px; }
        .cst-btn {
          border: none; border-radius: 14px; padding: 16px 8px;
          font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 15px;
          cursor: pointer; transition: transform 0.15s ease, opacity 0.15s ease;
        }
        .cst-btn:active { transform: scale(0.97); }
        .cst-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .cst-btn-good { background: var(--success); color: #0c1f14; }
        .cst-btn-bad { background: var(--danger); color: #2a0d10; }
        .cst-checkin-status {
          text-align: center;
          font-size: 13px;
          color: var(--text-muted);
          margin: -12px 0 22px;
          font-family: 'JetBrains Mono', monospace;
        }

        .cst-section-title {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700; font-size: 16px;
          margin: 0 0 12px;
        }

        .cst-cal-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 14px; padding: 16px; margin-bottom: 18px;
        }
        .cst-cal-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .cst-cal-navbtn {
          background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
          width: 28px; height: 28px; border-radius: 8px; cursor: pointer; font-size: 13px;
        }
        .cst-cal-month { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--text-muted); }
        .cst-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
        .cst-cal-dow { font-size: 10px; text-align: center; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; }
        .cst-cal-cell {
          aspect-ratio: 1; border-radius: 8px; display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-family: 'JetBrains Mono', monospace;
          border: 1px solid transparent;
        }
        .cst-cal-empty { visibility: hidden; }
        .cst-cal-none { background: var(--surface-2); color: var(--text-muted); border-color: var(--border); }
        .cst-cal-good { background: rgba(67,209,122,0.22); color: var(--success); border-color: rgba(67,209,122,0.4); }
        .cst-cal-bad { background: rgba(239,91,107,0.2); color: var(--danger); border-color: rgba(239,91,107,0.4); }
        .cst-cal-today { box-shadow: 0 0 0 1.5px var(--gold) inset; }
        .cst-legend { display: flex; gap: 14px; margin-top: 12px; font-size: 11px; color: var(--text-muted); }
        .cst-legend-dot { width: 8px; height: 8px; border-radius: 3px; display: inline-block; margin-right: 5px; }

        .cst-history-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 14px; padding: 6px 16px; margin-bottom: 18px;
        }
        .cst-history-title { padding-top: 14px; }
        .cst-history-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px 0; border-top: 1px solid var(--border);
          font-size: 13px;
        }
        .cst-history-row:first-of-type { border-top: none; }
        .cst-history-date { color: var(--text); }
        .cst-history-days { color: var(--text-muted); font-size: 11px; font-family: 'JetBrains Mono', monospace; }
        .cst-history-plus { color: var(--gold); font-family: 'JetBrains Mono', monospace; font-weight: 700; }
        .cst-empty-note { color: var(--text-muted); font-size: 13px; padding: 16px 0; text-align: center; }

        .cst-modal-backdrop {
          position: fixed; inset: 0; background: rgba(8,8,14,0.72);
          display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px;
        }
        .cst-modal {
          background: var(--surface); border: 1px solid var(--border); border-radius: 18px;
          padding: 24px; width: 100%; max-width: 380px;
        }
        .cst-modal-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 18px; margin-bottom: 16px; }
        .cst-field { margin-bottom: 16px; }
        .cst-field label { display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 6px; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 0.06em; }
        .cst-field input {
          width: 100%; box-sizing: border-box; background: var(--surface-2); border: 1px solid var(--border);
          color: var(--text); border-radius: 10px; padding: 10px 12px; font-size: 15px; font-family: 'Inter', sans-serif;
        }
        .cst-field input:focus { outline: 2px solid var(--holo); outline-offset: 1px; }
        .cst-modal-actions { display: flex; gap: 10px; margin-top: 18px; }
        .cst-modal-btn { flex: 1; border: none; border-radius: 10px; padding: 12px; font-weight: 600; cursor: pointer; font-size: 14px; }
        .cst-modal-cancel { background: var(--surface-2); color: var(--text-muted); border: 1px solid var(--border); }
        .cst-modal-save { background: var(--gold); color: #241a02; }

        .cst-celebration { text-align: center; }
        .cst-celebration-emoji { font-size: 46px; margin-bottom: 10px; }
        .cst-celebration-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 20px; margin-bottom: 8px; }
        .cst-celebration-body { color: var(--text-muted); font-size: 14px; margin-bottom: 20px; line-height: 1.5; }
        .cst-celebration-btn {
          background: linear-gradient(90deg, var(--holo), var(--gold)); border: none; color: #14101f;
          font-weight: 700; padding: 12px 20px; border-radius: 10px; cursor: pointer; width: 100%; font-family: 'Space Grotesk', sans-serif;
        }

        .cst-error { background: rgba(239,91,107,0.14); border: 1px solid rgba(239,91,107,0.4); color: var(--danger);
          padding: 10px 12px; border-radius: 10px; font-size: 13px; margin-bottom: 14px; }

        @media (prefers-reduced-motion: reduce) {
          .cst-progress-fill, .cst-btn { transition: none; }
        }
      `}</style>

      <div className="cst-max">
        <div className="cst-eyebrow">Card Saving Tracker</div>
        <div className="cst-h1">
          Kebiasaan Menabung
          <button className="cst-gear" onClick={() => setShowSettings(true)} aria-label="Pengaturan">⚙</button>
        </div>

        {error && <div className="cst-error">{error}</div>}

        <div className="cst-stats-row">
          <div className="cst-stat-card">
            <div className="cst-stat-label">Current Streak</div>
            <div className="cst-stat-value">🔥 {computed.currentStreak} Hari</div>
          </div>
          <div className="cst-stat-card">
            <div className="cst-stat-label">Best Streak</div>
            <div className="cst-stat-value">🏆 {computed.bestStreak} Hari</div>
          </div>
        </div>

        <div className="cst-progress-card">
          <div className="cst-progress-top">
            <span className="cst-progress-title">Progress menuju reward</span>
            <span className="cst-progress-count">{computed.currentStreak} / {computed.targetDays} Hari</span>
          </div>
          <div className="cst-progress-track">
            <div className="cst-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="cst-pack-card">
          <span className="cst-pack-label">Total Reward</span>
          <span className="cst-pack-value">📦 {computed.totalPack} {settings.reward_name}</span>
        </div>

        <div className="cst-actions">
          <button
            className="cst-btn cst-btn-good"
            disabled={alreadyCheckedIn || saving}
            onClick={() => handleCheckIn("no_spend")}
          >
            ✅ Tidak Jajan
          </button>
          <button
            className="cst-btn cst-btn-bad"
            disabled={alreadyCheckedIn || saving}
            onClick={() => handleCheckIn("spend")}
          >
            ❌ Jajan
          </button>
        </div>
        <div className="cst-checkin-status">
          {alreadyCheckedIn
            ? `Sudah check-in hari ini: ${todayStatus === "no_spend" ? "✅ Tidak Jajan" : "❌ Jajan"}`
            : "Belum check-in hari ini"}
        </div>

        <div className="cst-cal-card">
          <div className="cst-cal-nav">
            <button className="cst-cal-navbtn" onClick={() => shiftMonth(-1)} aria-label="Bulan sebelumnya">‹</button>
            <span className="cst-cal-month">{monthLabel}</span>
            <button className="cst-cal-navbtn" onClick={() => shiftMonth(1)} aria-label="Bulan berikutnya">›</button>
          </div>
          <div className="cst-cal-grid">
            {["M", "S", "S", "R", "K", "J", "S"].map((d, i) => (
              <div key={i} className="cst-cal-dow">{d}</div>
            ))}
            {calendarDays.map((cell, i) => {
              if (!cell) return <div key={i} className="cst-cal-cell cst-cal-empty" />;
              const cls = cell.status === "no_spend" ? "cst-cal-good" : cell.status === "spend" ? "cst-cal-bad" : "cst-cal-none";
              const isToday = cell.dateStr === today;
              return (
                <div key={i} className={`cst-cal-cell ${cls} ${isToday ? "cst-cal-today" : ""}`}>
                  {cell.day}
                </div>
              );
            })}
          </div>
          <div className="cst-legend">
            <span><span className="cst-legend-dot" style={{ background: "var(--success)" }} />Tidak Jajan</span>
            <span><span className="cst-legend-dot" style={{ background: "var(--danger)" }} />Jajan</span>
            <span><span className="cst-legend-dot" style={{ background: "var(--surface-2)" }} />Belum Check In</span>
          </div>
        </div>

        <div className="cst-history-card">
          <div className="cst-section-title cst-history-title">Riwayat Reward</div>
          {computed.rewards.length === 0 && (
            <div className="cst-empty-note">Belum ada reward. Mulai check-in untuk mendapatkan {settings.reward_name} pertamamu.</div>
          )}
          {computed.rewards.map((r, i) => (
            <div key={i} className="cst-history-row">
              <div>
                <div className="cst-history-date">{formatIndoDate(r.earned_date)}</div>
                <div className="cst-history-days">{r.days} hari berturut-turut tidak jajan</div>
              </div>
              <div className="cst-history-plus">+1 {r.reward_name}</div>
            </div>
          ))}
        </div>
      </div>

      {showSettings && (
        <SettingsModal
          initial={settings}
          onCancel={() => setShowSettings(false)}
          onSave={handleSaveSettings}
        />
      )}

      {showCelebration && (
        <div className="cst-modal-backdrop" role="dialog" aria-modal="true">
          <div className="cst-modal cst-celebration">
            <div className="cst-celebration-emoji">🎉</div>
            <div className="cst-celebration-title">Selamat!</div>
            <div className="cst-celebration-body">
              Kamu berhasil mendapatkan 1 {showCelebration.rewardName} karena berhasil tidak jajan selama {showCelebration.days} hari.
            </div>
            <button className="cst-celebration-btn" onClick={() => setShowCelebration(null)}>Ambil Reward</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsModal({ initial, onCancel, onSave }) {
  const [rewardName, setRewardName] = useState(initial.reward_name);
  const [targetDays, setTargetDays] = useState(String(initial.target_days));

  const handleSave = () => {
    const t = Math.max(1, parseInt(targetDays, 10) || 2);
    const n = (rewardName || "").trim() || "Pack";
    onSave({ reward_name: n, target_days: t });
  };

  return (
    <div className="cst-modal-backdrop" role="dialog" aria-modal="true">
      <div className="cst-modal">
        <div className="cst-modal-title">Pengaturan</div>
        <div className="cst-field">
          <label htmlFor="rewardName">Reward Name</label>
          <input
            id="rewardName"
            type="text"
            value={rewardName}
            onChange={(e) => setRewardName(e.target.value)}
            placeholder="Pack Pokémon"
          />
        </div>
        <div className="cst-field">
          <label htmlFor="targetDays">Target (Hari)</label>
          <input
            id="targetDays"
            type="number"
            min="1"
            value={targetDays}
            onChange={(e) => setTargetDays(e.target.value)}
          />
        </div>
        <div className="cst-modal-actions">
          <button className="cst-modal-btn cst-modal-cancel" onClick={onCancel}>Batal</button>
          <button className="cst-modal-btn cst-modal-save" onClick={handleSave}>Simpan</button>
        </div>
      </div>
    </div>
  );
}
