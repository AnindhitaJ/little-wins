function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function bestNoSpendRun(logs, rewards = []) {
  const ordered = [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date));
  let current = 0;
  let best = 0;
  let previous = null;
  const rewardDates = new Set(rewards.map((reward) => reward.earned_date));

  for (const log of ordered) {
    const date = new Date(`${log.log_date}T12:00:00`);
    let consecutive = false;
    if (previous) {
      const next = new Date(previous);
      next.setDate(next.getDate() + 1);
      consecutive = toISODate(next) === log.log_date;
    }

    if (log.status === "no_spend") {
      current = consecutive ? current + 1 : 1;
      best = Math.max(best, current);
      if (rewardDates.has(log.log_date)) current = 0;
    } else {
      current = 0;
    }
    previous = date;
  }
  return best;
}

export function createCalendarController({ fetchLogsBetween, fetchRewards, getSettings, onError }) {
  let month = new Date();
  month = new Date(month.getFullYear(), month.getMonth(), 1, 12);

  async function render() {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1, 12);
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12);
    const start = toISODate(firstDay);
    const end = toISODate(lastDay);

    try {
      const [logs, allRewards] = await Promise.all([
        fetchLogsBetween(start, end),
        fetchRewards(500)
      ]);
      const rewards = allRewards.filter((reward) => reward.earned_date >= start && reward.earned_date <= end);
      const settings = getSettings();
      renderCalendarGrid(firstDay, lastDay, logs);
      renderSummary(logs, rewards, settings);
    } catch (error) {
      onError(error);
    }
  }

  function initialize() {
    document.getElementById("calendarPrev").addEventListener("click", () => {
      month = new Date(month.getFullYear(), month.getMonth() - 1, 1, 12);
      render();
    });
    document.getElementById("calendarNext").addEventListener("click", () => {
      month = new Date(month.getFullYear(), month.getMonth() + 1, 1, 12);
      render();
    });
    return render();
  }

  return { initialize, refresh: render };
}

function renderCalendarGrid(firstDay, lastDay, logs) {
  const monthLabel = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(firstDay);
  document.getElementById("calendarMonthLabel").textContent = monthLabel;
  document.getElementById("summaryMonthLabel").textContent = monthLabel;

  const logsByDate = new Map(logs.map((log) => [log.log_date, log.status]));
  const today = toISODate(new Date());
  const cells = [];
  const leading = firstDay.getDay();

  for (let index = 0; index < leading; index += 1) {
    cells.push('<div class="calendar-day outside" aria-hidden="true"></div>');
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = new Date(firstDay.getFullYear(), firstDay.getMonth(), day, 12);
    const iso = toISODate(date);
    const status = logsByDate.get(iso);
    const statusClass = status ? (status === "no_spend" ? "no-spend" : "spent") : "";
    const icon = status === "no_spend" ? "🌷" : status === "spent" ? "🍓" : "";
    const label = status === "no_spend" ? "No Spend" : status === "spent" ? "Spent" : "No check-in";
    cells.push(`
      <div class="calendar-day ${statusClass} ${iso === today ? "today" : ""}" role="gridcell" aria-label="${monthLabel} ${day}: ${label}">
        <span>${day}</span>${icon ? `<span class="day-icon" aria-hidden="true">${icon}</span>` : ""}
      </div>
    `);
  }

  while (cells.length % 7 !== 0) {
    cells.push('<div class="calendar-day outside" aria-hidden="true"></div>');
  }

  document.getElementById("calendarGrid").innerHTML = cells.join("");
  document.getElementById("calendarEmpty").classList.toggle("hidden", logs.length > 0);
}

function renderSummary(logs, rewards, settings) {
  const noSpend = logs.filter((log) => log.status === "no_spend").length;
  const spent = logs.filter((log) => log.status === "spent").length;
  const cards = [
    ["No Spend Days", noSpend],
    ["Spent Days", spent],
    ["Rewards Earned", rewards.length],
    ["Best Streak", bestNoSpendRun(logs, rewards)],
    ["Current Streak", settings.current_streak]
  ];
  document.getElementById("calendarSummary").innerHTML = cards
    .map(([label, value]) => `<article class="summary-card"><span>${label}</span><strong>${value}</strong></article>`)
    .join("");
}
