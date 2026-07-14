const ACHIEVEMENTS = [
  { key: "first_checkin", icon: "🌸", title: "First Check-in", description: "Log your very first day." },
  { key: "first_reward", icon: "🎀", title: "First Reward", description: "Earn your first little treat." },
  { key: "seven_day_streak", icon: "🔥", title: "7 Day Streak", description: "Complete seven no-spend days in one run." },
  { key: "thirty_no_spend", icon: "💖", title: "30 No Spend Days", description: "Collect thirty mindful no-spend days." },
  { key: "ten_rewards", icon: "🎁", title: "10 Rewards", description: "Earn ten rewards through consistency." },
  { key: "hundred_checkins", icon: "🏆", title: "100 Check-ins", description: "Show up honestly one hundred times." }
];

function formatDate(dateString) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(`${dateString}T12:00:00`));
}

function formatTimestamp(timestamp) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(timestamp));
}

export function renderRewards(rewards, achievements) {
  const rewardHistory = document.getElementById("rewardHistory");
  const rewardsEmpty = document.getElementById("rewardsEmpty");

  rewardsEmpty.classList.toggle("hidden", rewards.length > 0);
  rewardHistory.innerHTML = rewards.map((reward) => `
    <article class="reward-item">
      <div class="reward-item-icon">🎁</div>
      <div>
        <h3>${escapeHTML(reward.reward_name)}</h3>
        <p>${formatDate(reward.earned_date)} · ${reward.streak_length} day goal</p>
      </div>
      <span class="reward-plus">+1</span>
    </article>
  `).join("");

  const unlocked = new Map(achievements.map((item) => [item.achievement_key, item.unlocked_at]));
  document.getElementById("achievementGrid").innerHTML = ACHIEVEMENTS.map((achievement) => {
    const unlockedAt = unlocked.get(achievement.key);
    return `
      <article class="achievement-card ${unlockedAt ? "" : "locked"}">
        <div class="achievement-icon">${achievement.icon}</div>
        <h3>${achievement.title}</h3>
        <p>${achievement.description}</p>
        <span class="achievement-date">${unlockedAt ? `Unlocked ${formatTimestamp(unlockedAt)}` : "Locked"}</span>
      </article>
    `;
  }).join("");
}

export function achievementName(key) {
  return ACHIEVEMENTS.find((item) => item.key === key)?.title || "New achievement";
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
