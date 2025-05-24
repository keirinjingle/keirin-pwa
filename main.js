// ========== 通知設定 ==========
const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const API_URL = `https://keirinjingle.github.io/date/keirin_race_list_${today}.json`;

const raceList = document.getElementById("race-list");
const notifySelect = document.getElementById("notify-minutes");
const tabAll = document.getElementById("tab-all");
const tabOn = document.getElementById("tab-on");
const tabGirls = document.getElementById("tab-girls");
const tabFlat = document.getElementById("tab-flat");
const testBtn = document.getElementById("test-notify");

notifySelect.value = localStorage.getItem("notifyMinutes") || "1";
notifySelect.addEventListener("change", () => {
  localStorage.setItem("notifyMinutes", notifySelect.value);
});

testBtn.addEventListener("click", () => {
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
});

let raceData = [];

fetch(API_URL)
  .then(res => {
    if (!res.ok) throw new Error("データが見つかりません");
    return res.json();
  })
  .then(data => {
    console.log("✅ JSON取得成功", data);
    raceData = data;
    renderRaces("all");
  })
  .catch(err => {
    console.error("Fetch failed:", err);
    raceList.innerHTML = `<p style=\"color:red;\">❌ データの読み込みに失敗しました：${err.message}</p>`;
  });

// ========== 通知予約関数 ==========
function scheduleNotification(title, deadline, raceId) {
  Notification.requestPermission().then(permission => {
    if (permission !== "granted") return;
    const [h, m] = deadline.split(":" ).map(Number);
    const notifyMinutes = parseInt(localStorage.getItem("notifyMinutes") || "1");
    const now = new Date();
    const target = new Date();
    target.setHours(h);
    target.setMinutes(m - notifyMinutes);
    target.setSeconds(0);

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

  if (mode === "girls") {
    const girlControl = document.createElement("div");
    girlControl.style.marginBottom = "1rem";
    girlControl.innerHTML = `
      <button onclick=\"toggleGirls(true)\" style=\"padding:4px 8px; margin-right:6px;\">👩 ガールズすべてON</button>
      <button onclick=\"toggleGirls(false)\" style=\"padding:4px 8px;\">🚫 ガールズすべてOFF</button>
      <button onclick=\"sendPushRequest()\" style=\"padding:4px 8px; background-color:#ff9800; color:white; border:none; border-radius:4px; margin-left:12px;\">🚀 通知依頼！</button>
    `;
    raceList.appendChild(girlControl);
  }

  if (mode === "flat") {
    const flatList = [];
    raceData.forEach(venue => {
      venue.races.forEach(race => {
        flatList.push({
          venue: venue.venue,
          number: race.race_number,
          closed_at: race.closed_at,
          class_category: race.class_category,
          raceId: `${venue.venue}_${race.race_number}`,
          players: race.players
        });
      });
    });

    flatList.sort((a, b) => a.closed_at.localeCompare(b.closed_at));

    flatList.forEach(race => {
      const isOn = localStorage.getItem(`toggle-${race.raceId}`) === "on";
      const row = document.createElement("div");
      row.className = "race-card";
      row.innerHTML = `
        <strong>${race.venue} ${race.number}R</strong>（${race.class_category}） - 締切: ${race.closed_at} <br />
        <label>
          <input type=\"checkbox\" class=\"toggle\" id=\"toggle-${race.raceId}\">
        </label>
      `;
      raceList.appendChild(row);

      const toggle = row.querySelector(`#toggle-${race.raceId}`);
      if (toggle) {
        toggle.checked = isOn;
        toggle.addEventListener("change", () => {
          if (toggle.checked) {
            localStorage.setItem(`toggle-${race.raceId}`, "on");
            scheduleNotification(`${race.venue} 第${race.number}R`, race.closed_at, race.raceId);
          } else {
            localStorage.removeItem(`toggle-${race.raceId}`);
          }
        });

        if (toggle.checked) {
          scheduleNotification(`${race.venue} 第${race.number}R`, race.closed_at, race.raceId);
        }
      }
    });
    return;
  }

  raceData.forEach((venueBlock, index) => {
    const venueContainer = document.createElement("div");
    venueContainer.className = "venue-container";
    const venueId = `venue-${index}`;

    const venueHeader = document.createElement("div");
    venueHeader.className = "venue-header";
    venueHeader.innerHTML = `
      <span>${venueBlock.venue}（${venueBlock.grade}）</span>
      <div class=\"venue-controls\">
        <button onclick=\"toggleAll('${venueId}', true)\">すべてON</button>
        <button onclick=\"toggleAll('${venueId}', false)\">すべてOFF</button>
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
      const deadline = new Date(`${today.slice(0,4)}-${today.slice(4,6)}-${today.slice(6)}T${race.closed_at}`);
      const now = new Date();
      if (now > deadline) return;

      const raceId = `${venueBlock.venue}_${race.race_number}`;
      const isOn = localStorage.getItem(`toggle-${raceId}`) === "on";
      if (mode === "on" && !isOn) return;
      if (mode === "girls" && (!race || race.class_category !== "L級")) return;

      const card = document.createElement("div");
      card.className = "race-card";
      card.innerHTML = `
        <strong>${race.race_number}R - ${race.class_category}</strong><br />
        締切: ${race.closed_at} ／ 発走: ${race.start_time}<br />
        選手: ${race.players.join("、")}<br />
        <label>
          <input type=\"checkbox\" class=\"toggle\" id=\"toggle-${raceId}\">
        </label>
      `;
      raceContainer.appendChild(card);

      const toggle = card.querySelector(`#toggle-${raceId}`);
      if (toggle) {
        toggle.checked = isOn;
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
          }
        }
      }
    });
  });
}

function sendPushRequest() {
  alert("🚀 Pushサーバーに通知依頼を送信！（※後で連携）");
  // TODO: fetchなどでPushサーバーに送信処理を追加
}

function activateRaceByText() {
  const input = document.getElementById("race-input").value.trim();
  const lines = input.split(/\r?\n/); // 改行で分割

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

tabAll.addEventListener("click", () => {
  tabAll.classList.add("active");
  tabOn.classList.remove("active");
  tabGirls.classList.remove("active");
  tabFlat.classList.remove("active");
  renderRaces("all");
});

tabOn.addEventListener("click", () => {
  tabOn.classList.add("active");
  tabAll.classList.remove("active");
  tabGirls.classList.remove("active");
  tabFlat.classList.remove("active");
  renderRaces("on");
});

tabGirls.addEventListener("click", () => {
  tabGirls.classList.add("active");
  tabAll.classList.remove("active");
  tabOn.classList.remove("active");
  tabFlat.classList.remove("active");
  renderRaces("girls");
});

tabFlat.addEventListener("click", () => {
  tabFlat.classList.add("active");
  tabAll.classList.remove("active");
  tabOn.classList.remove("active");
  tabGirls.classList.remove("active");
  renderRaces("flat");
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js');
}
