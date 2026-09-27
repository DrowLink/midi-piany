# 🎹 MidiPiany - Synthesia Web & Interactive Piano Tutor

Aplicación web interactiva inspirada en **Synthesia** (piano waterfall / notas en cascada) enfocada en el aprendizaje paso a paso para piano acústico y teclados MIDI.

---

## 🚀 Características Principales

1. **Visualizador Waterfall a 60 FPS:**
   - Renderizado ultrarrápido en HTML5 Canvas con `requestAnimationFrame`.
   - Sistema de partículas luminosas en la línea de impacto (*hit-line*).
   - Distinción visual cromática por mano:
     - 🟣 **Mano Izquierda:** Púrpura / Violeta (`#8b5cf6`)
     - 🔵 **Mano Derecha:** Cian / Esmeralda (`#06b6d4`)
   - Guías verticales y alineación geométrica milimétrica con el teclado inferior.

2. **Mecánica "Modo Espera" (Wait Mode):**
   - Cuando las notas tocan la línea de impacto, **el tiempo se congela automáticamente**.
   - Admite notas individuales y **acordes**: espera a que todas las notas del acorde sean tocadas antes de reanudar el avance.
   - Iluminación en tiempo real de las teclas esperadas en el teclado virtual con el color correspondiente a la mano.

3. **Audio y Detección en Tiempo Real:**
   - **Sintetizador Web Audio API:** Modelado polifónico estilo piano Rhodes / acústico cálido con transitorios armónicos y filtro dinámico.
   - **Pitch Detection por Micrófono:** Algoritmo de autocorrelación de alta precisión con interpolación parabólica y filtro anti-ruido (RMS gate) para detectar notas de tu piano acústico real o voz.
   - **Web MIDI API Nativa:** Detección automática *plug-and-play* de teclados y pianos MIDI conectados por USB.
   - **Teclado de Computadora:** Mapeo de teclas de PC (`Q-P` para mano derecha, `Z-M` para mano izquierda) y soporte táctil/mouse en pantalla.

4. **Canción por Defecto:**
   - **"Dry Hands" de C418 (Minecraft)** con partitura estructurada en formato JSON (`time`, `duration`, `note`, `hand`).

---

## 🛠️ Comandos de Inicialización y Ejecución

```bash
# 1. Clonar o entrar al directorio del proyecto
cd /Users/mariasifontes/Documents/midi-piany

# 2. Instalar dependencias
npm install

# 3. Iniciar el servidor de desarrollo
npm run dev

# 4. Compilar para producción
npm run build
```

---

## 📂 Estructura del Proyecto

```text
midi-piany/
├── public/
├── src/
│   ├── types/
│   │   └── music.ts              # Definiciones TypeScript de notas, canciones, pitch y manos
│   ├── utils/
│   │   ├── musicMath.ts          # Conversión Hz <-> MIDI <-> Nombre de nota, cents y mapeo de teclado
│   │   └── keyboardLayout.ts     # Generador geométrico compartido entre Canvas y Piano
│   ├── audio/
│   │   ├── pitchDetection.ts     # Detección de pitch por autocorrelación con micrófono
│   │   └── audioEngine.ts        # Sintetizador polifónico Web Audio y controlador Web MIDI
│   ├── songs/
│   │   ├── dryHands.json         # Partitura estructurada de Dry Hands (Minecraft)
│   │   └── dryHands.ts           # Parser y tipado de la canción
│   ├── components/
│   │   ├── WaterfallCanvas.tsx   # Canvas 60fps con colisión, partículas y lógica de congelado (Wait Mode)
│   │   ├── PianoKeyboard.tsx     # Teclado interactivo de 4 octavas (C2 - C6) con feedback visual
│   │   ├── ControlBar.tsx        # Controles de reproducción, velocidad, manos y toggle de Modo Espera
│   │   └── PitchTuner.tsx        # Afinador y VU meter en vivo de la señal del micrófono
│   ├── App.tsx                   # Integración y flujo principal
│   ├── index.css                 # Estilos y animaciones con Tailwind CSS v4
│   └── main.tsx                  # Punto de entrada de React
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🎹 Mapeo de Teclas de PC

| Tecla PC | Nota | Mano / Rango |
|---|---|---|
| `Z` `S` `X` `D` `C` `V` `G` `B` `H` `N` `J` `M` | C3 a B3 | Mano Izquierda / Grave |
| `Q` `2` `W` `3` `E` `R` `5` `T` `6` `Y` `7` `U` | C4 a B4 | Mano Derecha / Media (C4 = Do Central) |
| `I` `9` `O` `0` `P` | C5 a E5 | Mano Derecha / Aguda |
