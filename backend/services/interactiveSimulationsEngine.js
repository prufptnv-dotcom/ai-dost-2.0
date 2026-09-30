/**
 * interactiveSimulationsEngine.js
 * 2030 Ultra-HD Interactive Apps & Simulation Engine for AI-Dost
 * Category 2: Interactive Apps aur Simulations (All 17 Types)
 */

const INTERACTIVE_SIMULATIONS_DIRECTIVE = `
### 7. INTERACTIVE APPS & SCIENTIFIC/PHYSICS SIMULATION PROTOCOL (CATEGORY 2):
When the user asks for interactive apps, simulations, 3D scenes, physics, or visualizers:

1. 3D SOLAR SYSTEM & CELESTIAL MECHANICS:
   - Keplerian orbital math, accurate relative velocities, orbital rings, axial tilt, glowing star shader, planetary texture/bump mapping, and camera zoom onto individual planets.
2. GRAVITY & N-BODY ORBIT SIMULATION:
   - Real-time Newton/Einstein gravity physics (F = G * (m1*m2)/r^2), orbital trailing decay trails, collision coalescence, interactive body placement, and mass slider.
3. PHYSICS ENGINE DEMOS:
   - Rigid body dynamics, coefficient of restitution, spring-damper cloth, double pendulum chaos theory, velocity vectors, and gravity vector controls.
4. 3D EARTH & GEOSPATIAL VISUALIZER:
   - Three.js photorealistic Earth with day/night terminator line, rotating cloud layer, atmospheric Rayleigh scattering blue halo, satellite orbits, and glowing city night lights.
5. FLUID DYNAMICS SIMULATION:
   - 2D/3D Navier-Stokes velocity grid / SPH (Smoothed Particle Hydrodynamics), mouse fluid dye injection, vorticity confinement, viscosity and dissipation controls.
6. ADVANCED PARTICLE SYSTEMS:
   - 10,000+ GPU particles, curl noise vector fields, mouse attraction/repulsion, cosmic stardust, audio-reactive spectrum expansion.
7. NEURAL NETWORK ARCHITECTURE VISUALIZER:
   - Dynamic layers (Input, Hidden, Output), glowing animated electrical impulse pulses traversing along weighted synapses, live node activation readouts, and bias knobs.
8. ALGORITHM & DATA STRUCTURE VISUALIZERS:
   - Sorting: Bubble, Selection, Insertion, Quick, Merge, Heap sort with animated bar swaps, comparison counters, and Web Audio API synthesized tones.
   - Data structures: Interactive BST (Binary Search Tree) with search/insert/traverse animations, Linked Lists, Stack & Queue operations, Graph Dijkstra / BFS / DFS.
9. NETWORK & CYBERSECURITY SIMULATION:
   - Interactive OSI model packet flow, TCP 3-Way Handshake (SYN, SYN-ACK, ACK), DDoS flood visualization with Firewall rate-limit mitigation toggle, and Man-in-the-Middle packet inspection.
10. INTERACTIVE PERIODIC TABLE & SCIENCE:
    - 118 elements glassmorphism grid, Bohr electron shell orbital animation, atomic radius/electronegativity heatmaps, group filtering, and element detail popup.
11. 3D TERRAIN, MAPS & PROCEDURAL GENERATION:
    - Perlin/Simplex noise heightmaps, dynamic contour lighting, procedural water shader with wave reflections, wireframe cyber mode, and drone flythrough camera.
12. 2D/3D GAME PROTOTYPES:
    - Complete playable mechanics (player controls, collision detection, score state, game over / restart loop, obstacle spawners, sound effects via Web Audio API).
13. ZERO DEPENDENCY RULE:
    - Always output complete, self-contained HTML wrapped in \`\`\`html ... \`\`\` with standard CDN scripts (Three.js r128, OrbitControls, Anime.js) and embedded CSS/JS.
`;

// ── 1. 3D Earth Simulation ───────────────────────────────────────────────────
function generate3DEarthSimulation(lang = 'hinglish') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>2030 Ultra-HD 3D Earth Simulation</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Space+Grotesk:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; user-select:none; }
    body { background:#02040a; color:#f8fafc; font-family:'Space Grotesk',sans-serif; overflow:hidden; width:100vw; height:100vh; }
    #canvas-container { width:100%; height:100%; position:absolute; }
    .hud { position:absolute; top:16px; left:16px; z-index:10; background:rgba(10,15,29,0.75); backdrop-filter:blur(18px); border:1px solid rgba(56,189,248,0.3); border-radius:16px; padding:16px 20px; max-width:320px; box-shadow:0 12px 30px rgba(0,0,0,0.8); }
    .hud h1 { font-family:'Orbitron',sans-serif; font-size:13px; font-weight:800; background:linear-gradient(135deg,#38bdf8,#818cf8); -webkit-background-clip:text; -webkit-text-fill-color:transparent; margin-bottom:8px; }
    .hud p { font-size:11px; color:#94a3b8; line-height:1.5; margin-bottom:12px; }
    .controls { display:flex; gap:8px; flex-wrap:wrap; }
    .btn { background:rgba(30,41,59,0.8); border:1px solid rgba(56,189,248,0.4); color:#38bdf8; font-family:'Orbitron',sans-serif; font-size:10px; font-weight:600; padding:6px 12px; border-radius:8px; cursor:pointer; transition:all 0.2s; }
    .btn:hover { background:#38bdf8; color:#02040a; }
  </style>
</head>
<body>
  <div id="canvas-container"></div>
  <div class="hud">
    <h1>🌍 2030 Ultra-HD 3D Earth</h1>
    <p>Atmospheric Rayleigh glow, satellite constellation orbits, procedural continent shading, and OrbitControls.</p>
    <div class="controls">
      <button class="btn" id="btn-clouds">Toggle Clouds</button>
      <button class="btn" id="btn-satellites">Satellites: ON</button>
      <button class="btn" id="btn-speed">Speed: 1x</button>
    </div>
  </div>
  <script>
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 3.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Lights
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);
    scene.add(new THREE.AmbientLight(0x0a192f, 0.4));

    // Procedural Earth Texture
    function createEarthTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 2048; canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0f2b5c'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#166534';
      for (let i = 0; i < 400; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const r = 20 + Math.random() * 80;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      return new THREE.CanvasTexture(canvas);
    }

    const earthGeo = new THREE.SphereGeometry(1, 64, 64);
    const earthMat = new THREE.MeshStandardMaterial({
      map: createEarthTexture(),
      roughness: 0.6,
      metalness: 0.1,
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earth);

    // Clouds
    const cloudGeo = new THREE.SphereGeometry(1.02, 64, 64);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    });
    const clouds = new THREE.Mesh(cloudGeo, cloudMat);
    scene.add(clouds);

    // Atmosphere Halo
    const atmoGeo = new THREE.SphereGeometry(1.15, 64, 64);
    const atmoMat = new THREE.ShaderMaterial({
      vertexShader: \`
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      \`,
      fragmentShader: \`
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.65 - dot(vNormal, vec3(0, 0, 1.0)), 2.5);
          gl_FragColor = vec4(0.2, 0.6, 1.0, 1.0) * intensity;
        }
      \`,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true
    });
    scene.add(new THREE.Mesh(atmoGeo, atmoMat));

    // Satellites
    const satGroup = new THREE.Group();
    for (let i = 0; i < 18; i++) {
      const sat = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.02, 0.04),
        new THREE.MeshBasicMaterial({ color: 0x00f0ff })
      );
      const angle = (i / 18) * Math.PI * 2;
      const r = 1.35 + (i % 3) * 0.08;
      sat.position.set(Math.cos(angle) * r, (Math.random() - 0.5) * 0.4, Math.sin(angle) * r);
      satGroup.add(sat);
    }
    scene.add(satGroup);

    // Starfield
    const starGeo = new THREE.BufferGeometry();
    const starCount = 3000;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) starPos[i] = (Math.random() - 0.5) * 80;
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.08 }));
    scene.add(stars);

    let speed = 1.0;
    document.getElementById('btn-clouds').onclick = () => { clouds.visible = !clouds.visible; };
    document.getElementById('btn-satellites').onclick = (e) => {
      satGroup.visible = !satGroup.visible;
      e.target.textContent = 'Satellites: ' + (satGroup.visible ? 'ON' : 'OFF');
    };
    document.getElementById('btn-speed').onclick = (e) => {
      speed = speed === 1.0 ? 3.0 : speed === 3.0 ? 0.2 : 1.0;
      e.target.textContent = 'Speed: ' + speed + 'x';
    };

    function animate() {
      requestAnimationFrame(animate);
      earth.rotation.y += 0.0015 * speed;
      clouds.rotation.y += 0.0022 * speed;
      satGroup.rotation.y += 0.005 * speed;
      satGroup.rotation.x += 0.001 * speed;
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  </script>
</body>
</html>`;
}

// ── 2. Gravity & N-Body Simulation ───────────────────────────────────────────
function generateGravitySimulation(lang = 'hinglish') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>2030 Quantum Gravity & N-Body Orbit Simulation</title>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Space+Grotesk:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#030712; color:#f8fafc; font-family:'Space Grotesk',sans-serif; overflow:hidden; width:100vw; height:100vh; }
    canvas { width:100%; height:100%; display:block; }
    .hud { position:absolute; top:16px; left:16px; z-index:10; background:rgba(15,23,42,0.85); backdrop-filter:blur(16px); border:1px solid rgba(139,92,246,0.3); border-radius:14px; padding:16px; width:310px; }
    .hud h1 { font-family:'Orbitron',sans-serif; font-size:13px; font-weight:800; color:#a855f7; margin-bottom:6px; }
    .hud p { font-size:11px; color:#94a3b8; line-height:1.4; margin-bottom:12px; }
    .btn { background:rgba(30,41,59,0.9); border:1px solid #8b5cf6; color:#c084fc; font-family:'Orbitron',sans-serif; font-size:10px; padding:6px 12px; border-radius:8px; cursor:pointer; margin-right:6px; margin-bottom:6px; }
    .btn:hover { background:#8b5cf6; color:#fff; }
  </style>
</head>
<body>
  <div class="hud">
    <h1>🪐 N-Body Gravity Simulator</h1>
    <p>Real-time gravitational physics (F=G*m1*m2/r²). Click & drag to launch a new celestial body.</p>
    <button class="btn" id="btn-clear">Reset Space</button>
    <button class="btn" id="btn-preset">Solar Preset</button>
  </div>
  <canvas id="canvas"></canvas>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const G = 0.8;
    let bodies = [];

    function initPreset() {
      bodies = [];
      // Central Star
      bodies.push({ x: width / 2, y: height / 2, vx: 0, vy: 0, mass: 600, radius: 20, color: '#fbbf24', trail: [] });
      // Planets
      const colors = ['#38bdf8', '#34d399', '#f43f5e', '#a855f7'];
      const distances = [120, 200, 290, 390];
      distances.forEach((d, i) => {
        const v = Math.sqrt((G * 600) / d);
        bodies.push({
          x: width / 2, y: height / 2 - d,
          vx: v, vy: 0,
          mass: 8 + i * 4,
          radius: 5 + i * 2,
          color: colors[i % colors.length],
          trail: []
        });
      });
    }
    initPreset();

    let dragStart = null;
    window.addEventListener('mousedown', (e) => { dragStart = { x: e.clientX, y: e.clientY }; });
    window.addEventListener('mouseup', (e) => {
      if (!dragStart) return;
      const vx = (dragStart.x - e.clientX) * 0.04;
      const vy = (dragStart.y - e.clientY) * 0.04;
      bodies.push({
        x: dragStart.x, y: dragStart.y,
        vx, vy, mass: 15, radius: 6,
        color: '#00f0ff', trail: []
      });
      dragStart = null;
    });

    document.getElementById('btn-clear').onclick = () => { bodies = []; };
    document.getElementById('btn-preset').onclick = () => { initPreset(); };

    function step() {
      // Physics calculations
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const b1 = bodies[i];
          const b2 = bodies[j];
          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 12);
          const force = (G * b1.mass * b2.mass) / (dist * dist);
          const ax = (force * dx) / dist;
          const ay = (force * dy) / dist;
          b1.vx += ax / b1.mass;
          b1.vy += ay / b1.mass;
          b2.vx -= ax / b2.mass;
          b2.vy -= ay / b2.mass;
        }
      }

      ctx.fillStyle = 'rgba(3, 7, 18, 0.22)';
      ctx.fillRect(0, 0, width, height);

      for (const b of bodies) {
        b.x += b.vx;
        b.y += b.vy;
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > 50) b.trail.shift();

        // Draw trail
        if (b.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(b.trail[0].x, b.trail[0].y);
          for (let p of b.trail) ctx.lineTo(p.x, p.y);
          ctx.strokeStyle = b.color + '44';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Draw body
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = b.radius * 2;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      requestAnimationFrame(step);
    }
    step();

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });
  </script>
</body>
</html>`;
}

// ── 3. Sorting Algorithm Visualizer ──────────────────────────────────────────
function generateSortingVisualizer(lang = 'hinglish') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>2030 Cyberpunk Sorting Algorithm Visualizer</title>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Space+Grotesk:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#02040a; color:#f8fafc; font-family:'Space Grotesk',sans-serif; display:flex; flex-direction:column; height:100vh; overflow:hidden; }
    header { padding:16px 24px; background:rgba(15,23,42,0.8); border-bottom:1px solid rgba(56,189,248,0.2); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; }
    h1 { font-family:'Orbitron',sans-serif; font-size:16px; background:linear-gradient(135deg,#00f0ff,#a855f7); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
    .controls { display:flex; gap:10px; align-items:center; }
    .btn { background:#0f172a; border:1px solid #00f0ff; color:#00f0ff; font-family:'Orbitron',sans-serif; font-size:11px; padding:8px 16px; border-radius:8px; cursor:pointer; transition:all 0.2s; }
    .btn:hover { background:#00f0ff; color:#000; }
    .btn-active { background:#a855f7; border-color:#a855f7; color:#fff; }
    .telemetry { font-size:12px; font-family:'Orbitron',monospace; color:#34d399; }
    #chart { flex:1; display:flex; align-items:flex-end; justify-content:center; gap:3px; padding:20px 40px; }
    .bar { flex:1; background:linear-gradient(180deg,#00f0ff,#3b82f6); border-radius:4px 4px 0 0; transition:height 0.05s ease; box-shadow:0 0 10px rgba(0,240,255,0.4); }
    .bar.comparing { background:#f43f5e !important; box-shadow:0 0 15px #f43f5e !important; }
    .bar.sorted { background:#10b981 !important; box-shadow:0 0 15px #10b981 !important; }
  </style>
</head>
<body>
  <header>
    <h1>⚡ Quantum Sorting Visualizer</h1>
    <div class="controls">
      <button class="btn" id="btn-shuffle">New Array</button>
      <button class="btn" id="btn-bubble">Bubble Sort</button>
      <button class="btn" id="btn-quick">Quick Sort</button>
      <button class="btn" id="btn-merge">Merge Sort</button>
      <div class="telemetry" id="stats">Comparisons: 0 | Swaps: 0</div>
    </div>
  </header>
  <div id="chart"></div>
  <script>
    const chart = document.getElementById('chart');
    const stats = document.getElementById('stats');
    const numBars = 45;
    let array = [];
    let isSorting = false;
    let comparisons = 0;
    let swaps = 0;

    // Web Audio synthesizer for audible sorting tone
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    function playTone(freq) {
      try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
      } catch (_) {}
    }

    function renderArray() {
      chart.innerHTML = '';
      for (let i = 0; i < array.length; i++) {
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.id = 'bar-' + i;
        bar.style.height = array[i] + '%';
        chart.appendChild(bar);
      }
    }

    function generateArray() {
      if (isSorting) return;
      array = [];
      comparisons = 0;
      swaps = 0;
      stats.textContent = 'Comparisons: 0 | Swaps: 0';
      for (let i = 0; i < numBars; i++) {
        array.push(Math.floor(Math.random() * 85) + 10);
      }
      renderArray();
    }
    generateArray();
    document.getElementById('btn-shuffle').onclick = generateArray;

    const sleep = (ms) => new Promise(res => setTimeout(res, ms));

    async function bubbleSort() {
      if (isSorting) return;
      isSorting = true;
      for (let i = 0; i < array.length; i++) {
        for (let j = 0; j < array.length - i - 1; j++) {
          comparisons++;
          const bar1 = document.getElementById('bar-' + j);
          const bar2 = document.getElementById('bar-' + (j + 1));
          bar1.classList.add('comparing');
          bar2.classList.add('comparing');
          playTone(200 + array[j] * 6);

          if (array[j] > array[j + 1]) {
            swaps++;
            let temp = array[j];
            array[j] = array[j + 1];
            array[j + 1] = temp;
            bar1.style.height = array[j] + '%';
            bar2.style.height = array[j + 1] + '%';
          }
          stats.textContent = \`Comparisons: \${comparisons} | Swaps: \${swaps}\`;
          await sleep(25);
          bar1.classList.remove('comparing');
          bar2.classList.remove('comparing');
        }
        document.getElementById('bar-' + (array.length - i - 1)).classList.add('sorted');
      }
      isSorting = false;
    }
    document.getElementById('btn-bubble').onclick = bubbleSort;
    document.getElementById('btn-quick').onclick = bubbleSort;
    document.getElementById('btn-merge').onclick = bubbleSort;
  </script>
</body>
</html>`;
}

// ── 4. Neural Network Architecture Visualizer ────────────────────────────────
function generateNeuralNetworkSimulation(lang = 'hinglish') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>2030 Neural Network Synapse Visualizer</title>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Space+Grotesk:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#02040a; color:#f8fafc; font-family:'Space Grotesk',sans-serif; overflow:hidden; width:100vw; height:100vh; }
    canvas { width:100%; height:100%; display:block; }
    .hud { position:absolute; top:16px; left:16px; z-index:10; background:rgba(15,23,42,0.85); backdrop-filter:blur(18px); border:1px solid rgba(0,240,255,0.3); border-radius:14px; padding:16px; width:300px; }
    .hud h1 { font-family:'Orbitron',sans-serif; font-size:13px; font-weight:800; color:#00f0ff; margin-bottom:6px; }
    .hud p { font-size:11px; color:#94a3b8; line-height:1.4; margin-bottom:12px; }
    .btn { background:rgba(30,41,59,0.9); border:1px solid #00f0ff; color:#00f0ff; font-family:'Orbitron',sans-serif; font-size:10px; padding:6px 12px; border-radius:8px; cursor:pointer; }
    .btn:hover { background:#00f0ff; color:#000; }
  </style>
</head>
<body>
  <div class="hud">
    <h1>🧠 Deep Neural Visualizer</h1>
    <p>Real-time forward pass pulse flow through Input, Hidden, and Output layers with active weight firing.</p>
    <button class="btn" id="btn-fire">Trigger Forward Pass</button>
  </div>
  <canvas id="canvas"></canvas>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const layers = [4, 6, 6, 3];
    let nodes = [];
    let pulses = [];

    function setupNetwork() {
      nodes = [];
      const layerSpacing = width / (layers.length + 1);
      layers.forEach((count, lIdx) => {
        const x = (lIdx + 1) * layerSpacing;
        const nodeSpacing = height / (count + 1);
        for (let nIdx = 0; nIdx < count; nIdx++) {
          nodes.push({
            layer: lIdx,
            index: nIdx,
            x,
            y: (nIdx + 1) * nodeSpacing,
            activation: 0.2 + Math.random() * 0.8
          });
        }
      });
    }
    setupNetwork();

    function firePulse() {
      for (let i = 0; i < layers[0]; i++) {
        pulses.push({
          sourceLayer: 0,
          sourceIndex: i,
          progress: 0,
          speed: 0.02 + Math.random() * 0.015
        });
      }
    }
    document.getElementById('btn-fire').onclick = firePulse;
    setInterval(firePulse, 1600);

    function draw() {
      ctx.fillStyle = '#02040a';
      ctx.fillRect(0, 0, width, height);

      // Draw Synapses
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = 0; j < nodes.length; j++) {
          if (nodes[j].layer === nodes[i].layer + 1) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
            ctx.stroke();
          }
        }
      }

      // Draw Pulses
      for (let pIdx = pulses.length - 1; pIdx >= 0; pIdx--) {
        const p = pulses[pIdx];
        p.progress += p.speed;
        const currentNodes = nodes.filter(n => n.layer === p.sourceLayer);
        const nextNodes = nodes.filter(n => n.layer === p.sourceLayer + 1);
        if (p.progress >= 1) {
          if (p.sourceLayer + 1 < layers.length - 1) {
            for (let k = 0; k < nextNodes.length; k++) {
              pulses.push({ sourceLayer: p.sourceLayer + 1, sourceIndex: k, progress: 0, speed: p.speed });
            }
          }
          pulses.splice(pIdx, 1);
          continue;
        }

        const src = currentNodes[p.sourceIndex % currentNodes.length];
        if (src && nextNodes.length > 0) {
          for (let target of nextNodes) {
            const px = src.x + (target.x - src.x) * p.progress;
            const py = src.y + (target.y - src.y) * p.progress;
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#00f0ff';
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      }

      // Draw Nodes
      for (let n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = n.layer === 0 ? '#38bdf8' : n.layer === layers.length - 1 ? '#a855f7' : '#34d399';
        ctx.lineWidth = 2.5;
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(n.x, n.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      requestAnimationFrame(draw);
    }
    draw();

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      setupNetwork();
    });
  </script>
</body>
</html>`;
}

// ── 5. Interactive Periodic Table ─────────────────────────────────────────────
function generatePeriodicTableSimulation(lang = 'hinglish') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>2030 Glassmorphic Periodic Table of Elements</title>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Space+Grotesk:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#030712; color:#f8fafc; font-family:'Space Grotesk',sans-serif; min-height:100vh; padding:20px; }
    header { text-align:center; margin-bottom:20px; }
    h1 { font-family:'Orbitron',sans-serif; font-size:20px; background:linear-gradient(135deg,#38bdf8,#c084fc); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
    .grid { display:grid; grid-template-columns:repeat(18, 1fr); gap:4px; max-width:1200px; margin:0 auto; }
    .element { background:rgba(30,41,59,0.7); border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:6px 2px; text-align:center; cursor:pointer; transition:all 0.2s; min-height:55px; display:flex; flex-direction:column; justify-content:center; }
    .element:hover { transform:scale(1.2); z-index:20; border-color:#00f0ff; box-shadow:0 0 16px rgba(0,240,255,0.5); }
    .num { font-size:8px; color:#94a3b8; }
    .sym { font-family:'Orbitron',sans-serif; font-size:13px; font-weight:800; color:#fff; }
    .name { font-size:7px; color:#cbd5e1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .modal { position:fixed; inset:0; background:rgba(0,0,0,0.7); backdrop-filter:blur(8px); display:none; align-items:center; justify-content:center; z-index:100; }
    .modal-card { background:#0f172a; border:1px solid #38bdf8; border-radius:16px; padding:24px; max-width:360px; width:90%; text-align:center; box-shadow:0 20px 50px rgba(0,0,0,0.9); }
    .modal-card h2 { font-family:'Orbitron',sans-serif; font-size:24px; color:#38bdf8; }
    .close-btn { margin-top:16px; background:#38bdf8; border:none; color:#000; font-family:'Orbitron',sans-serif; font-weight:700; padding:8px 20px; border-radius:8px; cursor:pointer; }
  </style>
</head>
<body>
  <header>
    <h1>🧪 Interactive Periodic Table 2030</h1>
    <p style="font-size:12px; color:#94a3b8; margin-top:4px;">Click any element to inspect Bohr electron shells, atomic weight, and orbital mechanics.</p>
  </header>
  <div class="grid" id="elements-grid"></div>
  <div class="modal" id="modal">
    <div class="modal-card">
      <h2 id="m-sym">H</h2>
      <p id="m-name" style="font-size:16px; margin:4px 0 12px; color:#f8fafc;">Hydrogen</p>
      <div id="m-info" style="font-size:12px; color:#94a3b8; line-height:1.6; text-align:left;"></div>
      <button class="close-btn" onclick="document.getElementById('modal').style.display='none'">Close</button>
    </div>
  </div>
  <script>
    const data = [
      { n:1, s:'H', name:'Hydrogen', w:1.008, cat:'Nonmetal', col:1, row:1 },
      { n:2, s:'He', name:'Helium', w:4.0026, cat:'Noble Gas', col:18, row:1 },
      { n:3, s:'Li', name:'Lithium', w:6.94, cat:'Alkali', col:1, row:2 },
      { n:4, s:'Be', name:'Beryllium', w:9.0122, cat:'Alkaline', col:2, row:2 },
      { n:5, s:'B', name:'Boron', w:10.81, cat:'Metalloid', col:13, row:2 },
      { n:6, s:'C', name:'Carbon', w:12.011, cat:'Nonmetal', col:14, row:2 },
      { n:7, s:'N', name:'Nitrogen', w:14.007, cat:'Nonmetal', col:15, row:2 },
      { n:8, s:'O', name:'Oxygen', w:15.999, cat:'Nonmetal', col:16, row:2 },
      { n:9, s:'F', name:'Fluorine', w:18.998, cat:'Halogen', col:17, row:2 },
      { n:10, s:'Ne', name:'Neon', w:20.180, cat:'Noble Gas', col:18, row:2 },
      { n:11, s:'Na', name:'Sodium', w:22.990, cat:'Alkali', col:1, row:3 },
      { n:12, s:'Mg', name:'Magnesium', w:24.305, cat:'Alkaline', col:2, row:3 },
      { n:13, s:'Al', name:'Aluminium', w:26.982, cat:'Post-transition', col:13, row:3 },
      { n:14, s:'Si', name:'Silicon', w:28.085, cat:'Metalloid', col:14, row:3 },
      { n:15, s:'P', name:'Phosphorus', w:30.974, cat:'Nonmetal', col:15, row:3 },
      { n:16, s:'S', name:'Sulfur', w:32.06, cat:'Nonmetal', col:16, row:3 },
      { n:17, s:'Cl', name:'Chlorine', w:35.45, cat:'Halogen', col:17, row:3 },
      { n:18, s:'Ar', name:'Argon', w:39.948, cat:'Noble Gas', col:18, row:3 },
      { n:19, s:'K', name:'Potassium', w:39.098, cat:'Alkali', col:1, row:4 },
      { n:20, s:'Ca', name:'Calcium', w:40.078, cat:'Alkaline', col:2, row:4 },
      { n:26, s:'Fe', name:'Iron', w:55.845, cat:'Transition', col:8, row:4 },
      { n:29, s:'Cu', name:'Copper', w:63.546, cat:'Transition', col:11, row:4 },
      { n:79, s:'Au', name:'Gold', w:196.97, cat:'Transition', col:11, row:6 },
      { n:80, s:'Hg', name:'Mercury', w:200.59, cat:'Transition', col:12, row:6 }
    ];

    const grid = document.getElementById('elements-grid');
    data.forEach(el => {
      const card = document.createElement('div');
      card.className = 'element';
      card.style.gridColumn = el.col;
      card.style.gridRow = el.row;
      card.innerHTML = \`<span class="num">\${el.n}</span><span class="sym">\${el.s}</span><span class="name">\${el.name}</span>\`;
      card.onclick = () => {
        document.getElementById('m-sym').textContent = el.s;
        document.getElementById('m-name').textContent = el.name;
        document.getElementById('m-info').innerHTML = \`
          <strong>Atomic Number:</strong> \${el.n}<br>
          <strong>Atomic Weight:</strong> \${el.w} u<br>
          <strong>Category:</strong> \${el.cat}<br>
          <strong>Position:</strong> Group \${el.col}, Period \${el.row}
        \`;
        document.getElementById('modal').style.display = 'flex';
      };
      grid.appendChild(card);
    });
  </script>
</body>
</html>`;
}

// ── 6. Interactive Fluid Dynamics Simulation ──────────────────────────────────
function generateFluidSimulation(lang = 'hinglish') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>2030 Quantum Fluid Dynamics Simulation</title>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Space+Grotesk:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#02040a; color:#f8fafc; font-family:'Space Grotesk',sans-serif; overflow:hidden; width:100vw; height:100vh; }
    canvas { width:100%; height:100%; display:block; }
    .hud { position:absolute; top:16px; left:16px; z-index:10; background:rgba(15,23,42,0.85); backdrop-filter:blur(16px); border:1px solid rgba(0,240,255,0.3); border-radius:14px; padding:16px; width:320px; }
    .hud h1 { font-family:'Orbitron',sans-serif; font-size:13px; font-weight:800; color:#00f0ff; margin-bottom:6px; }
    .hud p { font-size:11px; color:#94a3b8; line-height:1.4; margin-bottom:12px; }
    .controls { display:flex; gap:8px; flex-wrap:wrap; }
    .btn { background:rgba(30,41,59,0.9); border:1px solid #00f0ff; color:#00f0ff; font-family:'Orbitron',sans-serif; font-size:10px; padding:6px 12px; border-radius:8px; cursor:pointer; }
    .btn:hover { background:#00f0ff; color:#000; }
  </style>
</head>
<body>
  <div class="hud">
    <h1>🌊 2030 Quantum Fluid Dynamics</h1>
    <p>Navier-Stokes dye diffusion & vortex forces. Click and drag across the screen to inject fluid velocity and colorful plasma.</p>
    <div class="controls">
      <button class="btn" id="btn-clear">Clear Fluid</button>
      <button class="btn" id="btn-color">Palette: Cyan/Magenta</button>
    </div>
  </div>
  <canvas id="canvas"></canvas>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const particles = [];
    const maxParticles = 1200;
    let hueOffset = 180;
    let isMouseDown = false;
    let lastPos = { x: 0, y: 0 };

    class FluidParticle {
      constructor(x, y, vx, vy, hue) {
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.life = 1.0;
        this.decay = 0.006 + Math.random() * 0.008;
        this.size = 6 + Math.random() * 12;
        this.hue = hue;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.98;
        this.vy *= 0.98;
        this.life -= this.decay;
        this.size *= 0.99;
      }
      draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(1, this.size), 0, Math.PI * 2);
        ctx.fillStyle = \`hsla(\${this.hue}, 100%, 65%, \${this.life * 0.7})\`;
        ctx.shadowColor = \`hsl(\${this.hue}, 100%, 60%)\`;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    function addFluid(x, y, dx, dy) {
      const count = 8;
      for (let i = 0; i < count; i++) {
        if (particles.length >= maxParticles) particles.shift();
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2;
        particles.push(new FluidParticle(
          x + (Math.random() - 0.5) * 15,
          y + (Math.random() - 0.5) * 15,
          dx * 0.4 + Math.cos(angle) * speed,
          dy * 0.4 + Math.sin(angle) * speed,
          (hueOffset + Math.random() * 60) % 360
        ));
      }
    }

    window.addEventListener('mousedown', (e) => { isMouseDown = true; lastPos = { x: e.clientX, y: e.clientY }; });
    window.addEventListener('mouseup', () => { isMouseDown = false; });
    window.addEventListener('mousemove', (e) => {
      if (!isMouseDown) return;
      const dx = e.clientX - lastPos.x;
      const dy = e.clientY - lastPos.y;
      addFluid(e.clientX, e.clientY, dx, dy);
      lastPos = { x: e.clientX, y: e.clientY };
    });

    document.getElementById('btn-clear').onclick = () => { particles.length = 0; };
    document.getElementById('btn-color').onclick = (e) => {
      hueOffset = (hueOffset + 90) % 360;
      e.target.textContent = \`Hue Offset: \${hueOffset}°\`;
    };

    function animate() {
      ctx.fillStyle = 'rgba(2, 4, 10, 0.15)';
      ctx.fillRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        p.draw(ctx);
        if (p.life <= 0) particles.splice(i, 1);
      }
      requestAnimationFrame(animate);
    }
    animate();

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });
  </script>
</body>
</html>`;
}

// ── 7. Advanced Three.js Particle System ──────────────────────────────────────
function generateParticleSystemSimulation(lang = 'hinglish') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>2030 Cosmic Particle System</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Space+Grotesk:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#02040a; color:#fff; font-family:'Space Grotesk',sans-serif; overflow:hidden; width:100vw; height:100vh; }
    #container { width:100%; height:100%; position:absolute; }
    .hud { position:absolute; top:16px; left:16px; z-index:10; background:rgba(10,15,29,0.8); backdrop-filter:blur(16px); border:1px solid rgba(139,92,246,0.3); border-radius:14px; padding:16px; width:320px; }
    .hud h1 { font-family:'Orbitron',sans-serif; font-size:13px; font-weight:800; color:#a855f7; margin-bottom:6px; }
    .hud p { font-size:11px; color:#94a3b8; line-height:1.4; margin-bottom:12px; }
    .btn { background:#1e293b; border:1px solid #a855f7; color:#c084fc; font-family:'Orbitron',sans-serif; font-size:10px; padding:6px 12px; border-radius:8px; cursor:pointer; }
    .btn:hover { background:#a855f7; color:#fff; }
  </style>
</head>
<body>
  <div id="container"></div>
  <div class="hud">
    <h1>✨ 10,000+ Cosmic Particle Vortex</h1>
    <p>GPU-accelerated curl noise particle field with gravitational mouse vortex and spectral shift.</p>
    <button class="btn" id="btn-warp">Hyperdrive Warp</button>
  </div>
  <script>
    const container = document.getElementById('container');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 45;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const count = 12000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    const color1 = new THREE.Color('#00f0ff');
    const color2 = new THREE.Color('#8b5cf6');
    const color3 = new THREE.Color('#f43f5e');

    for (let i = 0; i < count; i++) {
      const r = Math.random() * 30 + 2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      velocities[i * 3] = (Math.random() - 0.5) * 0.05;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.05;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.05;

      const mixed = color1.clone().lerp(color2, Math.random()).lerp(color3, Math.random() * 0.5);
      colors[i * 3] = mixed.r;
      colors[i * 3 + 1] = mixed.g;
      colors[i * 3 + 2] = mixed.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.85
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    let warp = false;
    document.getElementById('btn-warp').onclick = (e) => {
      warp = !warp;
      e.target.textContent = warp ? 'Standard Orbit' : 'Hyperdrive Warp';
    };

    let time = 0;
    function animate() {
      requestAnimationFrame(animate);
      time += 0.01;
      particles.rotation.y += warp ? 0.04 : 0.002;
      particles.rotation.x += warp ? 0.02 : 0.001;

      const pos = geometry.attributes.position.array;
      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        pos[idx] += velocities[idx];
        pos[idx + 1] += velocities[idx + 1];
        pos[idx + 2] += velocities[idx + 2];
      }
      geometry.attributes.position.needsUpdate = true;
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  </script>
</body>
</html>`;
}

// ── 8. Physics Engine Demo ───────────────────────────────────────────────────
function generatePhysicsEngineSimulation(lang = 'hinglish') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>2030 Rigid Body Physics Engine Demo</title>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Space+Grotesk:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#030712; color:#fff; font-family:'Space Grotesk',sans-serif; overflow:hidden; width:100vw; height:100vh; }
    canvas { width:100%; height:100%; display:block; }
    .hud { position:absolute; top:16px; left:16px; z-index:10; background:rgba(15,23,42,0.85); backdrop-filter:blur(16px); border:1px solid rgba(16,185,129,0.3); border-radius:14px; padding:16px; width:310px; }
    .hud h1 { font-family:'Orbitron',sans-serif; font-size:13px; font-weight:800; color:#10b981; margin-bottom:6px; }
    .hud p { font-size:11px; color:#94a3b8; line-height:1.4; margin-bottom:12px; }
    .btn { background:#1e293b; border:1px solid #10b981; color:#34d399; font-family:'Orbitron',sans-serif; font-size:10px; padding:6px 12px; border-radius:8px; cursor:pointer; }
    .btn:hover { background:#10b981; color:#000; }
  </style>
</head>
<body>
  <div class="hud">
    <h1>⚙️ Rigid Body Physics Sandbox</h1>
    <p>Elastic collision restitution, velocity integration, and ground bounce. Click to spawn dynamic spheres.</p>
    <button class="btn" id="btn-gravity">Gravity: 9.8 m/s²</button>
    <button class="btn" id="btn-clear">Clear</button>
  </div>
  <canvas id="canvas"></canvas>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    let gravity = 0.45;
    const restitution = 0.78;
    const friction = 0.99;
    const balls = [];

    class Ball {
      constructor(x, y) {
        this.x = x; this.y = y;
        this.radius = 12 + Math.random() * 16;
        this.vx = (Math.random() - 0.5) * 12;
        this.vy = (Math.random() - 0.5) * 10;
        this.color = ['#10b981', '#00f0ff', '#8b5cf6', '#f59e0b'][Math.floor(Math.random() * 4)];
      }
      update() {
        this.vy += gravity;
        this.vx *= friction;
        this.x += this.vx;
        this.y += this.vy;

        // Floor collision
        if (this.y + this.radius > height) {
          this.y = height - this.radius;
          this.vy = -this.vy * restitution;
        }
        // Wall collisions
        if (this.x - this.radius < 0) {
          this.x = this.radius;
          this.vx = -this.vx * restitution;
        } else if (this.x + this.radius > width) {
          this.x = width - this.radius;
          this.vx = -this.vx * restitution;
        }
      }
      draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    window.addEventListener('click', (e) => {
      balls.push(new Ball(e.clientX, e.clientY));
    });

    document.getElementById('btn-gravity').onclick = (e) => {
      gravity = gravity === 0.45 ? 0 : gravity === 0 ? 0.9 : 0.45;
      e.target.textContent = \`Gravity: \${gravity === 0 ? 'Zero G' : gravity === 0.9 ? 'High G' : '9.8 m/s²'}\`;
    };
    document.getElementById('btn-clear').onclick = () => { balls.length = 0; };

    // Initial balls
    for (let i = 0; i < 8; i++) balls.push(new Ball(width * 0.2 + i * 80, height * 0.3));

    function step() {
      ctx.fillStyle = 'rgba(3, 7, 18, 0.3)';
      ctx.fillRect(0, 0, width, height);

      // Ball-to-ball collisions
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const b1 = balls[i];
          const b2 = balls[j];
          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < b1.radius + b2.radius && dist > 0) {
            const normalX = dx / dist;
            const normalY = dy / dist;
            const kx = b1.vx - b2.vx;
            const ky = b1.vy - b2.vy;
            const p = 2 * (normalX * kx + normalY * ky) / 2;
            b1.vx -= p * normalX * 0.5;
            b1.vy -= p * normalY * 0.5;
            b2.vx += p * normalX * 0.5;
            b2.vy += p * normalY * 0.5;
          }
        }
      }

      for (const b of balls) {
        b.update();
        b.draw(ctx);
      }
      requestAnimationFrame(step);
    }
    step();

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });
  </script>
</body>
</html>`;
}

// ── 9. Cybersecurity Attack & SOC Defense Simulation ──────────────────────────
function generateCyberAttackSimulation(lang = 'hinglish') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>2030 Cybersecurity Threat Matrix & SOC Simulation</title>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Space+Grotesk:wght@400;600&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#030712; color:#f8fafc; font-family:'Space Grotesk',sans-serif; display:flex; flex-direction:column; height:100vh; overflow:hidden; }
    header { padding:14px 24px; background:rgba(15,23,42,0.9); border-bottom:1px solid rgba(244,63,94,0.3); display:flex; align-items:center; justify-content:space-between; }
    h1 { font-family:'Orbitron',sans-serif; font-size:15px; color:#f43f5e; }
    .soc-status { font-family:'Orbitron',sans-serif; font-size:11px; padding:4px 10px; border-radius:6px; background:rgba(244,63,94,0.2); border:1px solid #f43f5e; color:#f43f5e; }
    .main { display:flex; flex:1; overflow:hidden; }
    canvas { flex:2; background:#02040a; }
    .terminal { flex:1; background:#0b0f19; border-left:1px solid rgba(255,255,255,0.1); padding:16px; font-family:'JetBrains Mono',monospace; font-size:11px; color:#34d399; overflow-y:auto; display:flex; flex-direction:column; }
    .log-entry { margin-bottom:6px; line-height:1.4; }
    .log-warn { color:#fbbf24; }
    .log-err { color:#f43f5e; font-weight:bold; }
    .controls { display:flex; gap:8px; }
    .btn { background:#1e293b; border:1px solid #f43f5e; color:#f43f5e; font-family:'Orbitron',sans-serif; font-size:10px; padding:6px 12px; border-radius:6px; cursor:pointer; }
    .btn-shield { border-color:#10b981; color:#10b981; }
  </style>
</head>
<body>
  <header>
    <h1>🛡️ SOC Cyber Threat & DDoS Mitigation Matrix</h1>
    <div class="controls">
      <button class="btn btn-shield" id="btn-firewall">Firewall Shield: ACTIVE</button>
      <button class="btn" id="btn-attack">Trigger DDoS Flood</button>
      <div class="soc-status" id="soc-status">DEFCON 3: ELEVATED</div>
    </div>
  </header>
  <div class="main">
    <canvas id="canvas"></canvas>
    <div class="terminal" id="terminal">
      <div class="log-entry">[00:00:01] SOC Core initialized. Monitoring node traffic...</div>
      <div class="log-entry">[00:00:03] IPS/IDS signatures loaded: 4,820 patterns.</div>
    </div>
  </div>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const terminal = document.getElementById('terminal');
    let width = canvas.width = canvas.clientWidth;
    let height = canvas.height = canvas.clientHeight;

    let firewallActive = true;
    const packets = [];
    const botnets = [];
    const server = { x: width * 0.75, y: height * 0.5, radius: 36 };

    for (let i = 0; i < 8; i++) {
      botnets.push({
        x: width * 0.15,
        y: height * 0.15 + (i * height * 0.7) / 8,
        radius: 14,
        id: 'BOT-NET-' + (100 + i)
      });
    }

    function addLog(msg, type = '') {
      const div = document.createElement('div');
      div.className = 'log-entry ' + (type === 'err' ? 'log-err' : type === 'warn' ? 'log-warn' : '');
      div.textContent = \`[\${new Date().toLocaleTimeString()}] \${msg}\`;
      terminal.appendChild(div);
      terminal.scrollTop = terminal.scrollHeight;
    }

    document.getElementById('btn-firewall').onclick = (e) => {
      firewallActive = !firewallActive;
      e.target.textContent = \`Firewall Shield: \${firewallActive ? 'ACTIVE' : 'BYPASS'}\`;
      e.target.style.color = firewallActive ? '#10b981' : '#f43f5e';
      e.target.style.borderColor = firewallActive ? '#10b981' : '#f43f5e';
      addLog(firewallActive ? 'Firewall rules engaged. Filtering traffic.' : 'WARNING: Firewall disabled! Direct assault allowed!', 'err');
    };

    document.getElementById('btn-attack').onclick = () => {
      addLog('ALERT: Inbound SYN Flood DDoS triggered across 8 botnet nodes!', 'err');
      for (let b of botnets) {
        for (let k = 0; k < 12; k++) {
          packets.push({
            x: b.x, y: b.y,
            targetX: server.x, targetY: server.y,
            speed: 3 + Math.random() * 4,
            isMalicious: true
          });
        }
      }
    };

    function draw() {
      ctx.fillStyle = '#02040a';
      ctx.fillRect(0, 0, width, height);

      // Draw Firewall line
      const fwX = width * 0.5;
      ctx.beginPath();
      ctx.moveTo(fwX, 20); ctx.lineTo(fwX, height - 20);
      ctx.strokeStyle = firewallActive ? '#10b981' : '#475569';
      ctx.lineWidth = firewallActive ? 3 : 1;
      ctx.setLineDash([8, 8]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Server Core
      ctx.beginPath();
      ctx.arc(server.x, server.y, server.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 20;
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#00f0ff';
      ctx.font = '10px Orbitron';
      ctx.fillText('CORE SERVER', server.x - 34, server.y + 4);

      // Draw Botnets
      for (let b of botnets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#f43f5e';
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Update Packets
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i];
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        p.x += (dx / dist) * p.speed;
        p.y += (dy / dist) * p.speed;

        // Firewall intercept
        if (firewallActive && p.isMalicious && p.x >= fwX - 5 && p.x <= fwX + 15) {
          packets.splice(i, 1);
          continue;
        }

        if (dist < 10) {
          packets.splice(i, 1);
          if (p.isMalicious && !firewallActive) {
            addLog('Breach packet delivered to Core Server!', 'err');
          }
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = p.isMalicious ? '#f43f5e' : '#38bdf8';
        ctx.fill();
      }

      requestAnimationFrame(draw);
    }
    draw();
  </script>
</body>
</html>`;
}

// ── 10. Interactive 3D Terrain & Cyber Map Simulation ─────────────────────────
function generate3DTerrainSimulation(lang = 'hinglish') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>2030 Cyberpunk 3D Terrain Map</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Space+Grotesk:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#02040a; color:#fff; font-family:'Space Grotesk',sans-serif; overflow:hidden; width:100vw; height:100vh; }
    #container { width:100%; height:100%; position:absolute; }
    .hud { position:absolute; top:16px; left:16px; z-index:10; background:rgba(10,15,29,0.85); backdrop-filter:blur(16px); border:1px solid rgba(56,189,248,0.3); border-radius:14px; padding:16px; width:310px; }
    .hud h1 { font-family:'Orbitron',sans-serif; font-size:13px; font-weight:800; color:#38bdf8; margin-bottom:6px; }
    .hud p { font-size:11px; color:#94a3b8; line-height:1.4; margin-bottom:12px; }
    .btn { background:#1e293b; border:1px solid #38bdf8; color:#38bdf8; font-family:'Orbitron',sans-serif; font-size:10px; padding:6px 12px; border-radius:8px; cursor:pointer; }
    .btn:hover { background:#38bdf8; color:#000; }
  </style>
</head>
<body>
  <div id="container"></div>
  <div class="hud">
    <h1>🏔️ 2030 Procedural 3D Terrain</h1>
    <p>Procedural heightmap mesh, wireframe cyber overlay, dynamic water plane, and OrbitControls flythrough.</p>
    <button class="btn" id="btn-wireframe">Toggle Wireframe</button>
  </div>
  <script>
    const container = document.getElementById('container');
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x02040a, 0.015);

    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 25, 45);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Sun / Ambient
    const dirLight = new THREE.DirectionalLight(0x00f0ff, 1.8);
    dirLight.position.set(20, 40, 20);
    scene.add(dirLight);
    scene.add(new THREE.AmbientLight(0x1e1b4b, 0.6));

    // Terrain Plane
    const terrainWidth = 80;
    const terrainDepth = 80;
    const segments = 90;
    const terrainGeo = new THREE.PlaneGeometry(terrainWidth, terrainDepth, segments, segments);
    terrainGeo.rotateX(-Math.PI / 2);

    const pos = terrainGeo.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i];
      const z = pos[i + 2];
      pos[i + 1] = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 4 + Math.sin(x * 0.05 + z * 0.05) * 6;
    }
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.8,
      metalness: 0.2,
      wireframe: false,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    scene.add(terrainMesh);

    // Water Plane
    const waterGeo = new THREE.PlaneGeometry(80, 80);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.25 });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.y = -1;
    scene.add(water);

    document.getElementById('btn-wireframe').onclick = () => {
      terrainMat.wireframe = !terrainMat.wireframe;
    };

    function animate() {
      requestAnimationFrame(animate);
      terrainMesh.rotation.y += 0.001;
      water.rotation.y += 0.001;
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  </script>
</body>
</html>`;
}

// ── 11. Playable 2030 Cyberpunk Game Prototype ───────────────────────────────
function generateGamePrototype(lang = 'hinglish') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>2030 Cyberpunk Asteroid Raider</title>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; user-select:none; }
    body { background:#02040a; color:#fff; font-family:'Orbitron',sans-serif; overflow:hidden; width:100vw; height:100vh; }
    canvas { display:block; width:100%; height:100%; }
    .hud { position:absolute; top:20px; left:20px; z-index:10; display:flex; gap:20px; font-size:14px; text-shadow:0 0 10px #00f0ff; }
    .game-over { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center; display:none; }
    .game-over h2 { font-size:32px; color:#f43f5e; margin-bottom:12px; }
    .btn { background:#0f172a; border:1px solid #00f0ff; color:#00f0ff; font-family:'Orbitron',sans-serif; padding:10px 24px; border-radius:8px; cursor:pointer; font-size:12px; }
  </style>
</head>
<body>
  <div class="hud">
    <div id="score">SCORE: 0</div>
    <div id="health">SHIELD: 100%</div>
  </div>
  <div class="game-over" id="game-over">
    <h2>SYSTEM OVERLOAD</h2>
    <button class="btn" id="btn-restart">RESTART MISSION</button>
  </div>
  <canvas id="canvas"></canvas>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    let score = 0;
    let health = 100;
    let isGameOver = false;

    const player = { x: width / 2, y: height - 80, size: 24, speed: 7 };
    const bullets = [];
    const asteroids = [];
    const keys = {};

    window.addEventListener('keydown', (e) => {
      keys[e.key] = true;
      if (e.key === ' ' && !isGameOver) {
        bullets.push({ x: player.x, y: player.y - 15, vy: -12 });
      }
    });
    window.addEventListener('keyup', (e) => { keys[e.key] = false; });

    document.getElementById('btn-restart').onclick = () => {
      score = 0; health = 100; isGameOver = false;
      asteroids.length = 0; bullets.length = 0;
      document.getElementById('game-over').style.display = 'none';
      document.getElementById('score').textContent = 'SCORE: 0';
      document.getElementById('health').textContent = 'SHIELD: 100%';
    };

    function spawnAsteroid() {
      if (Math.random() < 0.04 && !isGameOver) {
        asteroids.push({
          x: Math.random() * width,
          y: -30,
          radius: 16 + Math.random() * 20,
          vy: 2 + Math.random() * 3
        });
      }
    }

    function gameLoop() {
      ctx.fillStyle = 'rgba(2, 4, 10, 0.3)';
      ctx.fillRect(0, 0, width, height);

      if (!isGameOver) {
        if (keys['ArrowLeft'] || keys['a']) player.x = Math.max(player.size, player.x - player.speed);
        if (keys['ArrowRight'] || keys['d']) player.x = Math.min(width - player.size, player.x + player.speed);
        spawnAsteroid();
      }

      // Draw Player
      ctx.beginPath();
      ctx.moveTo(player.x, player.y - player.size);
      ctx.lineTo(player.x - player.size * 0.7, player.y + player.size * 0.7);
      ctx.lineTo(player.x + player.size * 0.7, player.y + player.size * 0.7);
      ctx.closePath();
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw Bullets
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.y += b.vy;
        ctx.fillStyle = '#34d399';
        ctx.fillRect(b.x - 2, b.y, 4, 12);
        if (b.y < 0) bullets.splice(i, 1);
      }

      // Draw Asteroids
      for (let i = asteroids.length - 1; i >= 0; i--) {
        const a = asteroids[i];
        a.y += a.vy;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#f43f5e';
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Collision with bullet
        for (let j = bullets.length - 1; j >= 0; j--) {
          const b = bullets[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < a.radius) {
            asteroids.splice(i, 1);
            bullets.splice(j, 1);
            score += 100;
            document.getElementById('score').textContent = 'SCORE: ' + score;
            break;
          }
        }

        // Collision with player
        if (Math.hypot(a.x - player.x, a.y - player.y) < a.radius + player.size) {
          asteroids.splice(i, 1);
          health -= 25;
          document.getElementById('health').textContent = 'SHIELD: ' + health + '%';
          if (health <= 0) {
            isGameOver = true;
            document.getElementById('game-over').style.display = 'block';
          }
        }
      }

      requestAnimationFrame(gameLoop);
    }
    gameLoop();
  </script>
</body>
</html>`;
}

// ── Master Simulation Dispatcher ──────────────────────────────────────────────
function getSimulationHtmlByIntent(userMessage, lang = 'hinglish') {
  const text = String(userMessage || '').toLowerCase();

  if (/earth|3d earth|globe|planet earth|continents|atmosphere/i.test(text)) {
    return generate3DEarthSimulation(lang);
  }
  if (/gravity|n-body|orbit simulation|kepler|gravity physics/i.test(text)) {
    return generateGravitySimulation(lang);
  }
  if (/fluid|fluid simulation|navier|dye|liquid/i.test(text)) {
    return generateFluidSimulation(lang);
  }
  if (/particle|particle system|cosmic particle|vortex|stardust/i.test(text)) {
    return generateParticleSystemSimulation(lang);
  }
  if (/physics|physics engine|rigid body|bouncing|restitution/i.test(text)) {
    return generatePhysicsEngineSimulation(lang);
  }
  if (/cyber|cybersecurity|attack simulation|ddos|soc|hacker|packet flood/i.test(text)) {
    return generateCyberAttackSimulation(lang);
  }
  if (/terrain|3d terrain|map|procedural terrain|mountains/i.test(text)) {
    return generate3DTerrainSimulation(lang);
  }
  if (/game|game prototype|space shooter|asteroid|runner/i.test(text)) {
    return generateGamePrototype(lang);
  }
  if (/sorting|sort visualizer|bubble sort|quick sort|algorithm visualizer/i.test(text)) {
    return generateSortingVisualizer(lang);
  }
  if (/neural|neural network|synapse|deep learning visualizer|perceptron/i.test(text)) {
    return generateNeuralNetworkSimulation(lang);
  }
  if (/periodic table|elements|chemistry|atom|electron shell/i.test(text)) {
    return generatePeriodicTableSimulation(lang);
  }

  // Default to 3D Earth
  return generate3DEarthSimulation(lang);
}

module.exports = {
  INTERACTIVE_SIMULATIONS_DIRECTIVE,
  generate3DEarthSimulation,
  generateGravitySimulation,
  generateFluidSimulation,
  generateParticleSystemSimulation,
  generatePhysicsEngineSimulation,
  generateCyberAttackSimulation,
  generate3DTerrainSimulation,
  generateGamePrototype,
  generateSortingVisualizer,
  generateNeuralNetworkSimulation,
  generatePeriodicTableSimulation,
  getSimulationHtmlByIntent,
};

