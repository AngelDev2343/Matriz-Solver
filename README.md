# Matriz-Solver

Calculadora web de sistemas de ecuaciones lineales a partir de la **matriz aumentada**.

## Qué hace

Resuelve sistemas de hasta 8×8, los clasifica (determinada, indeterminada o inconsistente), muestra solución y paso a paso, y grafica el sistema. Si es inconsistente, da una forma de referencia con `z = t`.

## Cómo está construido

App **estática** (HTML/CSS/JS), sin framework ni build.

| Archivo | Rol |
| --- | --- |
| `index.html` | UI: matriz, controles, resultados, modal de bienvenida |
| `app.js` | Entrada del usuario, ejemplos, orquesta solver + gráficas, registra el Service Worker |
| `solver.js` | Gauss-Jordan con fracciones exactas, clasificación y forma paramétrica |
| `graph.js` | Vista 2D (canvas), 3D/cortes 4D–8D (Three.js) y coordenadas paralelas |
| `styles.css` | Estilos de la interfaz |
| `vendor/` | Three.js y OrbitControls locales (para offline) |
| `sw.js` | Caché offline de todos los assets |
| `server.py` | Servidor local opcional |

Flujo: la matriz aumentada se lee en `app.js` → `solver.js` calcula RREF, tipo y solución → `graph.js` dibuja según el número de variables (rectas, planos o corte 3D con deslizadores).
