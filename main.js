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

// ========== 通知ONレース一覧 ==========
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

// ========== その他の機能 ==========
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
  const notifyMinutes = parseInt(localStorage.getItem("notifyMinutes") || "1");
  const uuid = localStorage.getItem("uuid");
  if (!uuid) {
    alert("⚠️ 最初に「設定」→「初期設定」を押してください。");
    return;
  }

  const now = new Date();
  const notifyList = [];

  for (const key in localStorage) {
    if (key.startsWith("toggle-") && localStorage.getItem(key) === "on") {
      const raceId = key.replace("toggle-", "");
      const [venue, raceNum] = raceId.split("_");
      const race = findRaceInfo(raceId);
      if (!race) continue;

      const [h, m] = race.closed_at.split(":").map(Number);
      const notifyTime = new Date();
      notifyTime.setHours(h, m - notifyMinutes, 0, 0);
      if (notifyTime <= now) continue;

      notifyList.push({
        uuid,
        venue,
        race: parseInt(raceNum),
        notify_at: notifyTime.toISOString().slice(0, 19)
      });
    }
  }

  if (notifyList.length === 0) {
    alert("⚠️ 有効な通知予約がありません");
    return;
  }

  Promise.all(notifyList.map(n =>
    fetch("https://keirin-pushserver.fly.dev/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(n)
    })
  ))
    .then(() => alert(`✅ ${notifyList.length}件の通知依頼を送信しました`))
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
      <div><button onclick="triggerTestNotify()">🔔 テスト通知</button>
      <div><button id="push-subscribe-btn">🔑 初期設定</button></div>
    </div>
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

// ========== タブ制御（新：4ボタン対応） ==========
document.getElementById("tab-all").addEventListener("click", () => {
  activateTab("tab-all");
  renderRaces("all");
});

document.getElementById("tab-on").addEventListener("click", () => {
  activateTab("tab-on");
  renderNotifiedRacesList();
});

document.getElementById("tab-settings").addEventListener("click", () => {
  activateTab("tab-settings");
  renderSettings();
});

document.getElementById("tab-push").addEventListener("click", () => {
  activateTab("tab-push");
  sendPushRequest();
});

function activateTab(id) {
  document.querySelectorAll(".tab-button").forEach(btn => {
    btn.classList.remove("active");
  });
  document.getElementById(id).classList.add("active");
}

// ========== Service Worker ==========
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}


async function registerPushSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    alert("このブラウザはPush通知に対応していません");
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array("BCKFf_nVNqtWztmc_8zmtIyiAWlRW_Q--wsdESzC_paGMvCZP_oOzE_FMNhEkpoRvUWY2_NMt63Cy2lxaY8au1U")
  });

  const uuid = localStorage.getItem("uuid") || crypto.randomUUID();
  localStorage.setItem("uuid", uuid);

  await fetch("https://keirin-pushserver.fly.dev/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uuid,
      endpoint: subscription.endpoint,
      public_key: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey("p256dh")))),
      auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey("auth"))))
    })
  });

  alert("✅ 初期設定が完了しました！");
}



function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}



document.addEventListener("DOMContentLoaded", () => {
  const pushBtn = document.getElementById("push-subscribe-btn");
  if (pushBtn) {
    pushBtn.addEventListener("click", registerPushSubscription);
  }
});
