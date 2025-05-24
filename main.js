// ========== 毎朝5時にlocalStorageクリア ==========
(function autoClearAtFiveAM() {
  const today = new Date().toISOString().slice(0, 10);
  const lastCleared = localStorage.getItem("lastCleared");

  if (lastCleared !== today) {
    const now = new Date();
    if (now.getHours() >= 5) {
      localStorage.clear();
      localStorage.setItem("lastCleared", today);
      console.log("✅ 5時以降なのでlocalStorageをクリアしました");
    }
  }
})();

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

const raceList = document.getElementById("race-list");
const notifySelect = document.getElementById("notify-minutes");
const tabAll = document.getElementById("tab-all");
const tabOn = document.getElementById("tab-on");
const settingsButton = document.getElementById("settings-button");
let raceData = [];

// ========== データ取得 ==========
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

// ========== 通知スケジューリング ==========
function scheduleNotification(title, closedAt, raceId) {
  Notification.requestPermission().then(permission => {
    if (permission !== "granted") return;

    const [h, m] = closedAt.split(":").map(Number);
    const notifyMinutes = parseInt(localStorage.getItem("notifyMinutes") || "1");
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
// ========== レース表示 ==========
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
      const [h, m] = race.closed_at.split(":").map(Number);
      const deadline = new Date(now);
      deadline.setHours(h, m, 0, 0);
      const isPast = now > new Date(deadline.getTime() + 5 * 60 * 1000);

      const raceId = `${venueBlock.venue}_${race.race_number}`;
      const isOn = localStorage.getItem(`toggle-${raceId}`) === "on";
      if (mode === "on" && !isOn) return;

      const card = document.createElement("div");
      card.className = "race-card" + (isPast ? " past" : "");
      card.innerHTML = `
        <strong>${race.race_number}R - ${race.class_category}</strong><br />
        締切: ${race.closed_at} ／ 発走: ${race.start_time ?? "?"}<br />
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
          }
        });

        if (toggle.checked) {
          scheduleNotification(`${venueBlock.venue} 第${race.race_number}R`, race.closed_at, raceId);
        }
      }
    });

    if (raceContainer.innerHTML.trim() !== "") {
      raceList.appendChild(venueContainer);
    }
  });
}

// ========== 通知一覧表示 ==========
function renderNotifiedRacesList() {
  raceList.innerHTML = "";

  const list = [];

  raceData.forEach(venueBlock => {
    venueBlock.races.forEach(race => {
      const raceId = `${venueBlock.venue}_${race.race_number}`;
      if (localStorage.getItem(`toggle-${raceId}`) === "on") {
        list.push({
          venue: venueBlock.venue,
          race_number: race.race_number,
          closed_at: race.closed_at,
          class_category: race.class_category,
          notifyMinutes: localStorage.getItem("notifyMinutes") || "1"
        });
      }
    });
  });

  if (list.length === 0) {
    raceList.innerHTML = "<p>🔕 現在、通知ONのレースはありません。</p>";
    return;
  }

  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.innerHTML = `
    <thead>
      <tr style="background:#eee;">
        <th>会場</th>
        <th>R</th>
        <th>通知</th>
        <th>締切</th>
        <th>クラス</th>
      </tr>
    </thead>
    <tbody>
      ${list.map(r => `
        <tr>
          <td>${r.venue}</td>
          <td>${r.race_number}R</td>
          <td>${r.notifyMinutes}分前</td>
          <td>${r.closed_at}</td>
          <td>${r.class_category}</td>
        </tr>
      `).join("")}
    </tbody>
  `;

  raceList.appendChild(table);
}
function toggleAll(containerId, turnOn) {
  const container = document.getElementById(containerId);
  const checkboxes = container.querySelectorAll("input[type='checkbox']");
  checkboxes.forEach(cb => {
    const raceId = cb.id.replace("toggle-", "");
    cb.checked = turnOn;
    if (turnOn) {
      localStorage.setItem(`toggle-${raceId}`, "on");
    } else {
      localStorage.removeItem(`toggle-${raceId}`);
    }
  });
}

function sendPushRequest() {
  const notifyMinutes = localStorage.getItem("notifyMinutes") || "1";
  const selectedRaces = [];

  for (const key in localStorage) {
    if (key.startsWith("toggle-") && localStorage.getItem(key) === "on") {
      const raceId = key.replace("toggle-", "");
      selectedRaces.push(raceId);
    }
  }

  if (selectedRaces.length === 0) {
    alert("⚠️ 通知ONのレースがありません。");
    return;
  }

  fetch("https://your-fly-app.fly.dev/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      races: selectedRaces,
      notifyMinutes: notifyMinutes
    })
  })
    .then(res => res.json())
    .then(data => {
      alert("✅ 通知依頼を送信しました！");
      console.log("送信内容:", data);
    })
    .catch(err => {
      alert("❌ 通知依頼に失敗しました");
      console.error(err);
    });
}

function activateRaceByText() {
  const input = document.getElementById("race-input").value.trim();
  const lines = input.split(/\r?\n|,/);

  if (input === "") {
    alert("⚠️ 入力が空です");
    return;
  }

  let successCount = 0;
  let failList = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const match = trimmed.match(/^(.+?)(\d{1,2})R$/);
    if (!match) {
      failList.push(trimmed);
      return;
    }

    const venue = match[1];
    const number = match[2];
    const raceId = `${venue}_${number}`;
    const toggle = document.getElementById(`toggle-${raceId}`);
    if (toggle) {
      toggle.checked = true;
      localStorage.setItem(`toggle-${raceId}`, "on");
      const race = findRaceInfo(raceId);
      if (race) {
        scheduleNotification(`${venue} 第${number}R`, race.closed_at, raceId);
      }
      successCount++;
    } else {
      failList.push(trimmed);
    }
  });

  let message = `✅ ${successCount}件 通知ONにしました。`;
  if (failList.length > 0) {
    message += `\n❌ 該当レースが見つかりません: ${failList.join(", ")}`;
  }
  alert(message);
}

function findRaceInfo(raceId) {
  for (const venueBlock of raceData) {
    for (const race of venueBlock.races) {
      if (`${venueBlock.venue}_${race.race_number}` === raceId) {
        return race;
      }
    }
  }
  return null;
}

// ========== 設定画面 ==========
function renderSettings() {
  raceList.innerHTML = "";

  const container = document.createElement("div");
  container.className = "venue-container";
  container.style.padding = "1.5rem";

  container.innerHTML = `
    <div style="margin-bottom: 1rem;">
      <label for="notify-minutes-setting" style="font-size: 1.2rem; margin-right: 1rem;">通知タイミング:</label>
      <select id="notify-minutes-setting">
        <option value="1">1分前</option>
        <option value="2">2分前</option>
        <option value="3">3分前</option>
        <option value="4">4分前</option>
        <option value="5">5分前</option>
      </select>
    </div>

    <div class="setting-buttons">
      <div><button onclick="triggerTestNotify()">🔔 テスト通知</button></div>
      <div><button onclick="refetchData()">📥 データ再取得</button></div>
      <div><button onclick="resetData()">🗑️ リセット</button></div>
    </div>
  `;

  raceList.appendChild(container);

  const select = document.getElementById("notify-minutes-setting");
  select.value = localStorage.getItem("notifyMinutes") || "1";
  select.addEventListener("change", () => {
    localStorage.setItem("notifyMinutes", select.value);
  });
}

function triggerTestNotify() {
  Notification.requestPermission().then(p => {
    if (p !== "granted") return;
    new Notification("✅ 通知テスト成功", {
      body: "この通知は即座に表示されました。",
    });
    setTimeout(() => {
      new Notification("🔔 テスト通知", {
        body: "これは5秒後に届く通知のテストです。",
      });
    }, 5000);
  });
}

function refetchData() {
  fetch(API_URL)
    .then(res => res.json())
    .then(data => {
      raceData = data;
      alert("✅ 最新のデータを再取得しました");
      renderRaces("all");
    })
    .catch(err => {
      alert("❌ データ再取得に失敗しました");
      console.error(err);
    });
}

function resetData() {
  if (confirm("本当にすべての通知設定をリセットしますか？")) {
    localStorage.clear();
    alert("✅ 設定をリセットしました");
    renderRaces("all");
  }
}

// ========== タブ制御 ==========
tabAll.addEventListener("click", () => {
  tabAll.classList.add("active");
  tabOn.classList.remove("active");
  renderRaces("all");
});

tabOn.addEventListener("click", () => {
  tabOn.classList.add("active");
  tabAll.classList.remove("active");
  renderNotifiedRacesList();
});

settingsButton.addEventListener("click", () => {
  tabAll.classList.remove("active");
  tabOn.classList.remove("active");
  renderSettings();
});

// ========== Service Worker ==========
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js');
}
