/**
 * Aritmética exacta con fracciones + eliminación de Gauss-Jordan.
 */
(function (global) {
  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a || 1;
  }

  function Fraction(n, d) {
    if (d === undefined) d = 1;
    if (typeof n === "string") {
      const s = n.trim().replace(",", ".");
      if (s === "" || s === "+" || s === "-") {
        this.n = 0;
        this.d = 1;
        return;
      }
      if (s.includes("/")) {
        const [a, b] = s.split("/");
        n = Number(a);
        d = Number(b);
      } else {
        const num = Number(s);
        if (!Number.isFinite(num)) throw new Error("Número inválido: " + n);
        return Fraction.fromFloat(num);
      }
    }
    if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) {
      throw new Error("Fracción inválida");
    }
    n = Math.trunc(n);
    d = Math.trunc(d);
    if (d < 0) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d);
    this.n = n / g;
    this.d = d / g;
  }

  Fraction.fromFloat = function (x) {
    if (!Number.isFinite(x)) throw new Error("Número inválido");
    if (Number.isInteger(x)) return new Fraction(x, 1);
    // Limitar a 6 decimales para estabilidad en UI
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    let bestN = 0;
    let bestD = 1;
    let bestErr = Infinity;
    for (let d = 1; d <= 10000; d++) {
      const n = Math.round(x * d);
      const err = Math.abs(x - n / d);
      if (err < bestErr) {
        bestErr = err;
        bestN = n;
        bestD = d;
        if (err < 1e-12) break;
      }
    }
    return new Fraction(sign * bestN, bestD);
  };

  Fraction.prototype.clone = function () {
    return new Fraction(this.n, this.d);
  };

  Fraction.prototype.isZero = function () {
    return this.n === 0;
  };

  Fraction.prototype.neg = function () {
    return new Fraction(-this.n, this.d);
  };

  Fraction.prototype.abs = function () {
    return new Fraction(Math.abs(this.n), this.d);
  };

  Fraction.prototype.add = function (o) {
    o = asFrac(o);
    return new Fraction(this.n * o.d + o.n * this.d, this.d * o.d);
  };

  Fraction.prototype.sub = function (o) {
    o = asFrac(o);
    return new Fraction(this.n * o.d - o.n * this.d, this.d * o.d);
  };

  Fraction.prototype.mul = function (o) {
    o = asFrac(o);
    return new Fraction(this.n * o.n, this.d * o.d);
  };

  Fraction.prototype.div = function (o) {
    o = asFrac(o);
    if (o.n === 0) throw new Error("División entre cero");
    return new Fraction(this.n * o.d, this.d * o.n);
  };

  Fraction.prototype.cmpAbs = function (o) {
    o = asFrac(o);
    return Math.abs(this.n) * o.d - Math.abs(o.n) * this.d;
  };

  Fraction.prototype.toNumber = function () {
    return this.n / this.d;
  };

  Fraction.prototype.toString = function () {
    if (this.d === 1) return String(this.n);
    return this.n + "/" + this.d;
  };

  Fraction.prototype.toHTML = function () {
    if (this.d === 1) return escapeHtml(String(this.n));
    const sign = this.n < 0 ? "−" : "";
    return (
      '<span class="frac">' +
      sign +
      '<span class="frac-num">' +
      Math.abs(this.n) +
      '</span><span class="frac-den">' +
      this.d +
      "</span></span>"
    );
  };

  function asFrac(x) {
    if (x instanceof Fraction) return x;
    return new Fraction(x);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  const VAR_NAMES = ["x", "y", "z", "w", "v", "u", "t", "s"];

  function varName(i) {
    return VAR_NAMES[i] || "x" + (i + 1);
  }

  function cloneMatrix(M) {
    return M.map((row) => row.map((c) => c.clone()));
  }

  function matrixToHTML(M, nVars) {
    const rows = M.map((row) => {
      const coeffs = row
        .slice(0, nVars)
        .map((c) => "<td>" + c.toHTML() + "</td>")
        .join("");
      const b = "<td class='aug'>" + row[nVars].toHTML() + "</td>";
      return "<tr>" + coeffs + b + "</tr>";
    }).join("");
    return (
      '<div class="aug-matrix"><table><tbody>' + rows + "</tbody></table></div>"
    );
  }

  function swapRows(M, i, j) {
    const t = M[i];
    M[i] = M[j];
    M[j] = t;
  }

  /**
   * Gauss-Jordan con pivoteo parcial. Devuelve pasos, RREF y clasificación.
   */
  function solveAugmented(rawMatrix) {
    const m = rawMatrix.length;
    if (m === 0) throw new Error("La matriz está vacía");
    const cols = rawMatrix[0].length;
    const n = cols - 1;
    if (n < 1 || n > 8) throw new Error("Se admiten de 1 a 8 incógnitas");

    const M = rawMatrix.map((row) => {
      if (row.length !== cols) throw new Error("Filas de distinta longitud");
      return row.map((v) => asFrac(v));
    });

    const steps = [];
    steps.push({
      title: "Matriz aumentada inicial",
      detail: "Escribimos el sistema como [A | b].",
      matrix: cloneMatrix(M),
    });

    let row = 0;
    const pivotCols = [];

    for (let col = 0; col < n && row < m; col++) {
      let pivot = row;
      for (let i = row + 1; i < m; i++) {
        if (M[i][col].cmpAbs(M[pivot][col]) > 0) pivot = i;
      }

      if (M[pivot][col].isZero()) continue;

      if (pivot !== row) {
        swapRows(M, pivot, row);
        steps.push({
          title: "Intercambiar filas",
          detail:
            "Intercambiamos F" +
            (row + 1) +
            " ↔ F" +
            (pivot + 1) +
            " para obtener un pivote más grande en la columna de " +
            varName(col) +
            ".",
          matrix: cloneMatrix(M),
        });
      }

      const piv = M[row][col];
      if (!(piv.n === 1 && piv.d === 1)) {
        for (let j = col; j <= n; j++) {
          M[row][j] = M[row][j].div(piv);
        }
        steps.push({
          title: "Normalizar pivote",
          detail:
            "Dividimos F" +
            (row + 1) +
            " entre " +
            piv.toString() +
            " para que el pivote de " +
            varName(col) +
            " sea 1.",
          matrix: cloneMatrix(M),
        });
      }

      for (let i = 0; i < m; i++) {
        if (i === row || M[i][col].isZero()) continue;
        const factor = M[i][col];
        for (let j = col; j <= n; j++) {
          M[i][j] = M[i][j].sub(factor.mul(M[row][j]));
        }
        steps.push({
          title: "Eliminar columna",
          detail:
            "F" +
            (i + 1) +
            " ← F" +
            (i + 1) +
            " − (" +
            factor.toString() +
            ")·F" +
            (row + 1) +
            ". Anulamos el coeficiente de " +
            varName(col) +
            " en la fila " +
            (i + 1) +
            ".",
          matrix: cloneMatrix(M),
        });
      }

      pivotCols.push(col);
      row++;
    }

    // Detectar inconsistencia / rango
    let inconsistent = false;
    let rank = 0;
    for (let i = 0; i < m; i++) {
      let allZero = true;
      for (let j = 0; j < n; j++) {
        if (!M[i][j].isZero()) {
          allZero = false;
          break;
        }
      }
      if (allZero) {
        if (!M[i][n].isZero()) {
          inconsistent = true;
          steps.push({
            title: "Inconsistencia detectada",
            detail:
              "La fila " +
              (i + 1) +
              " quedó como 0 = " +
              M[i][n].toString() +
              ", lo cual es imposible. El sistema no tiene solución.",
            matrix: cloneMatrix(M),
          });
          break;
        }
      } else {
        rank++;
      }
    }

    if (!inconsistent) {
      rank = pivotCols.length;
    }

    let type;
    let typeLabel;
    let typeExplain;
    let solutionText = "";
    let solutionHTML = "";
    const freeVars = [];
    const particular = Array(n).fill(null);
    let nullspace = [];

    if (inconsistent) {
      type = "inconsistente";
      typeLabel = "Sistema inconsistente";
      typeExplain =
        "No hay solución: las ecuaciones se contradicen (rango de A menor que el de la matriz aumentada).";
      solutionText = "Sin solución.";
      solutionHTML = "<p>No existe ningún valor de las incógnitas que cumpla todas las ecuaciones.</p>";
    } else if (rank === n) {
      type = "determinada";
      typeLabel = "Consistente determinada";
      typeExplain =
        "Hay exactamente una solución. El rango de A es igual al número de incógnitas (" +
        n +
        ").";
      const values = Array(n).fill(new Fraction(0));
      for (let i = 0; i < pivotCols.length; i++) {
        const c = pivotCols[i];
        values[c] = M[i][n].clone();
      }
      for (let i = 0; i < n; i++) particular[i] = values[i];
      solutionText = values.map((v, i) => varName(i) + " = " + v.toString()).join(", ");
      solutionHTML =
        "<ul class='sol-list'>" +
        values
          .map(
            (v, i) =>
              "<li><span class='var'>" +
              varName(i) +
              "</span> = " +
              v.toHTML() +
              "</li>"
          )
          .join("") +
        "</ul>";
      steps.push({
        title: "Solución única",
        detail: "Leemos la solución en la forma escalón reducida: " + solutionText + ".",
        matrix: cloneMatrix(M),
      });
    } else {
      type = "indeterminada";
      typeLabel = "Consistente indeterminada";
      typeExplain =
        "Hay infinitas soluciones. Hay " +
        (n - rank) +
        " variable(s) libre(s) (rango " +
        rank +
        " < " +
        n +
        " incógnitas).";

      const isPivot = Array(n).fill(false);
      pivotCols.forEach((c) => {
        isPivot[c] = true;
      });
      for (let j = 0; j < n; j++) {
        if (!isPivot[j]) freeVars.push(j);
      }

      const paramNames = freeVars.map((_, k) => "t" + (k === 0 && freeVars.length === 1 ? "" : k + 1));

      // Expresar variables pivote en función de las libres
      const exprs = Array(n).fill(null);
      freeVars.forEach((j, k) => {
        exprs[j] = { const: new Fraction(0), coeffs: {}, label: paramNames[k] };
      });

      for (let i = 0; i < pivotCols.length; i++) {
        const c = pivotCols[i];
        const constTerm = M[i][n].clone();
        const coeffs = {};
        for (let k = 0; k < freeVars.length; k++) {
          const fv = freeVars[k];
          const coef = M[i][fv].neg(); // x_c = b - sum(a_fv * free)
          if (!coef.isZero()) coeffs[paramNames[k]] = coef;
        }
        exprs[c] = { const: constTerm, coeffs };
      }

      // Particular: libres = 0
      for (let j = 0; j < n; j++) {
        if (exprs[j].label) particular[j] = new Fraction(0);
        else particular[j] = exprs[j].const.clone();
      }

      // Base del espacio nulo (direcciones de las variables libres)
      nullspace = freeVars.map((fv) => {
        const v = Array(n).fill(0);
        v[fv] = 1;
        for (let i = 0; i < pivotCols.length; i++) {
          const c = pivotCols[i];
          v[c] = M[i][fv].neg().toNumber();
        }
        return v;
      });

      function exprToString(e) {
        if (e.label) return e.label;
        const parts = [];
        if (!e.const.isZero() || Object.keys(e.coeffs).length === 0) {
          parts.push(e.const.toString());
        }
        Object.keys(e.coeffs).forEach((p) => {
          const c = e.coeffs[p];
          if (c.isZero()) return;
          const abs = c.abs().toString();
          const bare = abs === "1" ? p : abs + p;
          if (parts.length === 0) {
            parts.push(c.n < 0 ? "-" + bare : bare);
          } else if (c.n < 0) {
            parts.push("− " + bare);
          } else {
            parts.push("+ " + bare);
          }
        });
        return parts.join(" ") || "0";
      }

      function exprToHTML(e) {
        if (e.label) return "<span class='param'>" + e.label + "</span>";
        const parts = [];
        if (!e.const.isZero() || Object.keys(e.coeffs).length === 0) {
          parts.push(e.const.toHTML());
        }
        Object.keys(e.coeffs).forEach((p) => {
          const c = e.coeffs[p];
          if (c.isZero()) return;
          const bare =
            c.abs().n === 1 && c.abs().d === 1
              ? "<span class='param'>" + p + "</span>"
              : c.abs().toHTML() + "<span class='param'>" + p + "</span>";
          if (parts.length === 0) {
            parts.push(c.n < 0 ? "−" + bare : bare);
          } else if (c.n < 0) {
            parts.push(" − " + bare);
          } else {
            parts.push(" + " + bare);
          }
        });
        return parts.join("") || "0";
      }

      solutionText = exprs.map((e, i) => varName(i) + " = " + exprToString(e)).join(", ");
      solutionHTML =
        "<p>Variables libres: " +
        freeVars.map((j, k) => varName(j) + " = " + paramNames[k]).join(", ") +
        ".</p><ul class='sol-list'>" +
        exprs
          .map(
            (e, i) =>
              "<li><span class='var'>" +
              varName(i) +
              "</span> = " +
              exprToHTML(e) +
              "</li>"
          )
          .join("") +
        "</ul>";

      steps.push({
        title: "Infinitas soluciones",
        detail:
          "Asignamos parámetros a las variables libres y expresamos el resto. " +
          solutionText +
          ".",
        matrix: cloneMatrix(M),
      });
    }

    const particularNumbers = particular.map((p) =>
      p && typeof p.toNumber === "function" ? p.toNumber() : 0
    );

    return {
      n,
      m,
      type,
      typeLabel,
      typeExplain,
      rank: inconsistent ? pivotCols.length : rank,
      pivotCols,
      freeVars,
      particular,
      particularNumbers,
      nullspace,
      solutionText,
      solutionHTML,
      rref: M,
      steps,
      matrixHTML: (mat) => matrixToHTML(mat, n),
      varName,
    };
  }

  /**
   * Para graficar en 2D: ax + by = c  →  y = (c - ax)/b  o  x = c/a
   */
  function lineFromEquation(a, b, c) {
    a = asFrac(a).toNumber();
    b = asFrac(b).toNumber();
    c = asFrac(c).toNumber();
    const eps = 1e-12;
    if (Math.abs(a) < eps && Math.abs(b) < eps) {
      return { kind: Math.abs(c) < eps ? "all" : "none" };
    }
    if (Math.abs(b) < eps) {
      return { kind: "vertical", x: c / a };
    }
    // y = mx + k where m = -a/b, k = c/b
    return { kind: "line", m: -a / b, k: c / b, a, b, c };
  }

  global.LinearSolver = {
    Fraction,
    solveAugmented,
    lineFromEquation,
    varName,
    VAR_NAMES,
  };
})(typeof window !== "undefined" ? window : globalThis);
