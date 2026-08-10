# Matriz-Solver

Calculadora web de **sistemas de ecuaciones lineales** a partir de la **matriz aumentada**.

## Qué hace

- Hasta **8 incógnitas** y **8 ecuaciones**
- Clasifica el sistema: **consistente determinada**, **indeterminada** o **inconsistente**
- Muestra la **solución** (única o paramétrica) y el **paso a paso** (Gauss-Jordan)
- Si es inconsistente, ofrece una forma de referencia con **z = t**
- Gráficas: 2D, 3D y cortes hasta 8D (Three.js) + coordenadas paralelas

## Cómo usarla

Necesitas servirla por HTTP (el modo offline con Service Worker no funciona abriendo el archivo a pelo):

```bash
python3 server.py
```

Luego abre `http://localhost:8080`.

También puedes usar cualquier servidor estático apuntando a esta carpeta.

## Offline

La primera visita (con conexión) guarda la app en caché. Las siguientes puedes abrirla **sin internet**.
