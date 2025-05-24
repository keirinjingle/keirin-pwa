// ========== 通知設定 ==========
const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const API_URL = `https://keirinjingle.github.io/date/keirin_race_list_${today}.json`;

const raceList = document.getElementById("race-list");
const notifySelect = document.getElementById("notify-minutes");
const tabAll = document.getElementById("tab-all");
const tabOn = document.getElementById("tab-on");
const tabGirls = document.getElementById("tab-girls");
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
    raceData = data;
    renderRaces("all");
  })
  .catch(err => {
    console.error("Fetch failed:", err);
    raceList.innerHTML = `<p style=\"color:red;\">❌ データの読み込みに失敗しました：${err.message}</p>`;
  });

function renderRaces(mode = "all") {
  raceList.innerHTML = "";

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

tabAll.addEventListener("click", () => {
  tabAll.classList.add("active");
  tabOn.classList.remove("active");
  tabGirls.classList.remove("active");
  renderRaces("all");
});

tabOn.addEventListener("click", () => {
  tabOn.classList.add("active");
  tabAll.classList.remove("active");
  tabGirls.classList.remove("active");
  renderRaces("on");
});

tabGirls.addEventListener("click", () => {
  tabGirls.classList.add("active");
  tabAll.classList.remove("active");
  tabOn.classList.remove("active");
  renderRaces("girls");
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js');
}
