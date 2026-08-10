(function () {
  const { Fraction, solveAugmented, VAR_NAMES } = window.LinearSolver;
  const { renderSystemGraph, destroySystemGraph } = window.SystemGraph;

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
  const view3d = document.getElementById("view3d");
  const parallel = document.getElementById("parallel");
  const sliceControls = document.getElementById("slice-controls");
  const modeLabel = document.getElementById("mode-label");

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
    4: [
      [1, 1, 1, 1, 10],
      [1, -1, 0, 0, 2],
      [0, 1, -1, 0, 1],
      [0, 0, 1, -1, 0],
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

  let lastMatrix = null;

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

    graphBlock.hidden = false;
    renderSystemGraph({
      result: result,
      matrix: lastMatrix,
      view3d: view3d,
      canvas2d: canvas,
      canvasParallel: parallel,
      sliceHost: sliceControls,
      hintEl: graphHint,
      modeLabel: modeLabel,
    });

    results.scrollIntoView({ behavior: "smooth", block: "start" });
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
    destroySystemGraph();
    buildMatrix();
    results.hidden = true;
  }

  function loadExample() {
    const n = Number(varsSel.value);
    if (EXAMPLES[n]) fillMatrix(EXAMPLES[n]);
    else {
      const m = n;
      const data = Array.from({ length: m }, (_, i) => {
        const row = Array(n + 1).fill(0);
        row[i] = 1;
        row[n] = i + 1;
        return row;
      });
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
  fillMatrix(EXAMPLES[2]);
})();
