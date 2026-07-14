const QUOTES = [
  "Small habits create big changes.",
  "Future you will thank today's you.",
  "Little wins become beautiful results.",
  "You do not need to be perfect to make progress.",
  "A pause before spending is a gift to yourself.",
  "Gentle consistency is still consistency.",
  "Your goals deserve a little room to grow.",
  "One mindful choice can change the shape of a day.",
  "Saving can be soft, calm, and kind.",
  "What you skip today can support what matters tomorrow.",
  "Progress counts even when it feels quiet.",
  "You are building trust with yourself, one day at a time.",
  "A small no can protect a meaningful yes.",
  "The best reward is knowing you kept your promise.",
  "Slow progress is not failed progress.",
  "Your future plans are worth protecting.",
  "A thoughtful choice is a little act of self-care.",
  "Tiny steps are how lasting habits begin.",
  "You can want something without buying it today.",
  "Every check-in is useful, even the imperfect ones.",
  "A reset is not the end; it is a clean beginning.",
  "Your attention is more valuable than an impulse.",
  "The space between wanting and buying is where choice lives.",
  "A calmer life is built through small decisions.",
  "Let today's win be simple and honest.",
  "Waiting can make the right purchase feel even better.",
  "You are allowed to choose peace over pressure.",
  "Saving is a way of making room for your priorities.",
  "The habit matters more than the streak number.",
  "One day is enough to begin again.",
  "Your wishlist can wait while your goals grow.",
  "Mindful spending leaves more room for meaningful joy.",
  "You are collecting choices, not just rewards.",
  "A little restraint today can create freedom later.",
  "Notice the urge, breathe, and choose on purpose.",
  "Consistency becomes confidence over time.",
  "Your progress does not need to look dramatic to be real.",
  "Keep the promise small enough to keep.",
  "A no-spend day is one vote for the life you want.",
  "You can celebrate progress without buying a celebration.",
  "There is strength in choosing enough.",
  "Let your goal be more exciting than the impulse.",
  "A thoughtful delay can prevent a regretful purchase.",
  "Your best pace is the one you can sustain.",
  "Money saved is possibility preserved.",
  "Choose the reward that still feels good tomorrow.",
  "The smallest win still belongs to you.",
  "Build the habit with kindness, not punishment.",
  "You are learning what is worth your yes.",
  "Today is another chance to choose intentionally.",
  "Keep going gently; the results will catch up.",
  "A clear goal makes an impulse easier to release.",
  "Your little wins are adding up quietly.",
  "Make room for joy that does not need a receipt."
];

function pluralize(value, singular, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function formatPercent(value) {
  const number = Number(value || 0);
  return `${Math.round(number)}%`;
}

function calculateBestRun(logs, rewards = []) {
  if (!logs.length) return 0;
  const sorted = [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date));
  let best = 0;
  let current = 0;
  let previousDate = null;
  const rewardDates = new Set(rewards.map((reward) => reward.earned_date));

  for (const log of sorted) {
    const date = new Date(`${log.log_date}T12:00:00`);
    const expectedNext = previousDate ? new Date(previousDate) : null;
    if (expectedNext) expectedNext.setDate(expectedNext.getDate() + 1);
    const isConsecutive = expectedNext && expectedNext.toISOString().slice(0, 10) === log.log_date;

    if (log.status === "no_spend") {
      current = isConsecutive ? current + 1 : 1;
      best = Math.max(best, current);
      if (rewardDates.has(log.log_date)) current = 0;
    } else {
      current = 0;
    }
    previousDate = date;
  }
  return best;
}

export function getDailyQuote(date = new Date()) {
  const key = Number(`${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`);
  return QUOTES[key % QUOTES.length];
}

export function renderDashboard({ settings, todayLog, monthLogs, monthRewards }) {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  document.getElementById("greetingTitle").textContent = `${greeting}, lovely`;
  document.getElementById("greetingEyebrow").textContent = todayLog ? "Today's little win is logged" : "A gentle check-in";
  document.getElementById("todayDate").textContent = new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", month: "short" }).format(now);
  document.getElementById("dailyQuote").textContent = getDailyQuote(now);

  document.getElementById("currentStreak").textContent = pluralize(settings.current_streak, "Day");
  document.getElementById("bestStreak").textContent = pluralize(settings.best_streak, "Day");
  document.getElementById("totalRewards").textContent = String(settings.total_rewards);

  const target = Math.max(1, Number(settings.target_days));
  const progress = Math.min(100, (Number(settings.current_streak) / target) * 100);
  const progressFill = document.getElementById("rewardProgressFill");
  progressFill.style.width = `${progress}%`;
  progressFill.parentElement.setAttribute("aria-valuenow", String(Math.round(progress)));
  document.getElementById("rewardProgressText").textContent = `${settings.current_streak} / ${target} Days`;
  document.getElementById("rewardProgressTitle").textContent = settings.current_streak > 0 ? "You are getting closer" : "Your next reward";
  document.getElementById("upcomingReward").textContent = `🎁 ${settings.reward_name}`;

  const statusBadge = document.getElementById("todayStatusBadge");
  const statusTitle = document.getElementById("todayStatusTitle");
  const statusMessage = document.getElementById("todayStatusMessage");
  const checkinButtons = document.querySelectorAll("[data-status]");

  statusBadge.className = "status-badge neutral";
  if (!todayLog) {
    statusBadge.textContent = "Not checked in";
    statusTitle.textContent = "How did today go?";
    statusMessage.textContent = "Choose the option that honestly reflects your day.";
    checkinButtons.forEach((button) => { button.disabled = false; });
  } else if (todayLog.status === "no_spend") {
    statusBadge.className = "status-badge no-spend";
    statusBadge.textContent = "🌷 No Spend";
    statusTitle.textContent = "Today's little win is complete";
    statusMessage.textContent = "You protected your goal today. Come back tomorrow for the next step.";
    checkinButtons.forEach((button) => { button.disabled = true; });
  } else {
    statusBadge.className = "status-badge spent";
    statusBadge.textContent = "🍓 Spent";
    statusTitle.textContent = "Today is logged honestly";
    statusMessage.textContent = "A reset is information, not failure. Your next little win can start tomorrow.";
    checkinButtons.forEach((button) => { button.disabled = true; });
  }

  const noSpendDays = monthLogs.filter((log) => log.status === "no_spend").length;
  const spentDays = monthLogs.filter((log) => log.status === "spent").length;
  const summary = [
    ["No Spend", noSpendDays],
    ["Spent", spentDays],
    ["Rewards", monthRewards.length],
    ["Best Run", calculateBestRun(monthLogs, monthRewards)],
    ["Current", settings.current_streak]
  ];
  document.getElementById("dashboardMonthSummary").innerHTML = summary
    .map(([label, value]) => `<article class="summary-card"><span>${label}</span><strong>${value}</strong></article>`)
    .join("");

  document.getElementById("dashboardEmpty").classList.toggle("hidden", settings.total_checkins > 0);
}

export function renderStatistics(stats) {
  const cards = [
    ["Current Streak", pluralize(stats.current_streak, "day")],
    ["Best Streak", pluralize(stats.best_streak, "day")],
    ["Total Check-ins", stats.total_checkins],
    ["Total No Spend", stats.total_no_spend],
    ["Total Spend", stats.total_spend],
    ["Success Rate", formatPercent(stats.success_rate)],
    ["Total Rewards", stats.total_rewards],
    ["Longest Month", stats.longest_month || "—"]
  ];

  document.getElementById("statisticsCards").innerHTML = cards
    .map(([label, value]) => `<article class="statistics-card"><span>${label}</span><strong>${value}</strong></article>`)
    .join("");

  const monthRate = Number(stats.current_month_performance?.success_rate || 0);
  const circumference = 2 * Math.PI * 48;
  const donut = document.getElementById("successDonut");
  donut.style.strokeDasharray = String(circumference);
  donut.style.strokeDashoffset = String(circumference * (1 - Math.min(100, monthRate) / 100));
  document.getElementById("successDonutLabel").textContent = formatPercent(monthRate);

  const monthTotal = Number(stats.current_month_performance?.total || 0);
  document.getElementById("performanceCaption").textContent = monthTotal
    ? `${stats.current_month_performance.no_spend} no-spend days out of ${monthTotal} check-ins.`
    : "No check-ins yet this month.";

  drawMonthlyChart(stats.monthly_history || []);
}

function drawMonthlyChart(history) {
  const canvas = document.getElementById("monthlyChart");
  const context = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || 520;
  const cssHeight = 220;
  canvas.width = Math.floor(cssWidth * ratio);
  canvas.height = Math.floor(cssHeight * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);

  const styles = getComputedStyle(document.body);
  const primary = styles.getPropertyValue("--primary").trim();
  const accent = styles.getPropertyValue("--accent").trim();
  const muted = styles.getPropertyValue("--muted").trim();
  const text = styles.getPropertyValue("--text").trim();
  const values = history.map((entry) => Number(entry.no_spend || 0));
  const maxValue = Math.max(5, ...values);
  const padding = { top: 16, right: 8, bottom: 38, left: 30 };
  const chartWidth = cssWidth - padding.left - padding.right;
  const chartHeight = cssHeight - padding.top - padding.bottom;
  const slot = history.length ? chartWidth / history.length : chartWidth;
  const barWidth = Math.min(42, slot * 0.55);

  context.font = "11px Inter, sans-serif";
  context.textAlign = "right";
  context.textBaseline = "middle";
  context.fillStyle = muted;
  context.strokeStyle = accent;
  context.lineWidth = 1;

  for (let tick = 0; tick <= 4; tick += 1) {
    const value = Math.round((maxValue / 4) * tick);
    const y = padding.top + chartHeight - (chartHeight * tick) / 4;
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(cssWidth - padding.right, y);
    context.stroke();
    context.fillText(String(value), padding.left - 7, y);
  }

  history.forEach((entry, index) => {
    const value = Number(entry.no_spend || 0);
    const height = maxValue ? (value / maxValue) * chartHeight : 0;
    const x = padding.left + slot * index + (slot - barWidth) / 2;
    const y = padding.top + chartHeight - height;
    const radius = Math.min(9, barWidth / 2, height / 2);

    context.fillStyle = primary;
    roundedRect(context, x, y, barWidth, Math.max(height, 2), radius);
    context.fill();

    context.fillStyle = text;
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillText(entry.label, x + barWidth / 2, padding.top + chartHeight + 11);
  });

  if (!history.length) {
    context.fillStyle = muted;
    context.textAlign = "center";
    context.fillText("Your chart will appear after your first check-in.", cssWidth / 2, cssHeight / 2);
  }
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}
