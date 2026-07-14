import {
  ConfigurationError,
  initializeDatabase,
  getCurrentUser,
  fetchSettings,
  updateSettings,
  fetchTodayLog,
  submitCheckIn,
  fetchLogsBetween,
  fetchRewards,
  fetchAchievements,
  fetchWishlist,
  createWishlistItem,
  updateWishlistItem,
  deleteWishlistItem,
  fetchStatistics,
  fetchBackupData,
  restoreBackupData
} from "./supabase.js";
import { renderDashboard, renderStatistics } from "./dashboard.js";
import { createCalendarController } from "./calendar.js";
import { renderRewards, achievementName } from "./rewards.js";
import { createWishlistController } from "./wishlist.js";
import { applySavedThemeEarly, createSettingsController } from "./settings.js";

const state = {
  settings: null,
  todayLog: null,
  monthLogs: [],
  rewards: [],
  achievements: [],
  statistics: null,
  activePage: "dashboard"
};

let calendarController;
let wishlistController;
let settingsController;
let refreshInProgress = false;
const sounds = {};

applySavedThemeEarly();
initializeApp();

async function initializeApp() {
  bindGlobalUI();
  try {
    await initializeDatabase();
    await loadPrimaryData();
    initializeControllers();
    renderAll();
    showApplication();
    registerServiceWorker();
  } catch (error) {
    handleStartupError(error);
  }
}

function bindGlobalUI() {
  document.querySelectorAll("[data-page-target]").forEach((button) => {
    button.addEventListener("click", () => navigateTo(button.dataset.pageTarget));
  });

  document.querySelectorAll("[data-go-page]").forEach((button) => {
    button.addEventListener("click", () => navigateTo(button.dataset.goPage));
  });

  document.querySelectorAll("[data-status]").forEach((button) => {
    button.addEventListener("click", () => handleCheckIn(button.dataset.status));
  });

  document.getElementById("refreshButton").addEventListener("click", async () => {
    await refreshEverything(true);
  });

  document.getElementById("claimRewardButton").addEventListener("click", closeCelebration);
  document.getElementById("celebrationDialog").addEventListener("cancel", (event) => {
    event.preventDefault();
    closeCelebration();
  });

  document.addEventListener("click", createRipple);
  document.addEventListener("click", (event) => {
    if (event.target.closest("button") && state.settings?.enable_sound) playSound("click");
  });

  window.addEventListener("hashchange", () => {
    const requested = window.location.hash.replace("#", "");
    if (document.querySelector(`[data-page="${requested}"]`)) navigateTo(requested, false);
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (state.statistics) renderStatistics(state.statistics);
    }, 120);
  });
}

function initializeControllers() {
  calendarController = createCalendarController({
    fetchLogsBetween,
    fetchRewards,
    getSettings: () => state.settings,
    onError: handleError
  });
  calendarController.initialize();

  wishlistController = createWishlistController({
    fetchWishlist,
    createWishlistItem,
    updateWishlistItem,
    deleteWishlistItem,
    onSuccess: (message) => showToast(message, "success"),
    onError: handleError
  });
  wishlistController.initialize();

  settingsController = createSettingsController({
    getSettings: () => state.settings,
    setSettings: (settings) => { state.settings = settings; },
    updateSettings,
    fetchBackupData,
    restoreBackupData,
    getCurrentUser,
    onSuccess: (message) => showToast(message, "success"),
    onError: handleError,
    onSettingsChanged: async () => {
      await refreshEverything(false);
    }
  });
  settingsController.initialize();
}

async function loadPrimaryData() {
  const today = localISODate(new Date());
  const { start, end } = currentMonthRange();
  const [settings, todayLog, monthLogs, rewards, achievements, statistics] = await Promise.all([
    fetchSettings(),
    fetchTodayLog(today),
    fetchLogsBetween(start, end),
    fetchRewards(500),
    fetchAchievements(),
    fetchStatistics()
  ]);

  state.settings = settings;
  state.todayLog = todayLog;
  state.monthLogs = monthLogs;
  state.rewards = rewards;
  state.achievements = achievements;
  state.statistics = statistics;
  prepareSounds();
}

function renderAll() {
  const { start, end } = currentMonthRange();
  const monthRewards = state.rewards.filter((reward) => reward.earned_date >= start && reward.earned_date <= end);
  renderDashboard({
    settings: state.settings,
    todayLog: state.todayLog,
    monthLogs: state.monthLogs,
    monthRewards
  });
  renderRewards(state.rewards, state.achievements);
  renderStatistics(state.statistics);
  settingsController?.render(state.settings);
}

async function refreshEverything(showMessage = false) {
  if (refreshInProgress) return;
  refreshInProgress = true;
  const refreshButton = document.getElementById("refreshButton");
  refreshButton.disabled = true;
  refreshButton.textContent = "…";
  try {
    await loadPrimaryData();
    renderAll();
    await Promise.allSettled([
      calendarController?.refresh(),
      wishlistController?.refresh()
    ]);
    if (showMessage) showToast("Your data is up to date.", "success");
  } catch (error) {
    handleError(error);
  } finally {
    refreshInProgress = false;
    refreshButton.disabled = false;
    refreshButton.textContent = "↻";
  }
}

async function handleCheckIn(status) {
  if (state.todayLog) {
    showToast("You have already checked in today.", "error");
    return;
  }

  const buttons = document.querySelectorAll("[data-status]");
  buttons.forEach((button) => { button.disabled = true; });

  try {
    const result = await submitCheckIn(status, localISODate(new Date()));
    await loadPrimaryData();
    renderAll();
    await calendarController?.refresh();

    if (result.earned_reward) {
      playSound("reward");
      if (state.settings.show_celebration) {
        showCelebration(result.reward_name || state.settings.reward_name);
      } else {
        showToast(`You earned ${result.reward_name || state.settings.reward_name}!`, "success");
      }
    } else {
      showToast(status === "no_spend" ? "Today's little win is logged." : "Today is logged. Begin again tomorrow.", "success");
    }

    if (Array.isArray(result.newly_unlocked) && result.newly_unlocked.length) {
      setTimeout(() => {
        playSound("achievement");
        result.newly_unlocked.forEach((key) => showToast(`Achievement unlocked: ${achievementName(key)}`, "success"));
      }, result.earned_reward && state.settings.show_celebration ? 700 : 150);
    }
  } catch (error) {
    buttons.forEach((button) => { button.disabled = false; });
    handleError(error);
  }
}

function navigateTo(page, updateHash = true) {
  const target = document.querySelector(`[data-page="${page}"]`);
  if (!target) return;
  state.activePage = page;
  document.querySelectorAll(".page").forEach((section) => section.classList.toggle("active", section === target));
  document.querySelectorAll("[data-page-target]").forEach((button) => button.classList.toggle("active", button.dataset.pageTarget === page));
  if (updateHash && window.location.hash !== `#${page}`) history.replaceState(null, "", `#${page}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (page === "calendar") calendarController?.refresh();
  if (page === "statistics" && state.statistics) setTimeout(() => renderStatistics(state.statistics), 30);
}

function showApplication() {
  document.getElementById("loadingScreen").classList.add("hidden");
  document.getElementById("setupScreen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  const requested = window.location.hash.replace("#", "");
  navigateTo(document.querySelector(`[data-page="${requested}"]`) ? requested : "dashboard", false);
}

function handleStartupError(error) {
  console.error(error);
  document.getElementById("loadingScreen").classList.add("hidden");
  document.getElementById("app").classList.add("hidden");
  document.getElementById("setupScreen").classList.remove("hidden");
  document.getElementById("setupError").textContent = friendlyError(error);
}

function handleError(error) {
  console.error(error);
  showToast(friendlyError(error), "error");
}

function friendlyError(error) {
  const raw = error?.message || String(error || "Unknown error");
  if (error instanceof ConfigurationError) return raw;
  if (raw.includes("ALREADY_CHECKED_IN") || raw.includes("already checked in")) return "You have already checked in today.";
  if (raw.includes("Anonymous sign-ins are disabled")) return "Enable Anonymous Sign-Ins in Supabase Authentication settings.";
  if (raw.includes("relation") && raw.includes("does not exist")) return "The database schema is missing. Run supabase/schema.sql in Supabase.";
  if (raw.includes("Failed to fetch")) return "The app could not reach Supabase. Check the URL, key, and network connection.";
  return raw;
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.getElementById("toastRegion").appendChild(toast);
  setTimeout(() => toast.remove(), 3600);
}

function showCelebration(rewardName) {
  document.getElementById("celebrationRewardName").textContent = rewardName;
  const dialog = document.getElementById("celebrationDialog");
  if (!dialog.open) dialog.showModal();
  startConfetti();
}

function closeCelebration() {
  const dialog = document.getElementById("celebrationDialog");
  if (dialog.open) dialog.close();
}

function startConfetti() {
  const canvas = document.getElementById("confettiCanvas");
  const context = canvas.getContext("2d");
  const rect = canvas.parentElement.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const palette = ["#FF6FAE", "#FFC7DE", "#81D4A3", "#FFE4EF", "#A77BEA", "#FF956F"];
  const pieces = Array.from({ length: 90 }, () => ({
    x: Math.random() * rect.width,
    y: -20 - Math.random() * rect.height * 0.5,
    size: 5 + Math.random() * 7,
    speed: 1.7 + Math.random() * 3.2,
    sway: Math.random() * 0.08 - 0.04,
    rotation: Math.random() * Math.PI,
    rotationSpeed: Math.random() * 0.2 - 0.1,
    color: palette[Math.floor(Math.random() * palette.length)]
  }));

  const started = performance.now();
  function frame(now) {
    context.clearRect(0, 0, rect.width, rect.height);
    pieces.forEach((piece) => {
      piece.y += piece.speed;
      piece.x += Math.sin(piece.y * piece.sway) * 0.9;
      piece.rotation += piece.rotationSpeed;
      context.save();
      context.translate(piece.x, piece.y);
      context.rotate(piece.rotation);
      context.fillStyle = piece.color;
      context.fillRect(-piece.size / 2, -piece.size / 3, piece.size, piece.size * 0.65);
      context.restore();
    });
    if (now - started < 4200 && document.getElementById("celebrationDialog").open) requestAnimationFrame(frame);
    else context.clearRect(0, 0, rect.width, rect.height);
  }
  requestAnimationFrame(frame);
}

function createRipple(event) {
  const target = event.target.closest(".ripple-target");
  if (!target || target.disabled) return;
  const rect = target.getBoundingClientRect();
  const diameter = Math.max(rect.width, rect.height);
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  ripple.style.width = ripple.style.height = `${diameter}px`;
  ripple.style.left = `${event.clientX - rect.left - diameter / 2}px`;
  ripple.style.top = `${event.clientY - rect.top - diameter / 2}px`;
  target.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}

function prepareSounds() {
  if (Object.keys(sounds).length) return;
  sounds.click = new Audio("assets/sounds/click.wav");
  sounds.reward = new Audio("assets/sounds/reward.wav");
  sounds.achievement = new Audio("assets/sounds/achievement.wav");
  Object.values(sounds).forEach((audio) => { audio.preload = "auto"; });
}

function playSound(name) {
  if (!state.settings?.enable_sound || !sounds[name]) return;
  const audio = sounds[name];
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

function localISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentMonthRange() {
  const now = new Date();
  return {
    start: localISODate(new Date(now.getFullYear(), now.getMonth(), 1, 12)),
    end: localISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0, 12))
  };
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator && window.location.protocol === "https:") {
    navigator.serviceWorker.register("/service-worker.js").catch((error) => console.info("Service worker not registered:", error.message));
  }
}
