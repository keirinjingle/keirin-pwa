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
      localStorage.removeItem(`notifyTime-${raceId}`);
    }
  });
}

function toggleGirls(turnOn) {
  raceData.forEach(venueBlock => {
    venueBlock.races.forEach(race => {
      if (race.class_category === "L級") {
        const raceId = `${venueBlock.venue}_${race.race_number}`;
        const toggle = document.getElementById(`toggle-${raceId}`);
        if (toggle) {
          toggle.checked = turnOn;
          if (turnOn) {
            localStorage.setItem(`toggle-${raceId}`, "on");
            scheduleNotification(`${venueBlock.venue} 第${race.race_number}R`, race.closed_at, raceId);
          } else {
            localStorage.removeItem(`toggle-${raceId}`);
            localStorage.removeItem(`notifyTime-${raceId}`);
          }
        }
      }
    });
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
  const lines = input.split(/\\r?\\n|,/); // 改行・カンマ両対応

  if (input === "") {
    alert("⚠️ 入力が空です");
    return;
  }

  let successCount = 0;
  let failList = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const match = trimmed.match(/^(.+?)(\\d{1,2})R$/);
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
      localStorage.setItem(`notifyTime-${raceId}`, localStorage.getItem("notifyMinutes") || "1");
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
    message += `\\n❌ 該当レースが見つかりません: ${failList.join(", ")}`;
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

// ========== タブ制御・イベント登録 ==========
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

// ========== Service Worker 登録 ==========
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js');
}
