// ========== 通知設定 & API取得 ==========
function getEffectiveDateString() {
  const now = new Date();
  if (now.getHours() < 5) {
    now.setDate(now.getDate() - 1);
  }
  return now.toISOString().slice(0, 10).replace(/-/g, "");
}

const today = getEffectiveDateString();
const API_URL = `https://keirinjingle.github.io/date/keirin_race_list_${today}.json`;

const STORAGE_DATE_KEY = "lastNotifyDate";
const storedDate = localStorage.getItem(STORAGE_DATE_KEY);
if (storedDate !== today) {
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith("toggle-") || key.startsWith("notifyTime-")) {
      localStorage.removeItem(key);
    }
  });
  localStorage.setItem(STORAGE_DATE_KEY, today);
}

const raceList = document.getElementById("race-list");
const tabAll = document.getElementById("tab-all");
const tabOn = document.getElementById("tab-on");
const settingsButton = document.getElementById("settings-button");
const pushButton = document.getElementById("push-button");
let raceData = [];

fetch(API_URL)
  .then(res => {
    if (!res.ok) throw new Error("データが見つかりません");
    return res.json();
  })
  .then(data => {
    raceData = data;
    renderRaces("all");
  })
  .catch(err => {
    console.error("Fetch failed:", err);
    raceList.innerHTML = `<p style="color:red;">❌ データの読み込みに失敗しました：${err.message}</p>`;
  });

function scheduleNotification(title, closedAt, raceId) {
  Notification.requestPermission().then(permission => {
    if (permission !== "granted") return;

    const [h, m] = closedAt.split(":" ).map(Number);
    const notifyMinutes = parseInt(localStorage.getItem("notifyMinutes") || "1");
    localStorage.setItem(`notifyTime-${raceId}`, notifyMinutes);

    const now = new Date();
    const target = new Date();
    target.setHours(h, m - notifyMinutes, 0, 0);

    const diff = target.getTime() - now.getTime();
    if (diff <= 0) return;

    setTimeout(() => {
      new Notification("🚨 締切通知", {
        body: `${title} の締切 ${notifyMinutes}分前です！`,
      });
    }, diff);
  });
}

function renderRaces(mode = "all") {
  raceList.innerHTML = "";

  raceData.forEach((venueBlock, index) => {
    const venueContainer = document.createElement("div");
    venueContainer.className = "venue-container";
    const venueId = `venue-${index}`;

    const venueHeader = document.createElement("div");
    venueHeader.className = "venue-header";
    venueHeader.innerHTML = `
      <span>${venueBlock.venue}（${venueBlock.grade ?? "グレード不明"}）</span>
      <div class="venue-controls">
        <button onclick="toggleAll('${venueId}', true)">すべてON</button>
        <button onclick="toggleAll('${venueId}', false)">すべてOFF</button>
      </div>
    `;
    venueContainer.appendChild(venueHeader);

    const raceContainer = document.createElement("div");
    raceContainer.className = "race-container";
    raceContainer.id = venueId;
    venueContainer.appendChild(raceContainer);

    venueHeader.addEventListener("click", e => {
      if (!e.target.closest(".venue-controls")) {
        raceContainer.style.display = raceContainer.style.display === "block" ? "none" : "block";
      }
    });

    venueBlock.races.forEach(race => {
      const now = new Date();
      const [h, m] = race.closed_at.split(":" ).map(Number);
      const deadline = new Date();
      deadline.setHours(h, m, 0, 0);
      const isPast = now > new Date(deadline.getTime() + 5 * 60 * 1000);

      const raceId = `${venueBlock.venue}_${race.race_number}`;
      const isOn = localStorage.getItem(`toggle-${raceId}`) === "on";
      if (mode === "on" && !isOn) return;

      const card = document.createElement("div");
      card.className = "race-card" + (isPast ? " past" : "");

      const notifyInfo = localStorage.getItem(`notifyTime-${raceId}`);
      const notifyText = notifyInfo ? `（${notifyInfo}分前に通知）` : "";

      card.innerHTML = `
        <strong>${race.race_number}R - ${race.class_category}</strong><br />
        締切: ${race.closed_at} ／ 発走: ${race.start_time ?? "?"} ${notifyText}<br />
        選手: ${race.players.join("、")}<br />
        <label>
          <input type="checkbox" class="toggle" id="toggle-${raceId}">
        </label>
      `;
      raceContainer.appendChild(card);

      const toggle = card.querySelector(`#toggle-${raceId}`);
      if (toggle) {
        toggle.checked = isOn;
        toggle.disabled = isPast;
        toggle.addEventListener("change", () => {
          if (toggle.checked) {
            localStorage.setItem(`toggle-${raceId}`, "on");
            scheduleNotification(`${venueBlock.venue} 第${race.race_number}R`, race.closed_at, raceId);
          } else {
            localStorage.removeItem(`toggle-${raceId}`);
            localStorage.removeItem(`notifyTime-${raceId}`);
          }
        });
      }
    });

    if (raceContainer.innerHTML.trim() !== "") {
      raceList.appendChild(venueContainer);
    }
  });
}

// タブ切替イベント復元
pushButton.addEventListener("click", () => {
  renderRaces("all");
});

tabAll.addEventListener("click", () => {
  tabAll.classList.add("active");
  tabOn.classList.remove("active");
  settingsButton.classList.remove("active");
  renderRaces("all");
});

tabOn.addEventListener("click", () => {
  tabOn.classList.add("active");
  tabAll.classList.remove("active");
  settingsButton.classList.remove("active");
  renderRaces("on");
});

settingsButton.addEventListener("click", () => {
  settingsButton.classList.add("active");
  tabAll.classList.remove("active");
  tabOn.classList.remove("active");
  renderSettings();
});
