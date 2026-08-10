(function () {
  const { Fraction, solveAugmented, lineFromEquation, VAR_NAMES } = window.LinearSolver;

  const varsSel = document.getElementById("vars");
  const eqsSel = document.getElementById("eqs");
  const matrixWrap = document.getElementById("matrix-wrap");
  const matrixHint = document.getElementById("matrix-hint");
  const results = document.getElementById("results");
  const classification = document.getElementById("classification");
  const solution = document.getElementById("solution");
  const stepsEl = document.getElementById("steps");
  const graphBlock = document.getElementById("graph-block");
  const graphHint = document.getElementById("graph-hint");
  const canvas = document.getElementById("graph");
  const ctx = canvas.getContext("2d");

  const EXAMPLES = {
    2: [
      [2, 1, 5],
      [1, -1, 1],
    ],
    3: [
      [1, 1, 1, 6],
      [0, 2, 5, -4],
      [2, 5, -1, 27],
    ],
  };

  function syncEqOptions() {
    const current = Number(eqsSel.value) || 2;
    eqsSel.innerHTML = "";
    for (let i = 1; i <= 8; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = String(i);
      if (i === current) opt.selected = true;
      eqsSel.appendChild(opt);
    }
    if (!eqsSel.value) eqsSel.value = String(Math.min(current, 8));
  }

  function buildMatrix() {
    const n = Number(varsSel.value);
    const m = Number(eqsSel.value);
    const names = VAR_NAMES.slice(0, n);

    matrixHint.textContent =
      "Matriz aumentada [A | b] con " +
      m +
      " ecuación" +
      (m === 1 ? "" : "es") +
      " y " +
      n +
      " incógnita" +
      (n === 1 ? "" : "s") +
      " (" +
      names.join(", ") +
      "). Puedes usar enteros, decimales o fracciones (3/2).";

    let html =
      '<div class="matrix-editor" role="group" aria-label="Matriz aumentada">';
    html += '<div class="matrix-bracket" aria-hidden="true"></div>';
    html += '<table class="input-matrix"><thead><tr>';
    names.forEach((name) => {
      html += "<th>" + name + "</th>";
    });
    html += '<th class="aug-h">=</th><th class="aug-h">b</th></tr></thead><tbody>';

    for (let i = 0; i < m; i++) {
      html += "<tr>";
      for (let j = 0; j < n; j++) {
        html +=
          '<td><input class="cell" inputmode="decimal" data-r="' +
          i +
          '" data-c="' +
          j +
          '" value="0" aria-label="Coeficiente de ' +
          names[j] +
          " en ecuación " +
          (i + 1) +
          '" /></td>';
      }
      html += '<td class="eq-mark" aria-hidden="true">|</td>';
      html +=
        '<td><input class="cell aug" inputmode="decimal" data-r="' +
        i +
        '" data-c="' +
        n +
        '" value="0" aria-label="Término independiente ecuación ' +
        (i + 1) +
        '" /></td>';
      html += "</tr>";
    }
    html += "</tbody></table></div>";
    matrixWrap.innerHTML = html;
  }

  function readMatrix() {
    const n = Number(varsSel.value);
    const m = Number(eqsSel.value);
    const cells = matrixWrap.querySelectorAll("input.cell");
    const M = Array.from({ length: m }, () => Array(n + 1).fill(0));
    for (const input of cells) {
      const r = Number(input.dataset.r);
      const c = Number(input.dataset.c);
      const raw = input.value.trim();
      try {
        M[r][c] = new Fraction(raw === "" ? 0 : raw);
        input.classList.remove("error");
      } catch {
        input.classList.add("error");
        throw new Error(
          "Valor inválido en fila " + (r + 1) + ", columna " + (c + 1) + ": «" + raw + "»"
        );
      }
    }
    return M;
  }

  function fillMatrix(data) {
    const m = data.length;
    const n = data[0].length - 1;
    varsSel.value = String(n);
    syncEqOptions();
    eqsSel.value = String(m);
    buildMatrix();
    const cells = matrixWrap.querySelectorAll("input.cell");
    cells.forEach((input) => {
      const r = Number(input.dataset.r);
      const c = Number(input.dataset.c);
      input.value = String(data[r][c]);
    });
  }

  function renderResult(result) {
    results.hidden = false;
    classification.className = "classification " + result.type;
    classification.innerHTML =
      "<p class='type-label'>" +
      result.typeLabel +
      "</p><p class='type-explain'>" +
      result.typeExplain +
      "</p>";

    solution.innerHTML = result.solutionHTML;

    stepsEl.innerHTML = "";
    result.steps.forEach((step, idx) => {
      const li = document.createElement("li");
      li.innerHTML =
        "<div class='step-head'><span class='step-num'>" +
        (idx + 1) +
        "</span><strong>" +
        step.title +
        "</strong></div>" +
        "<p>" +
        step.detail +
        "</p>" +
        result.matrixHTML(step.matrix);
      stepsEl.appendChild(li);
    });

    if (result.n === 2) {
      graphBlock.hidden = false;
      drawGraph(result);
    } else if (result.n === 3) {
      graphBlock.hidden = false;
      graphHint.textContent =
        "Con 3 incógnitas la gráfica sería en 3D (planos). Aquí mostramos un resumen: " +
        result.typeLabel.toLowerCase() +
        ".";
      drawPlaceholder3D(result);
    } else {
      graphBlock.hidden = true;
    }

    results.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function drawPlaceholder3D(result) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#f3f6f4";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#1a3a32";
    ctx.font = "600 18px 'DM Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Vista 3D no disponible", w / 2, h / 2 - 12);
    ctx.font = "400 14px 'DM Sans', sans-serif";
    ctx.fillStyle = "#4a635c";
    ctx.fillText(result.typeLabel + " · " + result.solutionText, w / 2, h / 2 + 16);
  }

  function worldToCanvas(x, y, bounds) {
    const { xmin, xmax, ymin, ymax } = bounds;
    const px = ((x - xmin) / (xmax - xmin)) * canvas.width;
    const py = canvas.height - ((y - ymin) / (ymax - ymin)) * canvas.height;
    return [px, py];
  }

  function drawAxes(bounds) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = "#f7faf8";
    ctx.fillRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = "#d7e3de";
    ctx.lineWidth = 1;
    const step = niceStep(Math.max(bounds.xmax - bounds.xmin, bounds.ymax - bounds.ymin) / 8);
    for (let x = Math.ceil(bounds.xmin / step) * step; x <= bounds.xmax; x += step) {
      const [px] = worldToCanvas(x, 0, bounds);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
    }
    for (let y = Math.ceil(bounds.ymin / step) * step; y <= bounds.ymax; y += step) {
      const [, py] = worldToCanvas(0, y, bounds);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
      ctx.stroke();
    }

    // axes
    ctx.strokeStyle = "#2c4a42";
    ctx.lineWidth = 1.5;
    const [ox, oy] = worldToCanvas(0, 0, bounds);
    ctx.beginPath();
    ctx.moveTo(0, oy);
    ctx.lineTo(w, oy);
    ctx.moveTo(ox, 0);
    ctx.lineTo(ox, h);
    ctx.stroke();

    ctx.fillStyle = "#2c4a42";
    ctx.font = "12px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText("x", w - 18, oy - 8);
    ctx.fillText("y", ox + 8, 16);
  }

  function niceStep(raw) {
    const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const n = raw / pow;
    let nice;
    if (n < 1.5) nice = 1;
    else if (n < 3) nice = 2;
    else if (n < 7) nice = 5;
    else nice = 10;
    return nice * pow;
  }

  function sampleLine(line, bounds) {
    const pts = [];
    if (line.kind === "vertical") {
      if (line.x >= bounds.xmin && line.x <= bounds.xmax) {
        pts.push([line.x, bounds.ymin], [line.x, bounds.ymax]);
      }
      return pts;
    }
    if (line.kind === "line") {
      const y1 = line.m * bounds.xmin + line.k;
      const y2 = line.m * bounds.xmax + line.k;
      pts.push([bounds.xmin, y1], [bounds.xmax, y2]);
      // Also clip roughly — canvas will just draw; OK for teaching
      return pts;
    }
    return pts;
  }

  function drawGraph(result) {
    const raw = readMatrixSafe();
    const colors = ["#0d6e5f", "#c45c26", "#2f5d9f", "#8b3a62", "#5a7a2e", "#6b4f9a", "#b08d00", "#3d6b7a"];

    if (result.type === "inconsistente") {
      graphHint.textContent = "Las rectas no se cruzan en un mismo punto (sistema sin solución).";
    } else if (result.type === "determinada") {
      graphHint.textContent =
        "Cada ecuación es una recta. La solución es el punto donde se intersectan.";
    } else {
      graphHint.textContent =
        "Las rectas coinciden o hay menos restricciones independientes: infinitas soluciones.";
    }

    const lines = raw.map((row, i) => ({
      ...lineFromEquation(row[0], row[1], row[2]),
      color: colors[i % colors.length],
      index: i,
    }));

    // Bounds around origin and solution / intersections
    let focusX = 0;
    let focusY = 0;
    if (result.particular[0] && result.particular[1]) {
      focusX = result.particular[0].toNumber();
      focusY = result.particular[1].toNumber();
    }
    let span = 8;
    if (Number.isFinite(focusX) && Number.isFinite(focusY)) {
      span = Math.max(8, Math.abs(focusX) * 1.5 + 2, Math.abs(focusY) * 1.5 + 2);
    }
    // Expand if lines are almost horizontal/vertical far away
    lines.forEach((L) => {
      if (L.kind === "vertical" && Number.isFinite(L.x)) {
        span = Math.max(span, Math.abs(L.x) + 2);
      }
      if (L.kind === "line" && Number.isFinite(L.k)) {
        span = Math.max(span, Math.abs(L.k) * 0.5 + 4);
      }
    });

    const bounds = {
      xmin: focusX - span,
      xmax: focusX + span,
      ymin: focusY - span * (canvas.height / canvas.width),
      ymax: focusY + span * (canvas.height / canvas.width),
    };

    drawAxes(bounds);

    // Draw lines
    lines.forEach((L) => {
      if (L.kind === "none") return;
      if (L.kind === "all") {
        ctx.fillStyle = L.color + "22";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return;
      }
      const pts = sampleLine(L, bounds);
      if (pts.length < 2) return;
      ctx.strokeStyle = L.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const [x1, y1] = worldToCanvas(pts[0][0], pts[0][1], bounds);
      const [x2, y2] = worldToCanvas(pts[1][0], pts[1][1], bounds);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });

    // Legend
    ctx.font = "12px 'DM Sans', sans-serif";
    lines.forEach((L, i) => {
      const y = 22 + i * 18;
      ctx.fillStyle = L.color;
      ctx.fillRect(12, y - 8, 14, 3);
      ctx.fillStyle = "#1a3a32";
      const a = raw[i][0].toString();
      const b = raw[i][1].toString();
      const c = raw[i][2].toString();
      ctx.fillText("E" + (i + 1) + ": " + a + "x + (" + b + ")y = " + c, 32, y);
    });

    // Solution point
    if (result.type === "determinada" && result.particular[0] && result.particular[1]) {
      const sx = result.particular[0].toNumber();
      const sy = result.particular[1].toNumber();
      const [px, py] = worldToCanvas(sx, sy, bounds);
      ctx.fillStyle = "#c45c26";
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a3a32";
      ctx.font = "600 13px 'DM Sans', sans-serif";
      ctx.fillText(
        "(" + result.particular[0].toString() + ", " + result.particular[1].toString() + ")",
        px + 10,
        py - 10
      );
    }
  }

  let lastMatrix = null;
  function readMatrixSafe() {
    return lastMatrix;
  }

  function solve() {
    try {
      const M = readMatrix();
      lastMatrix = M;
      const result = solveAugmented(M);
      renderResult(result);
    } catch (err) {
      alert(err.message || String(err));
    }
  }

  function clearAll() {
    buildMatrix();
    results.hidden = true;
  }

  function loadExample() {
    const n = Number(varsSel.value);
    if (n === 2) fillMatrix(EXAMPLES[2]);
    else if (n === 3) fillMatrix(EXAMPLES[3]);
    else {
      // Identity-like determined example for n vars
      const m = n;
      const data = Array.from({ length: m }, (_, i) => {
        const row = Array(n + 1).fill(0);
        row[i] = 1;
        row[n] = i + 1;
        return row;
      });
      // Add a small coupling so it's not trivial diagonal-only visually for 2D
      if (n >= 2) {
        data[0][1] = 1;
        data[0][n] = 3;
      }
      fillMatrix(data);
    }
    solve();
  }

  varsSel.addEventListener("change", () => {
    syncEqOptions();
    // Keep eqs close to vars for square systems by default
    eqsSel.value = varsSel.value;
    buildMatrix();
  });
  eqsSel.addEventListener("change", buildMatrix);
  document.getElementById("solve-btn").addEventListener("click", solve);
  document.getElementById("clear-btn").addEventListener("click", clearAll);
  document.getElementById("example-btn").addEventListener("click", loadExample);

  matrixWrap.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      solve();
    }
  });

  syncEqOptions();
  buildMatrix();
  // Start with a friendly example
  fillMatrix(EXAMPLES[2]);
})();
