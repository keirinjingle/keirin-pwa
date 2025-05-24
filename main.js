const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const API_URL = `https://keirinjingle.github.io/date/${today}.json`;

fetch(API_URL)
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById("race-list");
    container.innerHTML = "";

    data.forEach(venueBlock => {
      const venue = venueBlock.venue;
      venueBlock.races.forEach(race => {
        const deadline = new Date(`${today.slice(0,4)}-${today.slice(4,6)}-${today.slice(6)}T${race.closed_at}`);
        const now = new Date();
        const isPast = now > deadline;

        const div = document.createElement("div");
        div.innerHTML = `
          <h3>${venue} 第${race.race_number}R（${race.class_category}）</h3>
          <p>締切: ${race.closed_at}</p>
          <p>選手: ${race.players.join("、")}</p>
          <a href="${race.url}" target="_blank">出走表を見る</a><br />
          <button ${isPast ? "disabled" : ""} onclick="notify('${venue} 第${race.race_number}R', '${race.closed_at}')">
            ${isPast ? "締切済み" : "通知を登録"}
          </button>
          <hr />
        `;
        container.appendChild(div);
      });
    });
  });

function notify(title, deadline) {
  Notification.requestPermission().then(permission => {
    if (permission !== "granted") return;
    const now = new Date();
    const [h, m] = deadline.split(":").map(Number);
    const target = new Date();
    target.setHours(h);
    target.setMinutes(m - 1);
    target.setSeconds(0);

    const diff = target.getTime() - now.getTime();
    if (diff <= 0) return alert("すでに締切1分前を過ぎています");

    setTimeout(() => {
      new Notification("🚨 締切1分前！", {
        body: `${title} の締切が近づいています`,
      });
    }, diff);
  });
}

// PWA対応
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js');
  });
}
