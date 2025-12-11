let iceChart;
let currentLocation = "Dow's Lake";
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json();
}
function mapSafetyClass(status) {
  if (!status) return "";
  const s = status.toLowerCase();
  if (s === "safe") return "safe";
  if (s === "caution") return "caution";
  return "unsafe";
}

function computeSafetyFallback(avgIceThickness) {
  if (typeof avgIceThickness !== "number") return "Unknown";
  if (avgIceThickness >= 30) return "Safe";
  if (avgIceThickness >= 25) return "Caution";
  return "Unsafe";
}
async function loadLatest() {
  try {
    const rawData = await fetchJson("/api/latest");
    console.log("DEBUG /api/latest response:", rawData);

    const data = { ...rawData };
    if (!data["Dow's Lake"] && rawData["Dows Lake"]) {
      data["Dow's Lake"] = rawData["Dows Lake"];
    } else if (
      data["Dow's Lake"] &&
      (!data["Dow's Lake"].avgIceThickness ||
        data["Dow's Lake"].avgIceThickness === null) &&
      rawData["Dows Lake"]
    ) {
      
      data["Dow's Lake"] = rawData["Dows Lake"];
    }

    const now = new Date().toLocaleTimeString();
    document.getElementById("last-refresh").textContent =
      "Last refresh: " + now;

    const mapping = [
      { loc: "Dow's Lake", id: "card-dows-lake" },
      { loc: "Fifth Avenue", id: "card-fifth-avenue" },
      { loc: "NAC", id: "card-nac" }
    ];

    mapping.forEach(({ loc, id }) => {
      const card = document.getElementById(id);
      const entry = data[loc];

      const statusEl = card.querySelector(".status");
      const iceEl = card.querySelector(".ice");
      const surfEl = card.querySelector(".surface");
      const snowEl = card.querySelector(".snow");
      const extEl = card.querySelector(".external");

      if (!entry) {
        statusEl.textContent = "No data";
        statusEl.className = "status";
        iceEl.textContent = "--";
        surfEl.textContent = "--";
        snowEl.textContent = "--";
        extEl.textContent = "--";
        return;
      }
      let avgIce = entry.avgIceThickness;
      const avgSurf = entry.avgSurfaceTemperature;
      const avgSnow = entry.avgSnowAccumulation ?? entry.maxSnowAccumulation;
      const avgExt = entry.avgExternalTemperature;

      if (avgIce === null || avgIce === undefined) {
        if (
          typeof entry.maxIceThickness === "number" &&
          typeof entry.minIceThickness === "number"
        ) {
          avgIce = (entry.maxIceThickness + entry.minIceThickness) / 2;
        } else if (typeof entry.maxIceThickness === "number") {
          avgIce = entry.maxIceThickness;
        } else if (typeof entry.minIceThickness === "number") {
          avgIce = entry.minIceThickness;
        }
      }

      /
      let status = entry.safetyStatus;
      if (!status) {
        status = computeSafetyFallback(avgIce);
      }
      statusEl.textContent = status || "Unknown";
      statusEl.className = "status " + mapSafetyClass(status);

      iceEl.textContent =
        typeof avgIce === "number" ? avgIce.toFixed(1) : avgIce ?? "--";
      surfEl.textContent =
        typeof avgSurf === "number" ? avgSurf.toFixed(1) : avgSurf ?? "--";
      snowEl.textContent =
        typeof avgSnow === "number" ? avgSnow.toFixed(1) : avgSnow ?? "--";
      extEl.textContent =
        typeof avgExt === "number" ? avgExt.toFixed(1) : avgExt ?? "--";
    });
  } catch (err) {
    console.error("Failed to load latest:", err);
  }
}
async function loadHistory(location) {
  try {
    const data = await fetchJson("/api/history");
    console.log("DEBUG /api/history response:", data);

    const valid = data.filter(
      (d) =>
        typeof d.avgIceThickness === "number" ||
        typeof d.maxIceThickness === "number" ||
        typeof d.minIceThickness === "number"
    );

    const processed = valid.map((d) => {
      let v = d.avgIceThickness;
      if (v === null || v === undefined) {
        if (
          typeof d.maxIceThickness === "number" &&
          typeof d.minIceThickness === "number"
        ) {
          v = (d.maxIceThickness + d.minIceThickness) / 2;
        } else if (typeof d.maxIceThickness === "number") {
          v = d.maxIceThickness;
        } else if (typeof d.minIceThickness === "number") {
          v = d.minIceThickness;
        }
      }
      return {
        time: new Date(d.windowEnd || d.timestamp).toLocaleTimeString(),
        value: v
      };
    });

    const labels = processed.map((p) => p.time);
    const thickness = processed.map((p) => p.value);

    const ctx = document.getElementById("iceChart").getContext("2d");

    if (iceChart) {
      iceChart.destroy();
    }

    iceChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Ice thickness (cm)",
            data: thickness,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            title: {
              display: true,
              text: "cm"
            }
          }
        }
      }
    });
  } catch (err) {
    console.error("Failed to load history:", err);
  }
}

function setupButtons() {
  const buttons = document.querySelectorAll(".chart-controls .btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentLocation = btn.getAttribute("data-location");
      loadHistory(currentLocation);
    });
  });
}
document.addEventListener("DOMContentLoaded", async () => {
  setupButtons();
  await loadLatest();
  await loadHistory(currentLocation);
  setInterval(loadLatest, 30000);
});
