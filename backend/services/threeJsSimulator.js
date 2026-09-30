/**
 * threeJsSimulator.js
 * 2030 Ultra-HD Futuristic 3D Animation & WebGL Engine for AI-Dost.
 * Generates state-of-the-art 2030 cyberpunk, sci-fi, and holographic simulations:
 * - 3D Solar System & Keplerian Gravity Simulation
 * - 3D Cyberpunk Holographic Brand & Logo Reveal
 * - 3D Kinetic Sci-Fi Typography & Energy Core
 * - 3D Playable Cyber Hyperdrive / Tron Tunnel Game
 * - 3D Neural Synapse / Quantum Particle Field
 */
const {
  INTERACTIVE_SIMULATIONS_DIRECTIVE,
  generate3DEarthSimulation,
  generateGravitySimulation,
  generateSortingVisualizer,
  generateNeuralNetworkSimulation,
  generatePeriodicTableSimulation,
} = require('./interactiveSimulationsEngine');

const THREEJS_WEBGL_SYSTEM_DIRECTIVE = `
${INTERACTIVE_SIMULATIONS_DIRECTIVE}
══════════════════════════════════════════════════════════════════════════════
2030 ULTRA-HD FUTURISTIC DESIGN & ANIMATION MANDATE (STRICT ZERO-1990s RULE):
══════════════════════════════════════════════════════════════════════════════
The user DEMANDS a modern, 2030-era futuristic, ultra-HD aesthetic. 
NEVER produce flat 1990s/early-2000s retro styling, crude primary colors (plain red/blue/green), basic boxes, or boring static HTML/CSS.

Every generated animation, visual code block, 3D scene, logo, brand showcase, kinetic text, or game MUST adhere to the following 2030 ULTRA-HD STANDARDS:

1. COLOR PALETTE & ATMOSPHERE:
   - Deep obsidian/space void background: #02040a, #030712, radial-gradient(circle at 50% 50%, #0d1527 0%, #02040a 100%).
   - Neon glow & cyber accents: Electric Cyan (#00f0ff), Ultraviolet (#8b5cf6), Holographic Emerald (#10b981), Sunset Plasma (#f43f5e), Liquid Gold (#f59e0b).
   - Multi-layered Bloom, Glow, and Additive Blending (THREE.AdditiveBlending).

2. TYPOGRAPHY & HUD:
   - Google Fonts: 'Orbitron', 'Space Grotesk', 'Plus Jakarta Sans', or 'Syne'.
   - Futuristic Glassmorphism HUD: backdrop-filter: blur(16px), border: 1px solid rgba(255, 255, 255, 0.12), soft cyber glow shadows.
   - Real-time telemetry readouts, status pills, speed sliders, and interactive controls.

3. GRAPHICS & VISUAL TECHNIQUES (Three.js r128 + WebGL):
   - Include CDNs:
     <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
     <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
     <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Space+Grotesk:wght@400;600&display=swap" rel="stylesheet">
   - Volumetric lighting (PointLight with realistic decay, ambient rim lighting).
   - High particle counts (2,500 - 5,000 particles) with motion trails and twinkling.
   - Smooth requestAnimationFrame(loop) with delta-time calculation.
   - Interactive mouse/touch tracking, OrbitControls, and smooth camera damping.

4. 100% SELF-CONTAINED & RUNNABLE:
   - Every artifact must be a single complete HTML file wrapped in \`\`\`html ... \`\`\` that runs immediately with ZERO external asset dependencies.
`;

// ── 1. 2030 Ultra-HD 3D Solar System & Gravitational Orbit Simulation ─────────
function generateThreeJsSolarSystem(lang = 'hinglish') {
  const intro = (lang === 'hindi')
    ? '🚀 **2030 Ultra-HD 3D Solar System & Quantum Gravity Simulation** तैयार है! इसमें 3,500+ पार्टिकल नेबुला, ACESFilmic टोन मैपिंग, सूर्य का वॉल्‍यूमीट्रिक कोरोना और इंटरैक्टिव साइबर HUD शामिल हैं:'
    : (lang === 'english')
    ? '🚀 **2030 Ultra-HD 3D Solar System & Quantum Gravity Simulation** is ready! Features 3,500+ particle nebula, ACESFilmic tone mapping, volumetric solar corona, and an interactive cyber telemetry HUD:'
    : '🚀 **2030 Ultra-HD 3D Solar System & Quantum Gravity Simulation** ready hai! Isme 1990s ke basic styling ko chhod kar 2030 sci-fi aesthetic, ACESFilmic tone mapping, volumetric solar corona, 3,500+ starfield nebula, aur interactive Cyber Glassmorphic HUD integrate kiya gaya hai:';

  const code = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>2030 Ultra-HD Solar System Simulation</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Space+Grotesk:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
    body {
      background: #02040a;
      color: #f8fafc;
      font-family: 'Space Grotesk', -apple-system, sans-serif;
      overflow: hidden;
      width: 100vw;
      height: 100vh;
    }
    #canvas-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; }
    
    /* 2030 Cyber Glassmorphic HUD */
    .cyber-hud {
      position: absolute;
      top: 20px;
      left: 20px;
      z-index: 10;
      background: rgba(10, 15, 29, 0.72);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      border: 1px solid rgba(56, 189, 248, 0.25);
      border-radius: 16px;
      padding: 18px 22px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7), 0 0 25px rgba(56, 189, 248, 0.15);
      max-width: 340px;
      pointer-events: auto;
    }
    .hud-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .hud-title {
      font-family: 'Orbitron', monospace;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 1.5px;
      background: linear-gradient(135deg, #38bdf8, #818cf8, #c084fc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-transform: uppercase;
    }
    .status-badge {
      font-size: 9px;
      font-family: 'Orbitron', monospace;
      padding: 3px 8px;
      border-radius: 20px;
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.4);
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #34d399;
      box-shadow: 0 0 8px #34d399;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    
    .control-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      font-size: 12px;
      color: #94a3b8;
    }
    .control-row label { font-weight: 500; }
    .control-row input[type="range"] {
      width: 130px;
      accent-color: #38bdf8;
      cursor: pointer;
    }
    .cyber-select {
      width: 130px;
      background: #0f172a;
      color: #f8fafc;
      border: 1px solid rgba(56, 189, 248, 0.3);
      border-radius: 8px;
      padding: 5px 8px;
      font-size: 11px;
      font-family: 'Space Grotesk', sans-serif;
      outline: none;
      cursor: pointer;
    }
    .btn-group { display: flex; gap: 8px; margin-top: 14px; }
    .cyber-btn {
      flex: 1;
      padding: 9px 12px;
      border-radius: 10px;
      font-size: 11px;
      font-family: 'Orbitron', monospace;
      font-weight: 700;
      letter-spacing: 0.5px;
      cursor: pointer;
      border: 1px solid rgba(56, 189, 248, 0.35);
      background: linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(129, 140, 248, 0.15));
      color: #38bdf8;
      transition: all 0.25s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .cyber-btn:hover {
      background: linear-gradient(135deg, #0284c7, #6366f1);
      color: #ffffff;
      border-color: #38bdf8;
      box-shadow: 0 0 20px rgba(56, 189, 248, 0.5);
      transform: translateY(-1px);
    }
    
    /* Telemetry Hologram Card */
    .telemetry-hud {
      position: absolute;
      bottom: 24px;
      right: 24px;
      z-index: 10;
      background: rgba(10, 15, 29, 0.75);
      backdrop-filter: blur(18px);
      border: 1px solid rgba(129, 140, 248, 0.3);
      border-radius: 14px;
      padding: 14px 18px;
      font-family: 'Orbitron', monospace;
      font-size: 11px;
      color: #94a3b8;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(129, 140, 248, 0.15);
      min-width: 220px;
    }
    .telemetry-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
    .telemetry-row:last-child { margin-bottom: 0; }
    .telemetry-row span.val { color: #38bdf8; font-weight: 700; text-shadow: 0 0 10px rgba(56, 189, 248, 0.5); }
    
    .view-hint {
      position: absolute;
      bottom: 24px;
      left: 24px;
      z-index: 10;
      font-size: 11px;
      color: #64748b;
      background: rgba(10, 15, 29, 0.65);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 6px 14px;
      border-radius: 20px;
      backdrop-filter: blur(10px);
      pointer-events: none;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div id="canvas-container"></div>

  <div class="cyber-hud">
    <div class="hud-header">
      <div class="hud-title">Orbital Telemetry 2030</div>
      <div class="status-badge"><span class="status-dot"></span> LIVE 60 FPS</div>
    </div>
    <div class="control-row">
      <label>Speed Warping (<span id="speed-val">1.0x</span>)</label>
      <input type="range" id="speed-slider" min="0" max="4" step="0.1" value="1.0">
    </div>
    <div class="control-row">
      <label>Quantum G-Field (<span id="gravity-val">1.0x</span>)</label>
      <input type="range" id="gravity-slider" min="0.2" max="2.5" step="0.1" value="1.0">
    </div>
    <div class="control-row">
      <label>Target Lock</label>
      <select id="focus-select" class="cyber-select">
        <option value="sun">Sol (Core)</option>
        <option value="mercury">Mercury</option>
        <option value="venus">Venus</option>
        <option value="earth" selected>Earth & Moon</option>
        <option value="mars">Mars</option>
        <option value="jupiter">Jupiter</option>
        <option value="saturn">Saturn (Rings)</option>
        <option value="uranus">Uranus</option>
        <option value="neptune">Neptune</option>
      </select>
    </div>
    <div class="btn-group">
      <button class="cyber-btn" id="btn-pause">⏸️ PAUSE</button>
      <button class="cyber-btn" id="btn-reset">🔄 RESET</button>
    </div>
  </div>

  <div class="telemetry-hud" id="telemetry">
    <div class="telemetry-row">TARGET: <span class="val" id="tel-name">Earth</span></div>
    <div class="telemetry-row">RADIUS: <span class="val" id="tel-dist">1.00 AU</span></div>
    <div class="telemetry-row">VELOCITY: <span class="val" id="tel-vel">29.8 km/s</span></div>
    <div class="telemetry-row">ORBIT TIME: <span class="val" id="tel-period">365.2 Days</span></div>
  </div>

  <div class="view-hint">
    ✦ Drag: 360° Orbit • Scroll: Hyper-Zoom • Right Click: Pan
  </div>

  <script>
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x02040a, 0.001);

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 4000);
    camera.position.set(0, 85, 160);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 1000;
    controls.minDistance = 6;

    // ── 3,800 Particle Cyber Starfield with Nebular Color Gradients ──
    const starCount = 3800;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      const radius = 700 + Math.random() * 900;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);

      starPositions[i] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[i + 2] = radius * Math.cos(phi);

      const dice = Math.random();
      if (dice > 0.8) {
        // Cyan Cyber Stardust
        starColors[i] = 0.2; starColors[i + 1] = 0.8; starColors[i + 2] = 1.0;
      } else if (dice > 0.6) {
        // Purple Nebula Stardust
        starColors[i] = 0.7; starColors[i + 1] = 0.3; starColors[i + 2] = 1.0;
      } else {
        // Pure White Stellar Dust
        starColors[i] = 1.0; starColors[i + 1] = 1.0; starColors[i + 2] = 1.0;
      }
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // ── Sol Core & Volumetric Corona ──
    const sunLight = new THREE.PointLight(0xfff4cc, 4.0, 1000, 0.35);
    scene.add(sunLight);
    scene.add(new THREE.AmbientLight(0x0f172a, 0.7));

    const sunGeo = new THREE.SphereGeometry(9.5, 48, 48);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffb703 });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sunMesh);

    // Corona Flare Aura
    const coronaGeo = new THREE.SphereGeometry(11.8, 36, 36);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xfb8500,
      transparent: true,
      opacity: 0.32,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending
    });
    const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
    sunMesh.add(coronaMesh);

    // ── Planets Data ──
    const planetsData = [
      { name: 'Mercury', key: 'mercury', r: 1.2, dist: 18, color: 0x94a3b8, speedBase: 0.040, realVel: 47.4, period: 88, au: 0.39 },
      { name: 'Venus',   key: 'venus',   r: 1.9, dist: 26, color: 0xfbbf24, speedBase: 0.030, realVel: 35.0, period: 224.7, au: 0.72 },
      { name: 'Earth',   key: 'earth',   r: 2.2, dist: 38, color: 0x38bdf8, speedBase: 0.022, realVel: 29.8, period: 365.2, au: 1.00, hasMoon: true },
      { name: 'Mars',    key: 'mars',    r: 1.6, dist: 50, color: 0xf43f5e, speedBase: 0.017, realVel: 24.1, period: 687, au: 1.52 },
      { name: 'Jupiter', key: 'jupiter', r: 5.2, dist: 70, color: 0xf59e0b, speedBase: 0.010, realVel: 13.1, period: 4333, au: 5.20 },
      { name: 'Saturn',  key: 'saturn',  r: 4.2, dist: 92, color: 0xfde047, speedBase: 0.007, realVel: 9.7,  period: 10759, au: 9.58, hasRings: true },
      { name: 'Uranus',  key: 'uranus',  r: 3.0, dist: 114, color: 0x22d3ee, speedBase: 0.005, realVel: 6.8, period: 30685, au: 19.2 },
      { name: 'Neptune', key: 'neptune', r: 2.9, dist: 136, color: 0x6366f1, speedBase: 0.004, realVel: 5.4, period: 60189, au: 30.1 }
    ];

    const planets = [];
    planetsData.forEach((p) => {
      // Neon Orbital Ring
      const orbitGeo = new THREE.BufferGeometry();
      const pts = [];
      for (let i = 0; i <= 128; i++) {
        const theta = (i / 128) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(theta) * p.dist, 0, Math.sin(theta) * p.dist));
      }
      orbitGeo.setFromPoints(pts);
      const orbitMat = new THREE.LineBasicMaterial({
        color: 0x1e293b,
        transparent: true,
        opacity: 0.6
      });
      scene.add(new THREE.LineLoop(orbitGeo, orbitMat));

      // Planet Sphere
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(p.r, 32, 32),
        new THREE.MeshStandardMaterial({
          color: p.color,
          roughness: 0.5,
          metalness: 0.2
        })
      );

      // Saturn Rings
      if (p.hasRings) {
        const ringGeo = new THREE.RingGeometry(p.r * 1.4, p.r * 2.4, 64);
        const ringMat = new THREE.MeshStandardMaterial({
          color: 0xeab308,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2.3;
        mesh.add(ring);
      }

      // Earth Moon
      let moonMesh = null;
      if (p.hasMoon) {
        moonMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.55, 16, 16),
          new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8 })
        );
        scene.add(moonMesh);
      }

      scene.add(mesh);
      planets.push({ ...p, mesh, moonMesh, angle: Math.random() * Math.PI * 2, moonAngle: 0 });
    });

    let isPaused = false;
    let speedMult = 1.0;
    let gravityMult = 1.0;
    let focusTarget = 'earth';

    document.getElementById('speed-slider').addEventListener('input', (e) => {
      speedMult = parseFloat(e.target.value);
      document.getElementById('speed-val').innerText = speedMult.toFixed(1) + 'x';
    });
    document.getElementById('gravity-slider').addEventListener('input', (e) => {
      gravityMult = parseFloat(e.target.value);
      document.getElementById('gravity-val').innerText = gravityMult.toFixed(1) + 'x';
      updateTelemetry();
    });
    document.getElementById('focus-select').addEventListener('change', (e) => {
      focusTarget = e.target.value;
      updateTelemetry();
    });
    document.getElementById('btn-pause').addEventListener('click', (e) => {
      isPaused = !isPaused;
      e.target.innerText = isPaused ? '▶️ RESUME' : '⏸️ PAUSE';
    });
    document.getElementById('btn-reset').addEventListener('click', () => {
      focusTarget = 'sun';
      document.getElementById('focus-select').value = 'sun';
      camera.position.set(0, 85, 160);
      controls.target.set(0, 0, 0);
      updateTelemetry();
    });

    function updateTelemetry() {
      if (focusTarget === 'sun') {
        document.getElementById('tel-name').innerText = 'Sol Core';
        document.getElementById('tel-dist').innerText = '0.00 AU';
        document.getElementById('tel-vel').innerText = '0.0 km/s';
        document.getElementById('tel-period').innerText = '230M Yrs';
        return;
      }
      const p = planets.find(item => item.key === focusTarget);
      if (!p) return;
      document.getElementById('tel-name').innerText = p.name;
      document.getElementById('tel-dist').innerText = p.au + ' AU';
      document.getElementById('tel-vel').innerText = (p.realVel * Math.sqrt(gravityMult)).toFixed(1) + ' km/s';
      document.getElementById('tel-period').innerText = p.period + ' Days';
    }

    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();

      sunMesh.rotation.y += 0.002;
      coronaMesh.rotation.z -= 0.001;
      starField.rotation.y += 0.0001;

      if (!isPaused) {
        planets.forEach((p) => {
          p.angle += (p.speedBase * Math.sqrt(gravityMult) * speedMult) * delta * 45;
          const px = Math.cos(p.angle) * p.dist;
          const pz = Math.sin(p.angle) * p.dist;
          p.mesh.position.set(px, 0, pz);
          p.mesh.rotation.y += 0.018;

          if (p.moonMesh) {
            p.moonAngle += 0.08 * speedMult;
            p.moonMesh.position.set(
              px + Math.cos(p.moonAngle) * 4.4,
              Math.sin(p.moonAngle * 0.5) * 0.9,
              pz + Math.sin(p.moonAngle) * 4.4
            );
          }
        });
      }

      if (focusTarget === 'sun') {
        controls.target.lerp(new THREE.Vector3(0, 0, 0), 0.05);
      } else {
        const focused = planets.find(item => item.key === focusTarget);
        if (focused) controls.target.lerp(focused.mesh.position, 0.08);
      }

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

  return `${intro}\n\n\`\`\`html\n${code}\n\`\`\`\n\n*Aap upar **Run Animation** ya **Canvas** par click karke 2030 Ultra-HD 3D simulation ko interactively explore kar sakte hain.*`;
}

// ── 2. 2030 Cyberpunk 3D Holographic Brand & Logo Engine ───────────────────────
function generateFuturisticLogoReveal(brandName = 'AI-DOST 2030', lang = 'hinglish') {
  const intro = (lang === 'hindi')
    ? '✨ **2030 Ultra-HD 3D Cyberpunk Holographic Brand & Logo Showcase** तैयार है! इसमें 3D क्वांटम कोर, घूर्णन करती हुई नियॉन रिंग्स और इंटरैक्टिव माउस-ट्रैकिंग सम्मिलित हैं:'
    : (lang === 'english')
    ? '✨ **2030 Ultra-HD 3D Cyberpunk Holographic Brand & Logo Showcase** is ready! Features a 3D quantum core, rotating neon rings, laser scanlines, and mouse-tracking parallax:'
    : '✨ **2030 Ultra-HD 3D Cyberpunk Holographic Brand & Logo Showcase** ready hai! Isme 3D metallic quantum core, spinning neon wireframe rings, laser scanlines, aur interactive mouse-tilt depth effects integrate kiye gaye hain:';

  const code = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>2030 Cyber Hologram Brand Reveal</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: radial-gradient(circle at 50% 50%, #0c1024 0%, #02040a 100%);
      color: #f8fafc;
      font-family: 'Space Grotesk', sans-serif;
      overflow: hidden;
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #canvas-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; }
    
    /* 2030 Hologram Overlay */
    .overlay-ui {
      position: absolute;
      z-index: 10;
      text-align: center;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .brand-title {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(28px, 6vw, 64px);
      font-weight: 900;
      letter-spacing: 6px;
      text-transform: uppercase;
      background: linear-gradient(135deg, #00f0ff 0%, #7000ff 50%, #ff007b 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      filter: drop-shadow(0 0 30px rgba(0, 240, 255, 0.6));
      margin-bottom: 8px;
    }
    .brand-subtitle {
      font-family: 'Orbitron', monospace;
      font-size: clamp(10px, 1.8vw, 14px);
      letter-spacing: 4px;
      color: #38bdf8;
      text-transform: uppercase;
      opacity: 0.9;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-subtitle::before, .brand-subtitle::after {
      content: '';
      display: inline-block;
      width: 40px;
      height: 1px;
      background: linear-gradient(90deg, transparent, #00f0ff);
    }
    .brand-subtitle::after {
      background: linear-gradient(90deg, #00f0ff, transparent);
    }
    
    .interactive-panel {
      position: absolute;
      bottom: 24px;
      z-index: 10;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(56, 189, 248, 0.25);
      border-radius: 30px;
      padding: 8px 24px;
      font-family: 'Orbitron', monospace;
      font-size: 11px;
      color: #94a3b8;
      letter-spacing: 1px;
      box-shadow: 0 0 20px rgba(0, 240, 255, 0.15);
    }
    .interactive-panel span { color: #00f0ff; font-weight: 700; }
  </style>
</head>
<body>
  <div id="canvas-container"></div>
  
  <div class="overlay-ui">
    <div class="brand-title">${brandName}</div>
    <div class="brand-subtitle">Quantum Neural Synthesis • Cyber 2030</div>
  </div>

  <div class="interactive-panel">
    <span>✦ MOVE CURSOR</span> to control 3D Holographic Perspective
  </div>

  <script>
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 24;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // ── Lighting: Neon Blue & Magenta Rim Lights ──
    const light1 = new THREE.PointLight(0x00f0ff, 3, 50);
    light1.position.set(10, 15, 10);
    scene.add(light1);

    const light2 = new THREE.PointLight(0xff007b, 3, 50);
    light2.position.set(-10, -15, 10);
    scene.add(light2);

    scene.add(new THREE.AmbientLight(0x0a0f24, 1.2));

    // ── Hologram 3D Core: Polyhedron with Wireframe Shell ──
    const coreGeo = new THREE.IcosahedronGeometry(4.5, 2);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      metalness: 0.9,
      roughness: 0.1,
      wireframe: true,
      transparent: true,
      opacity: 0.75
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    scene.add(coreMesh);

    // Inner Glowing Orb
    const innerGeo = new THREE.SphereGeometry(2.4, 32, 32);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x7000ff,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    coreMesh.add(innerMesh);

    // ── Concentric Quantum Rings (Torus) ──
    const ringMat1 = new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true, transparent: true, opacity: 0.4 });
    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0xff007b, wireframe: true, transparent: true, opacity: 0.35 });
    
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(7, 0.08, 16, 100), ringMat1);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(9, 0.08, 16, 100), ringMat2);
    const ring3 = new THREE.Mesh(new THREE.TorusGeometry(11, 0.08, 16, 100), ringMat1);
    scene.add(ring1);
    scene.add(ring2);
    scene.add(ring3);

    // ── 2,000 Particle Data Matrix ──
    const pCount = 2000;
    const pGeo = new THREE.BufferGeometry();
    const pPositions = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i += 3) {
      pPositions[i] = (Math.random() - 0.5) * 80;
      pPositions[i + 1] = (Math.random() - 0.5) * 80;
      pPositions[i + 2] = (Math.random() - 0.5) * 80;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    const pMat = new THREE.PointsMaterial({ size: 1.2, color: 0x00f0ff, transparent: true, opacity: 0.6 });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // Mouse Tracking Parallax
    let mouseX = 0, mouseY = 0;
    let targetX = 0, targetY = 0;
    window.addEventListener('mousemove', (e) => {
      mouseX = (e.clientX - window.innerWidth / 2) * 0.0012;
      mouseY = (e.clientY - window.innerHeight / 2) * 0.0012;
    });

    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Core rotation
      coreMesh.rotation.x += 0.4 * delta;
      coreMesh.rotation.y += 0.6 * delta;

      // Concentric rings counter-rotation
      ring1.rotation.x = Math.sin(time * 0.8) * 0.6;
      ring1.rotation.y += 0.5 * delta;
      ring2.rotation.y = Math.cos(time * 0.7) * 0.7;
      ring2.rotation.z += 0.4 * delta;
      ring3.rotation.x += 0.3 * delta;

      // Particle subtle drift
      particles.rotation.y += 0.0008;

      // Smooth camera parallax
      targetX += (mouseX - targetX) * 0.08;
      targetY += (mouseY - targetY) * 0.08;
      camera.position.x = targetX * 12;
      camera.position.y = -targetY * 12;
      camera.lookAt(scene.position);

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

  return `${intro}\n\n\`\`\`html\n${code}\n\`\`\`\n\n*Aap upar **Run Animation** ya **Canvas** par click karke is 2030 3D Holographic Logo ko live dekh sakte hain.*`;
}

// ── 3. 2030 Playable 3D Cyber Hyperdrive / Tron Runner Game ───────────────────
function generateFuturisticGame(lang = 'hinglish') {
  const intro = (lang === 'hindi')
    ? '🎮 **2030 Cyber Hyperdrive (3D WebGL Runner Game)** तैयार है! एरो कीज़ या A/D से अपने एंटी-ग्रेविटी स्पेसक्राफ्ट को कंट्रोल करें, क्वांटम बाधाओं से बचें और एनर्जी क्रिस्टल्स कलेक्ट करें:'
    : (lang === 'english')
    ? '🎮 **2030 Cyber Hyperdrive (3D WebGL Runner Game)** is ready! Use Arrow Keys or A/D to steer your anti-gravity spacecraft, dodge cyber-obstacles, and collect energy cores:'
    : '🎮 **2030 Cyber Hyperdrive (3D WebGL Runner Game)** ready hai! Arrow keys ya A/D se apne anti-gravity ship ko steer karein, quantum obstacle cubes se bachein aur high score banayein:';

  const code = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>2030 Cyber Hyperdrive Runner</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; user-select: none; }
    body {
      background: #02040a;
      color: #f8fafc;
      font-family: 'Orbitron', monospace;
      overflow: hidden;
      width: 100vw;
      height: 100vh;
    }
    #canvas-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; }
    
    /* Cyber Score HUD */
    .game-hud {
      position: absolute;
      top: 20px;
      left: 20px;
      right: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 10;
      pointer-events: none;
    }
    .hud-box {
      background: rgba(10, 15, 29, 0.75);
      backdrop-filter: blur(14px);
      border: 1px solid rgba(0, 240, 255, 0.3);
      border-radius: 12px;
      padding: 10px 18px;
      box-shadow: 0 0 20px rgba(0, 240, 255, 0.2);
    }
    .hud-val {
      font-size: 20px;
      font-weight: 900;
      color: #00f0ff;
      text-shadow: 0 0 10px rgba(0, 240, 255, 0.8);
    }
    .hud-lbl { font-size: 10px; color: #94a3b8; letter-spacing: 1px; }

    /* Game Over Modal */
    #game-over {
      display: none;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 20;
      background: rgba(10, 15, 29, 0.9);
      backdrop-filter: blur(20px);
      border: 2px solid #ff0055;
      border-radius: 20px;
      padding: 30px 40px;
      text-align: center;
      box-shadow: 0 0 40px rgba(255, 0, 85, 0.5);
    }
    .go-title { font-size: 28px; font-weight: 900; color: #ff0055; margin-bottom: 10px; text-shadow: 0 0 20px #ff0055; }
    .go-btn {
      margin-top: 18px;
      padding: 12px 28px;
      background: linear-gradient(135deg, #00f0ff, #7000ff);
      border: none;
      border-radius: 10px;
      color: #fff;
      font-family: 'Orbitron', monospace;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      box-shadow: 0 0 20px rgba(0, 240, 255, 0.6);
    }
    .controls-hint {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10;
      background: rgba(10, 15, 29, 0.6);
      backdrop-filter: blur(10px);
      padding: 8px 20px;
      border-radius: 20px;
      font-size: 11px;
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.2);
    }
  </style>
</head>
<body>
  <div id="canvas-container"></div>

  <div class="game-hud">
    <div class="hud-box">
      <div class="hud-lbl">DISTANCE</div>
      <div class="hud-val" id="score">0 M</div>
    </div>
    <div class="hud-box">
      <div class="hud-lbl">HYPERDRIVE VELOCITY</div>
      <div class="hud-val" id="speed">850 KM/H</div>
    </div>
  </div>

  <div id="game-over">
    <div class="go-title">SYSTEM FAILURE</div>
    <p style="font-size: 13px; color: #cbd5e1;">Quantum Shield Depleted!</p>
    <div style="font-size: 16px; margin: 12px 0; color: #00f0ff;">SCORE: <span id="final-score">0</span> M</div>
    <button class="go-btn" id="restart-btn">REBOOT SYSTEM</button>
  </div>

  <div class="controls-hint">
    🎮 STEER: Arrow Keys or [A] [D] • Mobile: Touch Left / Right
  </div>

  <script>
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x02040a, 0.015);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 4.5, 9);
    camera.lookAt(0, 1.5, -20);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Lights
    const pLight = new THREE.PointLight(0x00f0ff, 3, 40);
    pLight.position.set(0, 5, 5);
    scene.add(pLight);
    scene.add(new THREE.AmbientLight(0x091428, 1.5));

    // ── Neon Grid Highway ──
    const gridHelper = new THREE.GridHelper(200, 40, 0x00f0ff, 0x1e293b);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // ── Player Cyber Ship ──
    const shipGeo = new THREE.ConeGeometry(1.2, 3, 4);
    const shipMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      metalness: 0.85,
      roughness: 0.2,
      emissive: 0x0077aa,
      emissiveIntensity: 0.4
    });
    const playerShip = new THREE.Mesh(shipGeo, shipMat);
    playerShip.rotation.x = Math.PI / 2;
    playerShip.rotation.y = Math.PI;
    playerShip.position.set(0, 1.2, 2);
    scene.add(playerShip);

    // Ship Thruster Light
    const thrusterLight = new THREE.PointLight(0x7000ff, 2, 10);
    thrusterLight.position.set(0, 0, 1.8);
    playerShip.add(thrusterLight);

    // ── Obstacles & Energy Cubes ──
    const obstacles = [];
    const obsGeo = new THREE.BoxGeometry(2, 2, 2);
    const obsMat = new THREE.MeshStandardMaterial({ color: 0xff0055, emissive: 0xaa0033, roughness: 0.3 });

    function spawnObstacle(zPos) {
      const obs = new THREE.Mesh(obsGeo, obsMat);
      const lanes = [-5, -2.5, 0, 2.5, 5];
      obs.position.set(lanes[Math.floor(Math.random() * lanes.length)], 1, zPos);
      scene.add(obs);
      obstacles.push(obs);
    }

    for (let i = 0; i < 15; i++) spawnObstacle(-30 - i * 25);

    // Controls
    let playerX = 0;
    let targetX = 0;
    let isGameOver = false;
    let score = 0;
    let speed = 1.0;

    window.addEventListener('keydown', (e) => {
      if (isGameOver) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') targetX = Math.max(targetX - 2.5, -5);
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') targetX = Math.min(targetX + 2.5, 5);
    });

    window.addEventListener('pointerdown', (e) => {
      if (isGameOver) return;
      if (e.clientX < window.innerWidth / 2) targetX = Math.max(targetX - 2.5, -5);
      else targetX = Math.min(targetX + 2.5, 5);
    });

    document.getElementById('restart-btn').addEventListener('click', () => {
      obstacles.forEach(o => scene.remove(o));
      obstacles.length = 0;
      for (let i = 0; i < 15; i++) spawnObstacle(-30 - i * 25);
      playerX = 0; targetX = 0; score = 0; speed = 1.0;
      isGameOver = false;
      document.getElementById('game-over').style.display = 'none';
    });

    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      if (isGameOver) return;

      const delta = clock.getDelta();
      score += Math.floor(speed * 10);
      speed = Math.min(speed + 0.0002, 2.5);

      document.getElementById('score').innerText = score + ' M';
      document.getElementById('speed').innerText = Math.floor(speed * 850) + ' KM/H';

      // Move player ship smoothly
      playerX += (targetX - playerX) * 0.2;
      playerShip.position.x = playerX;
      playerShip.rotation.z = (playerX - targetX) * 0.4; // banking tilt

      // Scroll Highway Grid
      gridHelper.position.z = (gridHelper.position.z + speed * 1.5) % 10;

      // Obstacle Motion & Collision Detection
      for (let i = 0; i < obstacles.length; i++) {
        const obs = obstacles[i];
        obs.position.z += speed * 1.2;
        obs.rotation.x += 0.02;
        obs.rotation.y += 0.03;

        // Collision Check (AABB)
        const dx = Math.abs(obs.position.x - playerShip.position.x);
        const dz = Math.abs(obs.position.z - playerShip.position.z);
        if (dx < 1.6 && dz < 1.6) {
          isGameOver = true;
          document.getElementById('final-score').innerText = score;
          document.getElementById('game-over').style.display = 'block';
          return;
        }

        // Recycle passed obstacle
        if (obs.position.z > 15) {
          const lanes = [-5, -2.5, 0, 2.5, 5];
          obs.position.set(lanes[Math.floor(Math.random() * lanes.length)], 1, -180);
        }
      }

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

  return `${intro}\n\n\`\`\`html\n${code}\n\`\`\`\n\n*Aap upar **Run Animation** ya **Canvas** button par click karke is 2030 Cyberpunk 3D Game ko live play kar sakte hain!*`;
}

// ── 4. 2030 Kinetic 3D Typography & Cyber Matrix Engine ───────────────────────
function generateFuturisticTypography(customText = 'AI-DOST 2030', lang = 'hinglish') {
  const intro = (lang === 'hindi')
    ? '✨ **2030 Ultra-HD Kinetic 3D Sci-Fi Typography & Neural Matrix** तैयार है! इसमें 3D वेव मोशन, फ्लोटिंग साइबर नोड्स और माउस-रिएक्टिव ऑरा शामिल हैं:'
    : (lang === 'english')
    ? '✨ **2030 Ultra-HD Kinetic 3D Sci-Fi Typography & Neural Matrix** is ready! Features 3D wave motion, glowing cyber particle nodes, and mouse-reactive aura:'
    : '✨ **2030 Ultra-HD Kinetic 3D Sci-Fi Typography & Neural Matrix** ready hai! Isme 3D wave motion, glowing cyber particle nodes, aur mouse-reactive aura integrate kiya gaya hai:';

  const code = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>2030 Kinetic Typography</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@800;900&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: radial-gradient(circle at 50% 50%, #0c0f24 0%, #02040a 100%);
      color: #f8fafc;
      font-family: 'Orbitron', sans-serif;
      overflow: hidden;
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #canvas-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; }
    
    .kinetic-center {
      position: absolute;
      z-index: 10;
      text-align: center;
      pointer-events: none;
      transform-style: preserve-3d;
    }
    .glitch-text {
      font-size: clamp(36px, 8vw, 84px);
      font-weight: 900;
      letter-spacing: 8px;
      text-transform: uppercase;
      background: linear-gradient(135deg, #00f0ff 0%, #8b5cf6 50%, #f43f5e 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      filter: drop-shadow(0 0 35px rgba(0, 240, 255, 0.7));
      animation: floatAura 3s ease-in-out infinite alternate;
    }
    @keyframes floatAura {
      0% { transform: translateY(0px) scale(1); filter: drop-shadow(0 0 25px rgba(0, 240, 255, 0.6)); }
      100% { transform: translateY(-8px) scale(1.02); filter: drop-shadow(0 0 45px rgba(139, 92, 246, 0.9)); }
    }
    .badge-bar {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 13px;
      letter-spacing: 5px;
      color: #38bdf8;
      text-transform: uppercase;
      margin-top: 12px;
      opacity: 0.9;
    }
    .bottom-tag {
      position: absolute;
      bottom: 24px;
      z-index: 10;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 11px;
      color: #64748b;
      letter-spacing: 2px;
      background: rgba(15, 23, 42, 0.6);
      padding: 6px 18px;
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
  </style>
</head>
<body>
  <div id="canvas-container"></div>

  <div class="kinetic-center">
    <div class="glitch-text">${customText}</div>
    <div class="badge-bar">Hyper-Dimensional Kinetic Matrix</div>
  </div>

  <div class="bottom-tag">2030 NEURAL ENGINE • MOVE MOUSE FOR 3D PARALLAX</div>

  <script>
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 30;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // ── 3D Wave Grid of Floating Neon Spheres ──
    const rows = 24;
    const cols = 24;
    const count = rows * cols;
    const geo = new THREE.SphereGeometry(0.18, 12, 12);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.8 });
    const instMesh = new THREE.InstancedMesh(geo, mat, count);

    const dummy = new THREE.Object3D();
    let idx = 0;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const x = (i - rows / 2) * 2.2;
        const y = (j - cols / 2) * 2.2;
        dummy.position.set(x, y, 0);
        dummy.updateMatrix();
        instMesh.setMatrixAt(idx++, dummy.matrix);
      }
    }
    scene.add(instMesh);

    // Mouse Tracking
    let mouseX = 0, mouseY = 0;
    let curX = 0, curY = 0;
    window.addEventListener('mousemove', (e) => {
      mouseX = (e.clientX - window.innerWidth / 2) * 0.001;
      mouseY = (e.clientY - window.innerHeight / 2) * 0.001;
    });

    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Animate grid wave
      let id = 0;
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          const x = (i - rows / 2) * 2.2;
          const y = (j - cols / 2) * 2.2;
          const dist = Math.sqrt(x * x + y * y);
          const z = Math.sin(dist * 0.4 - time * 2.5) * 2.5;

          dummy.position.set(x, y, z);
          dummy.scale.setScalar(1.0 + Math.sin(time * 3 + dist) * 0.3);
          dummy.updateMatrix();
          instMesh.setMatrixAt(id++, dummy.matrix);
        }
      }
      instMesh.instanceMatrix.needsUpdate = true;

      // Parallax
      curX += (mouseX - curX) * 0.08;
      curY += (mouseY - curY) * 0.08;
      camera.position.x = curX * 15;
      camera.position.y = -curY * 15;
      camera.lookAt(0, 0, 0);

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

  return `${intro}\n\n\`\`\`html\n${code}\n\`\`\`\n\n*Aap upar **Run Animation** ya **Canvas** par click karke is 2030 Kinetic 3D Typography ko live dekh sakte hain.*`;
}

function generate3DCyberHighway(lang = 'hinglish') {
  const intro = (lang === 'hindi')
    ? '🛣️ **Cyberpunk Endless Highway 3D Simulation** तैयार है! इसमें 60 FPS हाई-स्पीड मोशन, प्रोसीजरल 3D बिल्डिंग्स, FogExp2 और OrbitControls शामिल हैं:'
    : (lang === 'english')
    ? '🛣️ **Cyberpunk Endless Highway 3D Simulation** is ready! Features 60 FPS forward movement, procedural 3D building blocks, Three.js FogExp2, and driver OrbitControls:'
    : '🛣️ **Cyberpunk Endless Highway 3D Simulation** ready hai! Isme 60 FPS high-speed endless forward runner simulation, dark road with glowing magenta/cyan neon grid lines, procedural 3D building blocks with varying heights, Three.js FogExp2 dark void fade, aur driver\'s perspective OrbitControls integrate kiya gaya hai:';

  const code = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cyberpunk Endless Highway 3D</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Space+Grotesk:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; user-select: none; }
    body {
      background: #020208;
      color: #f8fafc;
      font-family: 'Space Grotesk', -apple-system, sans-serif;
      overflow: hidden;
      width: 100vw;
      height: 100vh;
    }
    #canvas-container { position: absolute; inset: 0; z-index: 1; }
    .cyber-hud {
      position: absolute;
      top: 20px;
      left: 20px;
      z-index: 10;
      background: rgba(10, 14, 26, 0.82);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      border: 1px solid rgba(255, 0, 127, 0.45);
      border-radius: 16px;
      padding: 16px 20px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.85), 0 0 25px rgba(255, 0, 127, 0.2);
      max-width: 360px;
    }
    .hud-title {
      font-family: 'Orbitron', monospace;
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 1px;
      color: #00f0ff;
      text-shadow: 0 0 12px rgba(0, 240, 255, 0.7);
      margin-bottom: 6px;
    }
    .hud-subtitle {
      font-size: 12px;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
      font-weight: 600;
    }
    .hud-action {
      font-size: 11px;
      color: #94a3b8;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 12px;
    }
    .hud-divider {
      height: 1px;
      background: linear-gradient(90deg, rgba(0, 240, 255, 0.4), rgba(255, 0, 127, 0.4), transparent);
      margin-bottom: 12px;
    }
    .control-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #94a3b8;
      margin-bottom: 10px;
    }
    .control-row input[type="range"] {
      width: 140px;
      accent-color: #00f0ff;
      cursor: pointer;
    }
    .btn-row {
      display: flex;
      gap: 8px;
    }
    .cyber-btn {
      flex: 1;
      padding: 7px 10px;
      border-radius: 8px;
      font-size: 10px;
      font-family: 'Orbitron', monospace;
      font-weight: 700;
      cursor: pointer;
      border: 1px solid rgba(0, 240, 255, 0.4);
      background: linear-gradient(135deg, rgba(0, 240, 255, 0.15), rgba(255, 0, 127, 0.15));
      color: #38bdf8;
      transition: all 0.2s;
    }
    .cyber-btn:hover {
      background: #00f0ff;
      color: #020208;
      box-shadow: 0 0 16px rgba(0, 240, 255, 0.6);
    }
    .speed-badge {
      position: absolute;
      bottom: 24px;
      right: 24px;
      z-index: 10;
      background: rgba(10, 14, 26, 0.8);
      backdrop-filter: blur(14px);
      border: 1px solid rgba(0, 240, 255, 0.35);
      border-radius: 12px;
      padding: 12px 18px;
      font-family: 'Orbitron', monospace;
      font-size: 11px;
      color: #94a3b8;
    }
    .speed-badge .val {
      color: #ff007f;
      font-weight: 800;
      font-size: 14px;
      text-shadow: 0 0 10px rgba(255, 0, 127, 0.7);
    }
  </style>
</head>
<body>
  <div id="canvas-container"></div>
  <div class="cyber-hud">
    <div class="hud-title">Cyberpunk Highway</div>
    <div class="hud-subtitle">⚡ Endless Runner Simulation at 60 FPS</div>
    <div class="hud-action">🖱️ Drag to look around (Driver's / Drone View)</div>
    <div class="hud-divider"></div>
    <div class="control-row">
      <span>Warp Speed: <strong id="speed-text" style="color:#00f0ff">1.0x</strong></span>
      <input type="range" id="speed-range" min="0.2" max="3.5" step="0.1" value="1.0">
    </div>
    <div class="btn-row">
      <button class="cyber-btn" id="btn-view">Switch View</button>
      <button class="cyber-btn" id="btn-wireframe">Wireframe</button>
      <button class="cyber-btn" id="btn-pause">Pause</button>
    </div>
  </div>

  <div class="speed-badge">
    VELOCITY: <span class="val" id="vel-disp">280 KM/H</span><br>
    FPS: <span class="val" style="color:#00f0ff" id="fps-disp">60</span>
  </div>

  <script>
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020208);
    // Three.js FogExp2 for atmospheric fade into the obsidian void
    scene.fog = new THREE.FogExp2(0x020208, 0.012);

    // Camera setup - driver perspective
    const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.8, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    container.appendChild(renderer.domElement);

    // OrbitControls for driver/drone free inspection
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 2.0, -40);
    controls.maxPolarAngle = Math.PI / 2 + 0.05;

    // Lighting
    scene.add(new THREE.AmbientLight(0x0f172a, 1.2));
    const cyanLight = new THREE.DirectionalLight(0x00f0ff, 2.0);
    cyanLight.position.set(-30, 40, -50);
    scene.add(cyanLight);

    const magentaLight = new THREE.DirectionalLight(0xff007f, 2.0);
    magentaLight.position.set(30, 40, -50);
    scene.add(magentaLight);

    // Dark Road stretching into the distance
    const roadWidth = 26;
    const roadLength = 700;
    const roadGeo = new THREE.PlaneGeometry(roadWidth, roadLength, 1, 1);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x050510,
      roughness: 0.25,
      metalness: 0.85
    });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -roadLength / 2 + 30);
    scene.add(road);

    // Glowing Magenta Road Borders
    const borderMat = new THREE.MeshBasicMaterial({ color: 0xff007f });
    const leftBorder = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, roadLength), borderMat);
    leftBorder.position.set(-roadWidth / 2, 0.15, -roadLength / 2 + 30);
    scene.add(leftBorder);

    const rightBorder = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, roadLength), borderMat);
    rightBorder.position.set(roadWidth / 2, 0.15, -roadLength / 2 + 30);
    scene.add(rightBorder);

    // Glowing Neon Road Grid lines
    const gridHelper = new THREE.GridHelper(roadLength, 100, 0xff007f, 0x00f0ff);
    gridHelper.position.set(0, 0.06, -roadLength / 2 + 30);
    gridHelper.scale.set(roadWidth / roadLength, 1, 1);
    scene.add(gridHelper);

    // Procedural 3D Building Blocks (cubes of varying heights along both sides)
    const buildings = [];
    const buildingCount = 80;
    const wireMatCyan = new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true });
    const wireMatMagenta = new THREE.MeshBasicMaterial({ color: 0xff007f, wireframe: true });
    const solidMat = new THREE.MeshStandardMaterial({
      color: 0x030712,
      roughness: 0.15,
      metalness: 0.95
    });

    for (let i = 0; i < buildingCount; i++) {
      const isLeft = i % 2 === 0;
      const w = 7 + Math.random() * 9;
      const h = 14 + Math.random() * 60;
      const d = 7 + Math.random() * 12;
      const geo = new THREE.BoxGeometry(w, h, d);

      const bGroup = new THREE.Group();
      const solidMesh = new THREE.Mesh(geo, solidMat);
      const wireMesh = new THREE.Mesh(geo, (i % 3 === 0) ? wireMatMagenta : wireMatCyan);
      bGroup.add(solidMesh);
      bGroup.add(wireMesh);

      const xOffset = isLeft ? (-17 - Math.random() * 32) : (17 + Math.random() * 32);
      const zOffset = -Math.random() * 600;
      bGroup.position.set(xOffset, h / 2, zOffset);
      bGroup.userData = { initialX: xOffset, height: h, solidMesh, wireMesh };

      scene.add(bGroup);
      buildings.push(bGroup);
    }

    // Interactive State
    let speed = 1.0;
    let paused = false;
    let wireOnly = false;
    let viewMode = 0; // 0: Driver, 1: Cockpit, 2: High Drone

    document.getElementById('speed-range').addEventListener('input', (e) => {
      speed = parseFloat(e.target.value);
      document.getElementById('speed-text').innerText = speed.toFixed(1) + 'x';
      document.getElementById('vel-disp').innerText = Math.round(280 * speed) + ' KM/H';
    });

    document.getElementById('btn-pause').addEventListener('click', () => {
      paused = !paused;
      document.getElementById('btn-pause').innerText = paused ? 'Resume' : 'Pause';
    });

    document.getElementById('btn-wireframe').addEventListener('click', () => {
      wireOnly = !wireOnly;
      buildings.forEach(b => {
        b.userData.solidMesh.visible = !wireOnly;
      });
      document.getElementById('btn-wireframe').innerText = wireOnly ? 'Solid' : 'Wireframe';
    });

    document.getElementById('btn-view').addEventListener('click', () => {
      viewMode = (viewMode + 1) % 3;
      if (viewMode === 0) {
        // Driver's perspective
        camera.position.set(0, 1.8, 6);
        controls.target.set(0, 2.0, -40);
      } else if (viewMode === 1) {
        // Cockpit low ground
        camera.position.set(0, 1.0, 2);
        controls.target.set(0, 1.2, -60);
      } else {
        // Drone high angle
        camera.position.set(0, 28, 45);
        controls.target.set(0, 6, -50);
      }
    });

    // 60 FPS Animation loop: animate road & move buildings backward
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsTimer = 0;

    function animate(now = 0) {
      requestAnimationFrame(animate);
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      frameCount++;
      fpsTimer += delta;
      if (fpsTimer >= 1.0) {
        document.getElementById('fps-disp').innerText = Math.round(frameCount / fpsTimer);
        frameCount = 0;
        fpsTimer = 0;
      }

      if (!paused) {
        const moveDelta = speed * 150 * delta;

        // Move procedural building blocks backward to simulate high-speed forward movement
        buildings.forEach(b => {
          b.position.z += moveDelta;
          if (b.position.z > camera.position.z + 25) {
            // Recycle building back into the deep fog horizon
            b.position.z -= 620;
            const newH = 14 + Math.random() * 60;
            b.scale.y = newH / b.userData.height;
            b.position.y = newH / 2;
          }
        });

        // Grid cycle for infinite road feel
        gridHelper.position.z = ((gridHelper.position.z + moveDelta) % 7) - roadLength / 2 + 30;
      }

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

  return `${intro}\n\n\`\`\`html\n${code}\n\`\`\`\n\n*Aap upar **Run Animation** ya **Canvas** par click karke is 60 FPS Cyberpunk Highway Simulation ko live dekh sakte hain.*`;
}

function generate3DCyberVehicle(lang = 'hinglish') {
  const intro = (lang === 'hindi')
    ? '⚡ **2030 Cyber Roadster 3D Simulation** तैयार है! इसमें रियलिस्टिक व्हील रोटेशन, नियॉन ग्रिड, पार्टिकल एग्जॉस्ट और इंटरैक्टिव कंट्रोल्स शामिल हैं:'
    : (lang === 'english')
    ? '⚡ **2030 Cyber Roadster 3D Simulation** is ready! Features spinning wheels, neon cyber grid, particle exhaust, and interactive HUD:'
    : '⚡ **2030 Cyber Roadster 3D Simulation** ready hai! Isme realistic spinning wheels, infinite neon cyber grid, dynamic exhaust particle trails, aur interactive Glassmorphic HUD integrate kiya gaya hai:';

  const code = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>2030 Cyberpunk 3D Vehicle Simulation</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Space+Grotesk:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; user-select:none; }
    body { background:#030712; color:#f8fafc; font-family:'Space Grotesk',sans-serif; overflow:hidden; width:100vw; height:100vh; }
    #canvas-container { position:absolute; inset:0; z-index:1; }
    .cyber-hud {
      position:absolute; top:20px; left:20px; z-index:10;
      background:rgba(10,15,29,0.75); backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px);
      border:1px solid rgba(56,189,248,0.3); border-radius:16px; padding:16px 20px;
      box-shadow:0 16px 40px rgba(0,0,0,0.8),0 0 25px rgba(56,189,248,0.2); max-width:320px;
    }
    .hud-title {
      font-family:'Orbitron',monospace; font-size:13px; font-weight:800; letter-spacing:1.5px;
      background:linear-gradient(135deg,#38bdf8,#818cf8,#f43f5e); -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      text-transform:uppercase; margin-bottom:10px; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.1);
    }
    .control-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:12px; color:#94a3b8; }
    .control-row input[type="range"] { width:120px; accent-color:#38bdf8; cursor:pointer; }
    .btn-row { display:flex; gap:8px; margin-top:10px; }
    .cyber-btn {
      flex:1; padding:7px 10px; border-radius:8px; font-size:11px; font-family:'Orbitron',monospace;
      font-weight:700; cursor:pointer; border:1px solid rgba(56,189,248,0.4);
      background:linear-gradient(135deg,rgba(14,165,233,0.25),rgba(129,140,248,0.2)); color:#38bdf8;
      transition:all 0.2s;
    }
    .cyber-btn:hover { background:#0284c7; color:#fff; box-shadow:0 0 16px rgba(56,189,248,0.6); }
    .telemetry {
      position:absolute; bottom:20px; right:20px; z-index:10;
      background:rgba(10,15,29,0.75); backdrop-filter:blur(16px);
      border:1px solid rgba(129,140,248,0.3); border-radius:12px;
      padding:12px 16px; font-family:'Orbitron',monospace; font-size:11px; color:#94a3b8;
    }
    .telemetry span.val { color:#38bdf8; font-weight:700; }
  </style>
</head>
<body>
  <div id="canvas-container"></div>
  <div class="cyber-hud">
    <div class="hud-title">⚡ Cyber Roadster 3D</div>
    <div class="control-row">
      <span>Speed</span>
      <input type="range" id="speed-range" min="0" max="3" step="0.1" value="1">
    </div>
    <div class="control-row">
      <span>Neon Glow</span>
      <input type="range" id="glow-range" min="0.5" max="3" step="0.1" value="1.5">
    </div>
    <div class="btn-row">
      <button class="cyber-btn" id="btn-wireframe">Wireframe</button>
      <button class="cyber-btn" id="btn-headlights">Headlights</button>
    </div>
  </div>
  <div class="telemetry">
    <div>VELOCITY: <span class="val" id="vel-readout">240 KM/H</span></div>
    <div>RPM: <span class="val" id="rpm-readout">8,200</span></div>
  </div>
  <script>
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030712, 0.015);

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(12, 8, 16);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;

    // Ambient & Studio Lights
    scene.add(new THREE.AmbientLight(0x1e293b, 1.2));
    const dirLight = new THREE.DirectionalLight(0x38bdf8, 2.5);
    dirLight.position.set(15, 25, 15);
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0xf43f5e, 2.0);
    rimLight.position.set(-15, 10, -15);
    scene.add(rimLight);

    // Infinite Neon Grid Ground
    const gridHelper = new THREE.GridHelper(200, 80, 0x00f0ff, 0x1e293b);
    gridHelper.position.y = -1.2;
    scene.add(gridHelper);

    // Car Compound Group
    const car = new THREE.Group();

    // Body Chassis
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.15, metalness: 0.9 });
    const bodyGeo = new THREE.BoxGeometry(4.6, 1.0, 8.2);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.6;
    car.add(bodyMesh);

    // Cabin Glass
    const cabinMat = new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, roughness: 0.05, transmission: 0.9, thickness: 0.8 });
    const cabinGeo = new THREE.BoxGeometry(3.6, 0.9, 4.2);
    const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
    cabinMesh.position.set(0, 1.45, -0.4);
    car.add(cabinMesh);

    // Neon Accent Strips
    const neonMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const neonStrips = [
      new THREE.BoxGeometry(4.7, 0.08, 8.3),
      new THREE.BoxGeometry(3.7, 0.08, 4.3)
    ];
    const n1 = new THREE.Mesh(neonStrips[0], neonMat);
    n1.position.y = 0.4;
    car.add(n1);

    // Wheels
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4, metalness: 0.8 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x006688, roughness: 0.2 });
    const wheels = [];
    const wheelPositions = [
      [-2.4, 0.1, 2.6], [2.4, 0.1, 2.6],
      [-2.4, 0.1, -2.6], [2.4, 0.1, -2.6]
    ];
    wheelPositions.forEach(([x, y, z]) => {
      const wGroup = new THREE.Group();
      wGroup.position.set(x, y, z);
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.7, 24), wheelMat);
      tire.rotation.z = Math.PI / 2;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.75, 12), rimMat);
      rim.rotation.z = Math.PI / 2;
      wGroup.add(tire);
      wGroup.add(rim);
      car.add(wGroup);
      wheels.push(wGroup);
    });

    // Headlights
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const h1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.2), headMat);
    h1.position.set(-1.6, 0.8, 4.15);
    const h2 = h1.clone();
    h2.position.x = 1.6;
    car.add(h1);
    car.add(h2);

    const headLightLeft = new THREE.SpotLight(0x38bdf8, 4.0, 40, Math.PI / 6, 0.5);
    headLightLeft.position.set(-1.6, 0.8, 4.15);
    headLightLeft.target.position.set(-1.6, 0, 30);
    scene.add(headLightLeft);
    scene.add(headLightLeft.target);

    // Particle Exhaust Trail
    const particleCount = 200;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVels = [];
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 1.5;
      particlePositions[i * 3 + 1] = 0.3 + Math.random() * 0.4;
      particlePositions[i * 3 + 2] = -4.2 - Math.random() * 2;
      particleVels.push({ x: (Math.random() - 0.5) * 0.05, y: (Math.random() - 0.5) * 0.03, z: -0.3 - Math.random() * 0.3 });
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({ color: 0x00f0ff, size: 0.4, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    scene.add(car);

    let speed = 1.0;
    let wireframe = false;
    let lightsOn = true;

    document.getElementById('speed-range').addEventListener('input', (e) => {
      speed = parseFloat(e.target.value);
      document.getElementById('vel-readout').innerText = Math.round(240 * speed) + ' KM/H';
      document.getElementById('rpm-readout').innerText = (Math.round(8200 * speed)).toLocaleString();
    });
    document.getElementById('glow-range').addEventListener('input', (e) => {
      neonMat.color.setHSL(0.52, 1, Math.min(1, parseFloat(e.target.value) * 0.35));
    });
    document.getElementById('btn-wireframe').addEventListener('click', () => {
      wireframe = !wireframe;
      bodyMat.wireframe = wireframe;
      cabinMat.wireframe = wireframe;
    });
    document.getElementById('btn-headlights').addEventListener('click', () => {
      lightsOn = !lightsOn;
      headLightLeft.intensity = lightsOn ? 4.0 : 0;
      h1.visible = lightsOn;
      h2.visible = lightsOn;
    });

    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();

      wheels.forEach(w => {
        w.children[0].rotation.x += speed * 0.3;
        w.children[1].rotation.x += speed * 0.3;
      });

      gridHelper.position.z = (gridHelper.position.z + speed * 0.6) % 2.5;

      const pos = particleGeo.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        pos[i * 3 + 2] += particleVels[i].z * speed;
        if (pos[i * 3 + 2] < -35) {
          pos[i * 3] = (Math.random() - 0.5) * 1.5;
          pos[i * 3 + 1] = 0.3 + Math.random() * 0.4;
          pos[i * 3 + 2] = -4.2;
        }
      }
      particleGeo.attributes.position.needsUpdate = true;

      car.position.y = Math.sin(clock.getElapsedTime() * 8 * speed) * 0.04;

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

  return `${intro}\n\n\`\`\`html\n${code}\n\`\`\``;
}

function generate3DDnaHelix(lang = 'hinglish') {
  const intro = (lang === 'hindi')
    ? '🧬 **3D DNA Double Helix & Molecular Simulation** तैयार है! इसमें 60+ बेस पेयर्स (A-T, G-C), फ्लोटिंग पार्टिकल्स और इंटरैक्टिव कंट्रोल्स शामिल हैं:'
    : (lang === 'english')
    ? '🧬 **3D DNA Double Helix & Molecular Simulation** is ready! Features 60+ base pairs (A-T, G-C), cellular particles, and interactive OrbitControls:'
    : '🧬 **3D DNA Double Helix & Molecular Simulation** ready hai! Isme color-coded A-T, G-C base pairs, helical backbone twist, glowing ambient particles, aur interactive HUD integrate kiya gaya hai:';

  const code = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>3D DNA Double Helix & Molecular Simulation</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Space+Grotesk:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; user-select:none; }
    body { background:#020617; color:#f8fafc; font-family:'Space Grotesk',sans-serif; overflow:hidden; width:100vw; height:100vh; }
    #canvas-container { position:absolute; inset:0; z-index:1; }
    .cyber-hud {
      position:absolute; top:20px; left:20px; z-index:10;
      background:rgba(10,15,29,0.75); backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px);
      border:1px solid rgba(139,92,246,0.3); border-radius:16px; padding:16px 20px;
      box-shadow:0 16px 40px rgba(0,0,0,0.8),0 0 25px rgba(139,92,246,0.2); max-width:320px;
    }
    .hud-title {
      font-family:'Orbitron',monospace; font-size:13px; font-weight:800; letter-spacing:1.5px;
      background:linear-gradient(135deg,#a855f7,#38bdf8,#34d399); -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      text-transform:uppercase; margin-bottom:10px; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.1);
    }
    .legend { display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:11px; margin-bottom:12px; }
    .legend-item { display:flex; align-items:center; gap:6px; }
    .dot { width:8px; height:8px; border-radius:50%; }
    .control-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:12px; color:#94a3b8; }
    .control-row input[type="range"] { width:120px; accent-color:#a855f7; cursor:pointer; }
    .btn-row { display:flex; gap:8px; margin-top:10px; }
    .cyber-btn {
      flex:1; padding:7px 10px; border-radius:8px; font-size:11px; font-family:'Orbitron',monospace;
      font-weight:700; cursor:pointer; border:1px solid rgba(139,92,246,0.4);
      background:linear-gradient(135deg,rgba(168,85,247,0.25),rgba(56,189,248,0.2)); color:#c084fc;
      transition:all 0.2s;
    }
    .cyber-btn:hover { background:#7e22ce; color:#fff; box-shadow:0 0 16px rgba(168,85,247,0.6); }
  </style>
</head>
<body>
  <div id="canvas-container"></div>
  <div class="cyber-hud">
    <div class="hud-title">🧬 DNA Double Helix 3D</div>
    <div class="legend">
      <div class="legend-item"><div class="dot" style="background:#f43f5e"></div> Adenine (A)</div>
      <div class="legend-item"><div class="dot" style="background:#38bdf8"></div> Thymine (T)</div>
      <div class="legend-item"><div class="dot" style="background:#34d399"></div> Guanine (G)</div>
      <div class="legend-item"><div class="dot" style="background:#fbbf24"></div> Cytosine (C)</div>
    </div>
    <div class="control-row">
      <span>Rotation Speed</span>
      <input type="range" id="speed-range" min="0" max="3" step="0.1" value="1">
    </div>
    <div class="btn-row">
      <button class="cyber-btn" id="btn-glow">Toggle Glow</button>
      <button class="cyber-btn" id="btn-reset">Reset Cam</button>
    </div>
  </div>
  <script>
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 10, 35);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Lighting
    scene.add(new THREE.AmbientLight(0x0f172a, 1.5));
    const pLight1 = new THREE.PointLight(0xa855f7, 3, 60);
    pLight1.position.set(15, 20, 15);
    scene.add(pLight1);
    const pLight2 = new THREE.PointLight(0x38bdf8, 3, 60);
    pLight2.position.set(-15, -20, -15);
    scene.add(pLight2);

    // DNA Helix Construction
    const helixGroup = new THREE.Group();
    const basePairsCount = 60;
    const radius = 4.5;
    const heightStep = 0.7;
    const twist = 0.28;

    const sphereGeo = new THREE.SphereGeometry(0.55, 24, 24);
    const strandMat1 = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.2, metalness: 0.8 });
    const strandMat2 = new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.2, metalness: 0.8 });

    for (let i = 0; i < basePairsCount; i++) {
      const y = (i - basePairsCount / 2) * heightStep;
      const angle = i * twist;

      const x1 = Math.cos(angle) * radius;
      const z1 = Math.sin(angle) * radius;
      const x2 = Math.cos(angle + Math.PI) * radius;
      const z2 = Math.sin(angle + Math.PI) * radius;

      // Backbone Nodes
      const node1 = new THREE.Mesh(sphereGeo, strandMat1);
      node1.position.set(x1, y, z1);
      helixGroup.add(node1);

      const node2 = new THREE.Mesh(sphereGeo, strandMat2);
      node2.position.set(x2, y, z2);
      helixGroup.add(node2);

      // Connecting Base Pair Rod
      const midPoint = new THREE.Vector3((x1 + x2) / 2, y, (z1 + z2) / 2);
      const v1 = new THREE.Vector3(x1, y, z1);
      const v2 = new THREE.Vector3(x2, y, z2);

      const pairType = i % 2 === 0;
      const cA = pairType ? 0xf43f5e : 0x34d399; // A or G
      const cB = pairType ? 0x38bdf8 : 0xfbbf24; // T or C

      const halfRungGeo = new THREE.CylinderGeometry(0.16, 0.16, radius, 12);
      const m1 = new THREE.Mesh(halfRungGeo, new THREE.MeshStandardMaterial({ color: cA, roughness: 0.3, metalness: 0.5 }));
      const m2 = new THREE.Mesh(halfRungGeo, new THREE.MeshStandardMaterial({ color: cB, roughness: 0.3, metalness: 0.5 }));

      m1.position.lerpVectors(v1, midPoint, 0.5);
      m1.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v1.clone().sub(v2).normalize());
      m2.position.lerpVectors(midPoint, v2, 0.5);
      m2.quaternion.copy(m1.quaternion);

      helixGroup.add(m1);
      helixGroup.add(m2);
    }

    scene.add(helixGroup);

    // Floating Cellular Particles
    const pCount = 500;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i += 3) {
      pPos[i] = (Math.random() - 0.5) * 50;
      pPos[i + 1] = (Math.random() - 0.5) * 60;
      pPos[i + 2] = (Math.random() - 0.5) * 50;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ size: 0.25, color: 0x38bdf8, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
    scene.add(new THREE.Points(pGeo, pMat));

    let rotSpeed = 1.0;
    document.getElementById('speed-range').addEventListener('input', (e) => { rotSpeed = parseFloat(e.target.value); });
    document.getElementById('btn-reset').addEventListener('click', () => { camera.position.set(0, 10, 35); controls.target.set(0,0,0); });

    function animate() {
      requestAnimationFrame(animate);
      helixGroup.rotation.y += 0.012 * rotSpeed;
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

  return `${intro}\n\n\`\`\`html\n${code}\n\`\`\``;
}

function generate3DCyberCity(lang = 'hinglish') {
  const intro = (lang === 'hindi')
    ? '🏙️ **Neo-Tokyo 2030 Cyber City Simulation** तैयार है! इसमें प्रोसीजरल स्काईस्क्रेपर्स, फ्लाइंग ट्रैफिक और वॉल्यूमेट्रिक फॉग शामिल हैं:'
    : (lang === 'english')
    ? '🏙️ **Neo-Tokyo 2030 Cyber City Simulation** is ready! Features procedural skyscrapers, flying cyber traffic, and atmospheric fog:'
    : '🏙️ **Neo-Tokyo 2030 Cyber City Simulation** ready hai! Isme procedural neon skyscrapers, animated flying cyber traffic streams, atmospheric fog, aur interactive camera controls integrate kiye gaye hain:';

  const code = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Neo-Tokyo 2030 Cyber City</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Space+Grotesk:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; user-select:none; }
    body { background:#02040a; color:#f8fafc; font-family:'Space Grotesk',sans-serif; overflow:hidden; width:100vw; height:100vh; }
    #canvas-container { position:absolute; inset:0; z-index:1; }
    .cyber-hud {
      position:absolute; top:20px; left:20px; z-index:10;
      background:rgba(10,15,29,0.75); backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px);
      border:1px solid rgba(56,189,248,0.3); border-radius:16px; padding:16px 20px;
      box-shadow:0 16px 40px rgba(0,0,0,0.8); max-width:320px;
    }
    .hud-title {
      font-family:'Orbitron',monospace; font-size:13px; font-weight:800; letter-spacing:1.5px;
      background:linear-gradient(135deg,#00f0ff,#a855f7,#f43f5e); -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      text-transform:uppercase; margin-bottom:10px; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.1);
    }
    .control-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:12px; color:#94a3b8; }
    .control-row input[type="range"] { width:120px; accent-color:#00f0ff; cursor:pointer; }
  </style>
</head>
<body>
  <div id="canvas-container"></div>
  <div class="cyber-hud">
    <div class="hud-title">🏙️ Neo-Tokyo 2030 City</div>
    <div class="control-row">
      <span>Traffic Speed</span>
      <input type="range" id="speed-range" min="0.2" max="3" step="0.1" value="1">
    </div>
    <div class="control-row">
      <span>Fog Density</span>
      <input type="range" id="fog-range" min="0.005" max="0.03" step="0.005" value="0.012">
    </div>
  </div>
  <script>
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x02040a, 0.012);

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(40, 28, 55);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;

    // Lighting
    scene.add(new THREE.AmbientLight(0x0a1026, 1.8));
    const moon = new THREE.DirectionalLight(0x38bdf8, 2.0);
    moon.position.set(50, 80, 50);
    scene.add(moon);

    // City Ground Grid
    const ground = new THREE.GridHelper(200, 60, 0x00f0ff, 0x1e293b);
    scene.add(ground);

    // Procedural Skyscrapers
    const buildingMat = new THREE.MeshStandardMaterial({ color: 0x080f1e, roughness: 0.3, metalness: 0.8 });
    const windowColors = [0x00f0ff, 0xa855f7, 0xf43f5e, 0xfbbf24];

    const gridSize = 7;
    const spacing = 10;
    for (let x = -gridSize; x <= gridSize; x++) {
      for (let z = -gridSize; z <= gridSize; z++) {
        if (Math.abs(x) < 1 && Math.abs(z) < 1) continue;
        const h = 6 + Math.random() * 28;
        const bGeo = new THREE.BoxGeometry(4.5, h, 4.5);
        const bMesh = new THREE.Mesh(bGeo, buildingMat);
        bMesh.position.set(x * spacing, h / 2, z * spacing);
        scene.add(bMesh);

        // Neon Roof Beacon
        const beaconGeo = new THREE.SphereGeometry(0.35, 12, 12);
        const beaconMat = new THREE.MeshBasicMaterial({ color: windowColors[Math.floor(Math.random() * windowColors.length)] });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.set(x * spacing, h + 0.5, z * spacing);
        scene.add(beacon);
      }
    }

    // Flying Cyber Traffic Streams
    const carCount = 120;
    const cars = [];
    for (let i = 0; i < carCount; i++) {
      const cGeo = new THREE.BoxGeometry(0.4, 0.2, 1.2);
      const isRed = Math.random() > 0.5;
      const cMat = new THREE.MeshBasicMaterial({ color: isRed ? 0xf43f5e : 0x00f0ff });
      const cMesh = new THREE.Mesh(cGeo, cMat);
      const isXAxis = Math.random() > 0.5;
      cMesh.position.set(
        isXAxis ? (Math.random() - 0.5) * 120 : (Math.floor((Math.random() - 0.5) * 10) * 10),
        2 + Math.random() * 12,
        isXAxis ? (Math.floor((Math.random() - 0.5) * 10) * 10) : (Math.random() - 0.5) * 120
      );
      scene.add(cMesh);
      cars.push({ mesh: cMesh, isXAxis, speed: (0.2 + Math.random() * 0.4) * (Math.random() > 0.5 ? 1 : -1) });
    }

    let trafficSpeed = 1.0;
    document.getElementById('speed-range').addEventListener('input', (e) => { trafficSpeed = parseFloat(e.target.value); });
    document.getElementById('fog-range').addEventListener('input', (e) => { scene.fog.density = parseFloat(e.target.value); });

    function animate() {
      requestAnimationFrame(animate);
      cars.forEach(c => {
        if (c.isXAxis) {
          c.mesh.position.x += c.speed * trafficSpeed;
          if (c.mesh.position.x > 70) c.mesh.position.x = -70;
          if (c.mesh.position.x < -70) c.mesh.position.x = 70;
        } else {
          c.mesh.position.z += c.speed * trafficSpeed;
          if (c.mesh.position.z > 70) c.mesh.position.z = -70;
          if (c.mesh.position.z < -70) c.mesh.position.z = 70;
        }
      });
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

  return `${intro}\n\n\`\`\`html\n${code}\n\`\`\``;
}

function generate3DQuantumPolyhedron(lang = 'hinglish') {
  const intro = (lang === 'hindi')
    ? '💎 **3D Quantum Crystal Polyhedron Simulation** तैयार है! इसमें नेस्टेड जियोमेट्री, पल्सेटिंग एनर्जी कोर और रिफ्रैक्टिव मटेरियल्स शामिल हैं:'
    : (lang === 'english')
    ? '💎 **3D Quantum Crystal Polyhedron Simulation** is ready! Features nested geometry, pulsating energy core, and refractive materials:'
    : '💎 **3D Quantum Crystal Polyhedron Simulation** ready hai! Isme nested icosahedron/dodecahedron geometry, pulsating energy core, quantum particles, aur interactive HUD integrate kiya gaya hai:';

  const code = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>3D Quantum Crystal Polyhedron Simulation</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Space+Grotesk:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; user-select:none; }
    body { background:#030712; color:#f8fafc; font-family:'Space Grotesk',sans-serif; overflow:hidden; width:100vw; height:100vh; }
    #canvas-container { position:absolute; inset:0; z-index:1; }
    .cyber-hud {
      position:absolute; top:20px; left:20px; z-index:10;
      background:rgba(10,15,29,0.75); backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px);
      border:1px solid rgba(56,189,248,0.3); border-radius:16px; padding:16px 20px;
      box-shadow:0 16px 40px rgba(0,0,0,0.8),0 0 25px rgba(56,189,248,0.2); max-width:320px;
    }
    .hud-title {
      font-family:'Orbitron',monospace; font-size:13px; font-weight:800; letter-spacing:1.5px;
      background:linear-gradient(135deg,#38bdf8,#818cf8,#c084fc); -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      text-transform:uppercase; margin-bottom:10px; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.1);
    }
    .control-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:12px; color:#94a3b8; }
    .control-row input[type="range"] { width:120px; accent-color:#38bdf8; cursor:pointer; }
    .btn-row { display:flex; gap:8px; margin-top:10px; }
    .cyber-btn {
      flex:1; padding:7px 10px; border-radius:8px; font-size:11px; font-family:'Orbitron',monospace;
      font-weight:700; cursor:pointer; border:1px solid rgba(56,189,248,0.4);
      background:linear-gradient(135deg,rgba(14,165,233,0.25),rgba(129,140,248,0.2)); color:#38bdf8;
      transition:all 0.2s;
    }
    .cyber-btn:hover { background:#0284c7; color:#fff; box-shadow:0 0 16px rgba(56,189,248,0.6); }
  </style>
</head>
<body>
  <div id="canvas-container"></div>
  <div class="cyber-hud">
    <div class="hud-title">💎 Quantum Polyhedron 3D</div>
    <div class="control-row">
      <span>Pulse Speed</span>
      <input type="range" id="pulse-range" min="0.2" max="3" step="0.1" value="1">
    </div>
    <div class="control-row">
      <span>Core Glow</span>
      <input type="range" id="glow-range" min="0.5" max="3" step="0.1" value="1.5">
    </div>
    <div class="btn-row">
      <button class="cyber-btn" id="btn-wire">Toggle Wire</button>
      <button class="cyber-btn" id="btn-reset">Reset</button>
    </div>
  </div>
  <script>
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030712, 0.015);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 22);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Lighting
    scene.add(new THREE.AmbientLight(0x0f172a, 1.2));
    const pLight1 = new THREE.PointLight(0x00f0ff, 3, 50);
    pLight1.position.set(12, 15, 12);
    scene.add(pLight1);
    const pLight2 = new THREE.PointLight(0xf43f5e, 3, 50);
    pLight2.position.set(-12, -15, -12);
    scene.add(pLight2);

    // Quantum Group
    const crystalGroup = new THREE.Group();

    // Outer Icosahedron Wireframe
    const outerGeo = new THREE.IcosahedronGeometry(6, 1);
    const outerMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, wireframe: true, roughness: 0.2, metalness: 0.9 });
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    crystalGroup.add(outerMesh);

    // Mid Translucent Dodecahedron
    const midGeo = new THREE.DodecahedronGeometry(3.8, 0);
    const midMat = new THREE.MeshPhysicalMaterial({ color: 0xa855f7, transparent: true, opacity: 0.6, roughness: 0.1, transmission: 0.8, thickness: 1.2 });
    const midMesh = new THREE.Mesh(midGeo, midMat);
    crystalGroup.add(midMesh);

    // Inner Glowing Core Sphere
    const coreGeo = new THREE.SphereGeometry(1.6, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    crystalGroup.add(coreMesh);

    scene.add(crystalGroup);

    // Quantum Particle Field
    const pCount = 800;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i += 3) {
      const r = 8 + Math.random() * 12;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      pPos[i] = r * Math.sin(phi) * Math.cos(theta);
      pPos[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      pPos[i + 2] = r * Math.cos(phi);
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ size: 0.3, color: 0x818cf8, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    let speed = 1.0;
    let isWire = true;
    document.getElementById('pulse-range').addEventListener('input', (e) => { speed = parseFloat(e.target.value); });
    document.getElementById('btn-wire').addEventListener('click', () => { isWire = !isWire; outerMat.wireframe = isWire; });
    document.getElementById('btn-reset').addEventListener('click', () => { camera.position.set(0, 5, 22); controls.target.set(0,0,0); });

    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      const t = clock.getElapsedTime() * speed;

      outerMesh.rotation.x = t * 0.2;
      outerMesh.rotation.y = t * 0.3;

      midMesh.rotation.x = -t * 0.4;
      midMesh.rotation.z = t * 0.25;

      const s = 1.0 + Math.sin(t * 3.5) * 0.15;
      coreMesh.scale.setScalar(s);

      particles.rotation.y = t * 0.05;

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

  return `${intro}\n\n\`\`\`html\n${code}\n\`\`\``;
}

// ── Master 2030 Router: Selects or Generates the ideal 2030 Ultra-HD experience ──
function generateFuturistic2030Animation(userMessage = '', lang = 'hinglish') {
  const text = (userMessage || '').toLowerCase();

  // 1. Cyberpunk Highway / Endless Road / Runner (Direct Match for User's Prompt)
  if (/(?:highway|endless highway|dark road|cyberpunk highway|road|procedural highway|runner|street|tunnel)/i.test(text)) {
    return generate3DCyberHighway(lang);
  }

  // 2. DNA / Genetics / Biology / Molecular Double Helix
  if (/(?:dna|gene|helix|double helix|genetic|chromosome|molecule|molecular|biology|cellular)/i.test(text)) {
    return generate3DDnaHelix(lang);
  }

  // 3. Vehicles / Cars / Hovercraft / Racing
  if (/(?:car|vehicle|automobile|truck|supercar|race|racing|drift|cyberpunk car|hovercar|motorcycle|bike)/i.test(text)) {
    return generate3DCyberVehicle(lang);
  }

  // 4. Cyber City / Architecture / Skyline
  if (/(?:city|skyline|skyscraper|building|architecture|urban|cyberpunk city|neo tokyo|metropolis)/i.test(text)) {
    return generate3DCyberCity(lang);
  }

  // 5. Crystal / Quantum Polyhedron / Abstract Geometry
  if (/(?:crystal|polyhedron|quantum|geometric|geometry|cube|tesseract|icosahedron|dodecahedron|abstract 3d)/i.test(text)) {
    return generate3DQuantumPolyhedron(lang);
  }

  // 6. 3D Earth Simulation
  if (/(?:earth|3d earth|globe|planet earth|continents|atmosphere)/i.test(text)) {
    return generate3DEarthSimulation(lang);
  }

  // 7. Gravity & N-Body Simulation
  if (/(?:gravity|n-body|orbit simulation|kepler|gravity physics|physics engine)/i.test(text)) {
    return generateGravitySimulation(lang);
  }

  // 8. Sorting Algorithm Visualizer
  if (/(?:sorting|sort visualizer|bubble sort|quick sort|algorithm visualizer)/i.test(text)) {
    return generateSortingVisualizer(lang);
  }

  // 9. Neural Network Synapse Visualizer
  if (/(?:neural|neural network|synapse|deep learning visualizer|perceptron)/i.test(text)) {
    return generateNeuralNetworkSimulation(lang);
  }

  // 10. Interactive Periodic Table
  if (/(?:periodic table|elements|chemistry|atom|electron shell)/i.test(text)) {
    return generatePeriodicTableSimulation(lang);
  }

  // 11. Game intent
  if (/(?:game|play|space ship|ship|dodge|tron)/i.test(text)) {
    return generateFuturisticGame(lang);
  }

  // 12. Logo / Brand / Product intent
  if (/(?:logo|brand|reveal|identity|badge|emblem|company|startup)/i.test(text)) {
    const brandMatch = userMessage.match(/(?:logo|brand|for)\s+([a-zA-Z0-9_\- ]+)/i);
    const brandName = brandMatch ? brandMatch[1].trim().toUpperCase() : 'AI-DOST 2030';
    return generateFuturisticLogoReveal(brandName, lang);
  }

  // 13. Text / Font / Kinetic Typography intent (STRICT: texture, textures, material are strictly excluded)
  if (!/(?:texture|textures|material|materials|context)/i.test(text) && /(?:\btext\b|\bfont\b|\btypography\b|\bkinetic text\b|\bkinetic typography\b|\bword art\b|\btitle animation\b)/i.test(text)) {
    const textMatch = userMessage.match(/(?:\btext\b|\bfont\b|\bwrite\b|\bsay\b|\bnaam\b)\s*[:=]?\s*['"]?([^'"]+)['"]?/i);
    const label = textMatch ? textMatch[1].trim().toUpperCase() : 'NEURAL 2030';
    return generateFuturisticTypography(label, lang);
  }

  // 14. Solar System (only when explicitly requested)
  if (/(?:solar system|planets|kepler|sun|mars|jupiter|saturn|neptune|mercury|venus|uranus)/i.test(text)) {
    return generateThreeJsSolarSystem(lang);
  }

  // Default: Versatile 3D Quantum Polyhedron instead of Solar System
  return generate3DQuantumPolyhedron(lang);
}

module.exports = {
  THREEJS_WEBGL_SYSTEM_DIRECTIVE,
  generateThreeJsSolarSystem,
  generate3DEarthSimulation,
  generateGravitySimulation,
  generateSortingVisualizer,
  generateNeuralNetworkSimulation,
  generatePeriodicTableSimulation,
  generateFuturisticLogoReveal,
  generateFuturisticGame,
  generateFuturisticTypography,
  generate3DCyberHighway,
  generate3DCyberVehicle,
  generate3DDnaHelix,
  generate3DCyberCity,
  generate3DQuantumPolyhedron,
  generateFuturistic2030Animation
};
