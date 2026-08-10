/**
 * Visualización con Three.js (global):
 * - 2D: canvas de rectas
 * - 3D: planos en R³
 * - 4D–8D: corte 3D fijando x4…x8 + coordenadas paralelas
 */
(function (global) {
  const THREE = global.THREE;
  if (!THREE) {
    console.error("Three.js no cargó. Revisa la conexión a internet.");
    return;
  }

  const COLORS = [
    0x0d6e5f, 0xc45c26, 0x2f5d9f, 0x8b3a62, 0x5a7a2e, 0x6b4f9a, 0xb08d00, 0x3d6b7a,
  ];
  const COLORS_CSS = [
    "#0d6e5f", "#c45c26", "#2f5d9f", "#8b3a62", "#5a7a2e", "#6b4f9a", "#b08d00", "#3d6b7a",
  ];

  let state = {
    renderer: null,
    scene: null,
    camera: null,
    controls: null,
    animId: null,
    resizeObs: null,
  };

  function matrixToNumbers(M) {
    return M.map((row) =>
      row.map((c) => (c && typeof c.toNumber === "function" ? c.toNumber() : Number(c)))
    );
  }

  function disposeThree() {
    if (state.animId) cancelAnimationFrame(state.animId);
    state.animId = null;
    if (state.resizeObs) {
      state.resizeObs.disconnect();
      state.resizeObs = null;
    }
    if (state.controls) {
      state.controls.dispose();
      state.controls = null;
    }
    if (state.renderer) {
      state.renderer.dispose();
      const el = state.renderer.domElement;
      if (el && el.parentNode) el.parentNode.removeChild(el);
      state.renderer = null;
    }
    if (state.scene) {
      state.scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      state.scene = null;
    }
    state.camera = null;
  }

  function createScene(container) {
    disposeThree();
    // Asegura tamaño aunque el contenedor acabe de mostrarse
    if (container.clientWidth < 40) {
      container.style.minHeight = "320px";
    }
    const w = Math.max(container.clientWidth || 640, 280);
    const h = Math.max(container.clientHeight || 420, 280);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7faf8);

    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 500);
    camera.position.set(12, 10, 14);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dir = new THREE.DirectionalLight(0xffffff, 0.55);
    dir.position.set(5, 12, 8);
    scene.add(dir);

    scene.add(new THREE.GridHelper(24, 24, 0x9bb5ab, 0xd7e3de));
    scene.add(new THREE.AxesHelper(8));

    state.renderer = renderer;
    state.scene = scene;
    state.camera = camera;
    state.controls = controls;

    const tick = () => {
      state.animId = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    state.resizeObs = new ResizeObserver(() => {
      if (!state.renderer || !container.isConnected) return;
      const nw = container.clientWidth || 640;
      const nh = container.clientHeight || 420;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    });
    state.resizeObs.observe(container);

    return { scene, camera, controls };
  }

  function addLabelSprite(text, position, color) {
    color = color || "#142823";
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 256, 64);
    ctx.font = "600 28px system-ui, sans-serif";
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.2, 0.55, 1);
    sprite.position.copy(position);
    return sprite;
  }

  function makePlaneMesh(a, b, c, rhs, color, size, center) {
    const normal = new THREE.Vector3(a, b, c);
    if (normal.lengthSq() < 1e-14) return null;
    normal.normalize();

    const focus = center.clone();
    const denom = a * a + b * b + c * c;
    const dist = (a * focus.x + b * focus.y + c * focus.z - rhs) / denom;
    const point = new THREE.Vector3(focus.x - a * dist, focus.y - b * dist, focus.z - c * dist);

    const geom = new THREE.PlaneGeometry(size, size, 1, 1);
    const mat = new THREE.MeshPhongMaterial({
      color: color,
      opacity: 0.38,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(point);
    mesh.lookAt(point.clone().add(normal));

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geom),
      new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.85 })
    );
    mesh.add(edges);
    return mesh;
  }

  function makePoint(pos, color, radius) {
    color = color == null ? 0xc45c26 : color;
    radius = radius == null ? 0.22 : radius;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 24, 24),
      new THREE.MeshPhongMaterial({ color: color, emissive: color, emissiveIntensity: 0.15 })
    );
    mesh.position.copy(pos);
    return mesh;
  }

  function sampleSolutionPoints(result, count) {
    const n = result.n;
    const p0 = result.particularNumbers || Array(n).fill(0);
    const basis = result.nullspace || [];
    if (!basis.length) return [p0.slice()];

    const pts = [];
    const dims = basis.length;
    const side = Math.max(2, Math.ceil(Math.pow(count, 1 / dims)));
    const span = 3;

    function rec(level, coeffs, out) {
      if (level === dims) {
        const v = p0.slice();
        for (let k = 0; k < dims; k++) {
          for (let j = 0; j < n; j++) v[j] += coeffs[k] * basis[k][j];
        }
        out.push(v);
        return;
      }
      for (let i = 0; i < side; i++) {
        const t = side === 1 ? 0 : -span + (2 * span * i) / (side - 1);
        coeffs[level] = t;
        rec(level + 1, coeffs, out);
      }
    }
    rec(0, Array(dims).fill(0), pts);
    return pts.slice(0, count);
  }

  function focusFromResult(result) {
    if (result.particularNumbers) {
      const p = result.particularNumbers;
      return new THREE.Vector3(p[0] || 0, p[1] || 0, p[2] || 0);
    }
    return new THREE.Vector3(0, 0, 0);
  }

  function renderPlanes3D(container, result, matrix, sliceExtras) {
    const created = createScene(container);
    const scene = created.scene;
    const camera = created.camera;
    const controls = created.controls;
    const M = matrixToNumbers(matrix);
    const n = result.n;
    const focus = focusFromResult(result);
    controls.target.copy(focus);
    camera.position.copy(focus.clone().add(new THREE.Vector3(11, 9, 13)));

    scene.add(addLabelSprite("x", new THREE.Vector3(focus.x + 8.5, focus.y, focus.z)));
    scene.add(addLabelSprite("y", new THREE.Vector3(focus.x, focus.y + 8.5, focus.z)));
    scene.add(addLabelSprite("z", new THREE.Vector3(focus.x, focus.y, focus.z + 8.5)));

    const extras = sliceExtras || {};
    M.forEach((row, i) => {
      const a = row[0] || 0;
      const b = row[1] || 0;
      const c = row[2] || 0;
      let rhs = row[n] || 0;
      for (let j = 3; j < n; j++) {
        const fixed = extras[j] != null ? extras[j] : (result.particularNumbers && result.particularNumbers[j]) || 0;
        rhs -= (row[j] || 0) * fixed;
      }
      if (Math.abs(a) + Math.abs(b) + Math.abs(c) < 1e-12) return;
      const mesh = makePlaneMesh(a, b, c, rhs, COLORS[i % COLORS.length], 18, focus);
      if (mesh) {
        scene.add(mesh);
        scene.add(
          addLabelSprite(
            "E" + (i + 1),
            mesh.position.clone().add(new THREE.Vector3(0, 0.6, 0)),
            COLORS_CSS[i % COLORS_CSS.length]
          )
        );
      }
    });

    if (result.type === "determinada" && result.particularNumbers) {
      const p = result.particularNumbers;
      const pt = new THREE.Vector3(p[0] || 0, p[1] || 0, p[2] || 0);
      scene.add(makePoint(pt));
      scene.add(addLabelSprite("solución", pt.clone().add(new THREE.Vector3(0.4, 0.7, 0)), "#c45c26"));
    } else if (
      (result.type === "indeterminada" || result.type === "inconsistente") &&
      (result.nullspace || []).length
    ) {
      const samples = sampleSolutionPoints(result, 80);
      const positions = [];
      samples.forEach((v) => {
        positions.push(v[0] || 0, v[1] || 0, v[2] || 0);
      });
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      scene.add(
        new THREE.Points(
          geom,
          new THREE.PointsMaterial({
            color: result.type === "inconsistente" ? 0x9a3412 : 0xc45c26,
            size: 0.18,
          })
        )
      );

      if ((result.nullspace || []).length === 1) {
        const p0 = result.particularNumbers;
        const d = result.nullspace[0];
        const a = new THREE.Vector3(
          p0[0] - 4 * d[0],
          (p0[1] || 0) - 4 * (d[1] || 0),
          (p0[2] || 0) - 4 * (d[2] || 0)
        );
        const b = new THREE.Vector3(
          p0[0] + 4 * d[0],
          (p0[1] || 0) + 4 * (d[1] || 0),
          (p0[2] || 0) + 4 * (d[2] || 0)
        );
        scene.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([a, b]),
            new THREE.LineBasicMaterial({
              color: result.type === "inconsistente" ? 0x9a3412 : 0xc45c26,
            })
          )
        );
      }
    }
  }

  function drawParallelCoords(canvas, result, matrix) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#f7faf8";
    ctx.fillRect(0, 0, w, h);

    const n = result.n;
    const names = [];
    for (let i = 0; i < n; i++) names.push(result.varName(i));

    const samples =
      result.type === "inconsistente" && !(result.nullspace && result.nullspace.length)
        ? []
        : sampleSolutionPoints(result, result.type === "determinada" ? 1 : 36);

    const mins = Array(n).fill(Infinity);
    const maxs = Array(n).fill(-Infinity);
    samples.forEach((v) => {
      for (let j = 0; j < n; j++) {
        mins[j] = Math.min(mins[j], v[j]);
        maxs[j] = Math.max(maxs[j], v[j]);
      }
    });
    for (let j = 0; j < n; j++) {
      if (!Number.isFinite(mins[j])) {
        mins[j] = -1;
        maxs[j] = 1;
      }
      if (Math.abs(maxs[j] - mins[j]) < 1e-9) {
        mins[j] -= 1;
        maxs[j] += 1;
      }
    }

    const padT = 36;
    const padB = 28;
    const padX = 36;
    const axisY0 = padT;
    const axisY1 = h - padB;

    function xAt(j) {
      return padX + (j * (w - 2 * padX)) / Math.max(n - 1, 1);
    }
    function yAt(j, val) {
      return axisY1 - ((val - mins[j]) / (maxs[j] - mins[j])) * (axisY1 - axisY0);
    }

    for (let j = 0; j < n; j++) {
      const x = xAt(j);
      ctx.strokeStyle = "#9bb5ab";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, axisY0);
      ctx.lineTo(x, axisY1);
      ctx.stroke();
      ctx.fillStyle = "#0d6e5f";
      ctx.font = "600 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(names[j], x, 18);
      ctx.fillStyle = "#4d635c";
      ctx.font = "11px ui-monospace, monospace";
      ctx.fillText(maxs[j].toFixed(1), x, axisY0 - 4);
      ctx.fillText(mins[j].toFixed(1), x, axisY1 + 14);
    }

    samples.forEach((v, si) => {
      ctx.strokeStyle =
        result.type === "determinada" ? "#c45c26" : COLORS_CSS[si % COLORS_CSS.length] + "aa";
      ctx.lineWidth = result.type === "determinada" ? 3 : 1.4;
      ctx.beginPath();
      for (let j = 0; j < n; j++) {
        const x = xAt(j);
        const y = yAt(j, v[j]);
        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });

    if (!samples.length) {
      ctx.fillStyle = "#9a3412";
      ctx.font = "600 15px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Sin solución que proyectar", w / 2, h / 2);
    }
  }

  function hintFor(result) {
    const n = result.n;
    if (n === 2) {
      if (result.type === "inconsistente")
        return "Sistema inconsistente: las rectas no coinciden. Se muestra forma paramétrica de referencia.";
      if (result.type === "determinada")
        return "Cada ecuación es una recta; la solución es su intersección.";
      return "Rectas dependientes: infinitas soluciones.";
    }
    if (n === 3) {
      if (result.type === "inconsistente")
        return "Inconsistente: los planos no se cruzan en un punto común. Referencia con z = t (Three.js).";
      return "Three.js: cada ecuación es un plano en R³. Arrastra para orbitar · rueda para zoom.";
    }
    const extras = [];
    for (let i = 3; i < n; i++) extras.push(result.varName(i));
    return (
      "Vista " +
      n +
      "D con Three.js: corte 3D fijando " +
      extras.join(", ") +
      ". Usa los deslizadores para explorar. Abajo: coordenadas paralelas."
    );
  }

  function buildSliceControls(host, result, onChange) {
    host.innerHTML = "";
    if (result.n <= 3) {
      host.hidden = true;
      return {};
    }
    host.hidden = false;
    const values = {};
    const title = document.createElement("p");
    title.className = "slice-title";
    title.textContent = "Corte del hiperespacio (fija las coordenadas extra)";
    host.appendChild(title);

    for (let j = 3; j < result.n; j++) {
      const wrap = document.createElement("label");
      wrap.className = "slice-field";
      const name = result.varName(j);
      const init =
        result.particularNumbers && Number.isFinite(result.particularNumbers[j])
          ? result.particularNumbers[j]
          : 0;
      values[j] = init;
      wrap.innerHTML =
        "<span>" +
        name +
        '</span><input type="range" min="-8" max="8" step="0.1" value="' +
        init +
        '" /><output>' +
        init.toFixed(1) +
        "</output>";
      const input = wrap.querySelector("input");
      const out = wrap.querySelector("output");
      input.addEventListener("input", () => {
        values[j] = Number(input.value);
        out.textContent = values[j].toFixed(1);
        onChange(Object.assign({}, values));
      });
      host.appendChild(wrap);
    }
    return values;
  }

  function draw2D(canvas, result, matrix) {
    const ctx = canvas.getContext("2d");
    const lineFromEquation = global.LinearSolver.lineFromEquation;
    const raw = matrix;
    const w = canvas.width;
    const h = canvas.height;

    let focusX = 0;
    let focusY = 0;
    if (result.particularNumbers) {
      focusX = result.particularNumbers[0] || 0;
      focusY = result.particularNumbers[1] || 0;
    }
    const span = Math.max(8, Math.abs(focusX) * 1.5 + 2, Math.abs(focusY) * 1.5 + 2);
    const bounds = {
      xmin: focusX - span,
      xmax: focusX + span,
      ymin: focusY - span * (h / w),
      ymax: focusY + span * (h / w),
    };

    function worldToCanvas(x, y) {
      return [
        ((x - bounds.xmin) / (bounds.xmax - bounds.xmin)) * w,
        h - ((y - bounds.ymin) / (bounds.ymax - bounds.ymin)) * h,
      ];
    }

    ctx.fillStyle = "#f7faf8";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#d7e3de";
    for (let i = -20; i <= 20; i++) {
      const vx = worldToCanvas(i, 0)[0];
      const hy = worldToCanvas(0, i)[1];
      ctx.beginPath();
      ctx.moveTo(vx, 0);
      ctx.lineTo(vx, h);
      ctx.moveTo(0, hy);
      ctx.lineTo(w, hy);
      ctx.stroke();
    }
    const origin = worldToCanvas(0, 0);
    ctx.strokeStyle = "#2c4a42";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, origin[1]);
    ctx.lineTo(w, origin[1]);
    ctx.moveTo(origin[0], 0);
    ctx.lineTo(origin[0], h);
    ctx.stroke();

    raw.forEach((row, i) => {
      const L = lineFromEquation(row[0], row[1], row[2]);
      if (L.kind !== "line" && L.kind !== "vertical") return;
      ctx.strokeStyle = COLORS_CSS[i % COLORS_CSS.length];
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (L.kind === "vertical") {
        const p1 = worldToCanvas(L.x, bounds.ymin);
        const p2 = worldToCanvas(L.x, bounds.ymax);
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
      } else {
        const p1 = worldToCanvas(bounds.xmin, L.m * bounds.xmin + L.k);
        const p2 = worldToCanvas(bounds.xmax, L.m * bounds.xmax + L.k);
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
      }
      ctx.stroke();
    });

    if (result.type === "determinada" && result.particularNumbers) {
      const p = worldToCanvas(result.particularNumbers[0], result.particularNumbers[1]);
      ctx.fillStyle = "#c45c26";
      ctx.beginPath();
      ctx.arc(p[0], p[1], 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function renderSystemGraph(opts) {
    const result = opts.result;
    const matrix = opts.matrix;
    const view3d = opts.view3d;
    const canvas2d = opts.canvas2d;
    const canvasParallel = opts.canvasParallel;
    const sliceHost = opts.sliceHost;
    const hintEl = opts.hintEl;
    const modeLabel = opts.modeLabel;

    hintEl.textContent = hintFor(result);
    if (modeLabel) {
      modeLabel.textContent =
        result.n <= 2
          ? "Vista 2D"
          : result.n === 3
            ? "Vista 3D (Three.js)"
            : "Vista " + result.n + "D → corte 3D (Three.js)";
    }

    if (canvasParallel) {
      canvasParallel.hidden = false;
      drawParallelCoords(canvasParallel, result, matrix);
    }

    if (result.n === 2) {
      view3d.hidden = true;
      sliceHost.hidden = true;
      canvas2d.hidden = false;
      disposeThree();
      draw2D(canvas2d, result, matrix);
      return;
    }

    canvas2d.hidden = true;
    view3d.hidden = false;

    function redraw(extras) {
      renderPlanes3D(view3d, result, matrix, extras);
    }

    const initial = buildSliceControls(sliceHost, result, redraw);
    redraw(initial);
  }

  function destroySystemGraph() {
    disposeThree();
  }

  global.SystemGraph = {
    renderSystemGraph: renderSystemGraph,
    destroySystemGraph: destroySystemGraph,
  };
})(typeof window !== "undefined" ? window : globalThis);
