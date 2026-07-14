export const THEMES = [
  { key: "sakura", label: "Sakura", icon: "🌸", colors: ["#FF6FAE", "#FFC7DE"] },
  { key: "strawberry", label: "Strawberry", icon: "🍓", colors: ["#EF5F7A", "#FFC2C9"] },
  { key: "lavender", label: "Lavender", icon: "💜", colors: ["#A77BEA", "#DAC9FB"] },
  { key: "peach", label: "Peach", icon: "🍑", colors: ["#FF956F", "#FFD2C1"] },
  { key: "bubblegum", label: "Bubblegum", icon: "🩷", colors: ["#EE79C7", "#F4C2E7"] }
];

let reminderTimer = null;

export function applyTheme(theme) {
  const safeTheme = THEMES.some((entry) => entry.key === theme) ? theme : "sakura";
  document.body.dataset.theme = safeTheme;
  localStorage.setItem("little-wins-theme", safeTheme);
  const themeOption = THEMES.find((entry) => entry.key === safeTheme);
  const quickButton = document.getElementById("themeQuickButton");
  if (quickButton) quickButton.textContent = themeOption.icon;
}

export function applySavedThemeEarly() {
  applyTheme(localStorage.getItem("little-wins-theme") || "sakura");
}

export function createSettingsController({
  getSettings,
  setSettings,
  updateSettings,
  fetchBackupData,
  restoreBackupData,
  getCurrentUser,
  onSuccess,
  onError,
  onSettingsChanged
}) {
  const form = document.getElementById("settingsForm");

  function renderThemePicker(selectedTheme) {
    const picker = document.getElementById("themePicker");
    picker.innerHTML = THEMES.map((theme) => `
      <label class="theme-option ${theme.key === selectedTheme ? "selected" : ""}">
        <input type="radio" name="theme" value="${theme.key}" ${theme.key === selectedTheme ? "checked" : ""}>
        <span>${theme.icon}</span>
        <span>${theme.label}</span>
        <span class="theme-swatch" aria-hidden="true">
          <i style="background:${theme.colors[0]}"></i><i style="background:${theme.colors[1]}"></i>
        </span>
      </label>
    `).join("");
  }

  function render(settings) {
    document.getElementById("settingRewardName").value = settings.reward_name;
    document.getElementById("settingTargetDays").value = settings.target_days;
    document.getElementById("settingReminderTime").value = String(settings.daily_reminder_time || "20:00").slice(0, 5);
    document.getElementById("settingCelebration").checked = settings.show_celebration;
    document.getElementById("settingSound").checked = settings.enable_sound;
    document.getElementById("anonymousUserId").textContent = "Shared owner";
    renderThemePicker(settings.theme);
    applyTheme(settings.theme);
    scheduleReminder(settings, onSuccess);
    updateNotificationButton();
  }

  function readForm() {
    const selectedTheme = form.querySelector('input[name="theme"]:checked')?.value || "sakura";
    return {
      reward_name: document.getElementById("settingRewardName").value.trim(),
      target_days: Number(document.getElementById("settingTargetDays").value),
      theme: selectedTheme,
      daily_reminder_time: document.getElementById("settingReminderTime").value || "20:00",
      show_celebration: document.getElementById("settingCelebration").checked,
      enable_sound: document.getElementById("settingSound").checked
    };
  }

  async function save(event) {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    const status = document.getElementById("settingsSaveStatus");
    const payload = readForm();

    if (!payload.reward_name || payload.target_days < 1 || payload.target_days > 365) {
      onError(new Error("Use a reward name and a target between 1 and 365 days."));
      return;
    }

    submitButton.disabled = true;
    status.textContent = "Saving…";
    try {
      const updated = await updateSettings(payload);
      setSettings(updated);
      render(updated);
      onSettingsChanged(updated);
      status.textContent = "Saved to Supabase.";
      onSuccess("Settings saved.");
    } catch (error) {
      status.textContent = "Could not save changes.";
      onError(error);
    } finally {
      submitButton.disabled = false;
    }
  }

  async function quickCycleTheme() {
    const current = getSettings();
    if (!current) return;
    const index = THEMES.findIndex((entry) => entry.key === current.theme);
    const next = THEMES[(index + 1) % THEMES.length];
    applyTheme(next.key);
    try {
      const updated = await updateSettings({ theme: next.key });
      setSettings(updated);
      render(updated);
      onSettingsChanged(updated);
      onSuccess(`${next.icon} ${next.label} theme selected.`);
    } catch (error) {
      applyTheme(current.theme);
      onError(error);
    }
  }

  async function requestNotifications() {
    if (!("Notification" in window)) {
      onError(new Error("This browser does not support notifications."));
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      updateNotificationButton();
      if (permission === "granted") onSuccess("Browser notifications enabled.");
      else onError(new Error("Notification permission was not granted."));
    } catch (error) {
      onError(error);
    }
  }

  function updateNotificationButton() {
    const button = document.getElementById("notificationPermissionButton");
    if (!("Notification" in window)) {
      button.textContent = "Notifications unsupported";
      button.disabled = true;
      return;
    }
    if (Notification.permission === "granted") {
      button.textContent = "Browser notifications enabled";
      button.disabled = true;
    } else if (Notification.permission === "denied") {
      button.textContent = "Notifications blocked in browser";
      button.disabled = true;
    } else {
      button.textContent = "Enable browser notifications";
      button.disabled = false;
    }
  }

  async function restoreData(file) {
    if (!file) return;
    const button = document.getElementById("importDataButton");
    button.disabled = true;
    try {
      const parsed = JSON.parse(await file.text());
      const backup = parsed.data || parsed;
      const confirmed = window.confirm("Restore this backup? The shared Little Wins data on every device will be replaced.");
      if (!confirmed) return;
      await restoreBackupData(backup);
      onSuccess("Backup restored. Refreshing your data…");
      await onSettingsChanged(getSettings());
    } catch (error) {
      onError(error instanceof SyntaxError ? new Error("The selected file is not valid Little Wins JSON.") : error);
    } finally {
      button.disabled = false;
      document.getElementById("importDataFile").value = "";
    }
  }

  async function exportData() {
    const button = document.getElementById("exportDataButton");
    button.disabled = true;
    try {
      const data = await fetchBackupData();
      const content = JSON.stringify({
        app: "Little Wins",
        exported_at: new Date().toISOString(),
        profile_id: getCurrentUser().id,
        data
      }, null, 2);
      const blob = new Blob([content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `little-wins-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      onSuccess("Backup exported.");
    } catch (error) {
      onError(error);
    } finally {
      button.disabled = false;
    }
  }

  function initialize() {
    render(getSettings());
    form.addEventListener("submit", save);
    document.getElementById("themePicker").addEventListener("change", (event) => {
      if (event.target.name !== "theme") return;
      applyTheme(event.target.value);
      document.querySelectorAll(".theme-option").forEach((option) => {
        option.classList.toggle("selected", option.contains(event.target));
      });
    });
    document.getElementById("themeQuickButton").addEventListener("click", quickCycleTheme);
    document.getElementById("notificationPermissionButton").addEventListener("click", requestNotifications);
    document.getElementById("exportDataButton").addEventListener("click", exportData);
    document.getElementById("importDataButton").addEventListener("click", () => document.getElementById("importDataFile").click());
    document.getElementById("importDataFile").addEventListener("change", (event) => restoreData(event.target.files?.[0]));
  }

  return { initialize, render, quickCycleTheme };
}

function scheduleReminder(settings, onReminder) {
  if (reminderTimer) clearInterval(reminderTimer);
  const reminderTime = String(settings.daily_reminder_time || "").slice(0, 5);
  if (!reminderTime) return;

  const check = () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const reminderKey = `little-wins-reminder-${today}`;
    if (currentTime < reminderTime || localStorage.getItem(reminderKey)) return;

    localStorage.setItem(reminderKey, "shown");
    const message = "A gentle reminder to record today's little win.";
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Little Wins 💖", { body: message, icon: "assets/icons/heart.svg" });
    }
    onReminder(message);
  };

  reminderTimer = window.setInterval(check, 30_000);
  check();
}
