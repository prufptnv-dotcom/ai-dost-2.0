import React, { useEffect, useRef } from 'react';

export default function ThreeHeroCanvas() {
  const mountRef = useRef(null);

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    let animId;
    let cleanupFn = () => {};

    const initScene = (THREE) => {
      if (!currentMount) return;
      const width = currentMount.clientWidth || 500;
      const height = currentMount.clientHeight || 360;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
      camera.position.z = 24;

      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        currentMount.innerHTML = '';
        currentMount.appendChild(renderer.domElement);
      } catch (e) {
        init2DFallback();
        return;
      }

      // DNA / Bio-Particle Wave Geometry
      const particleCount = 260;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);

      const color1 = new THREE.Color(0x0ea5e9);
      const color2 = new THREE.Color(0x14b8a6);
      const color3 = new THREE.Color(0x818cf8);

      for (let i = 0; i < particleCount; i++) {
        const t = (i / particleCount) * Math.PI * 8;
        const strand = i % 2 === 0 ? 1 : -1;
        const radius = 3.6;

        const x = Math.sin(t) * radius * strand;
        const y = (i / particleCount) * 16 - 8;
        const z = Math.cos(t) * radius * strand;

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        const mixed = color1.clone().lerp(strand > 0 ? color2 : color3, (i / particleCount));
        colors[i * 3] = mixed.r;
        colors[i * 3 + 1] = mixed.g;
        colors[i * 3 + 2] = mixed.b;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const pMaterial = new THREE.PointsMaterial({
        size: 0.4,
        vertexColors: true,
        transparent: true,
        opacity: 0.95
      });

      const particles = new THREE.Points(geometry, pMaterial);
      scene.add(particles);

      // Connecting Lines
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.3
      });

      const lineGeo = new THREE.BufferGeometry();
      const linePositions = new Float32Array((particleCount / 2) * 6);
      let lineIdx = 0;
      for (let i = 0; i < particleCount - 1; i += 2) {
        linePositions[lineIdx++] = positions[i * 3];
        linePositions[lineIdx++] = positions[i * 3 + 1];
        linePositions[lineIdx++] = positions[i * 3 + 2];
        linePositions[lineIdx++] = positions[(i + 1) * 3];
        linePositions[lineIdx++] = positions[(i + 1) * 3 + 1];
        linePositions[lineIdx++] = positions[(i + 1) * 3 + 2];
      }
      lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
      const lines = new THREE.LineSegments(lineGeo, lineMaterial);
      scene.add(lines);

      // Central core
      const sphereGeo = new THREE.IcosahedronGeometry(2.4, 2);
      const sphereMat = new THREE.MeshBasicMaterial({
        color: 0x0ea5e9,
        wireframe: true,
        transparent: true,
        opacity: 0.2
      });
      const coreSphere = new THREE.Mesh(sphereGeo, sphereMat);
      scene.add(coreSphere);

      // Interactive mouse follow
      let mouseX = 0, mouseY = 0, targetX = 0, targetY = 0;
      const onMouseMove = (e) => {
        if (!currentMount) return;
        const rect = currentMount.getBoundingClientRect();
        mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      };
      window.addEventListener('mousemove', onMouseMove);

      const onResize = () => {
        if (!currentMount || !renderer) return;
        const w = currentMount.clientWidth || 500;
        const h = currentMount.clientHeight || 360;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener('resize', onResize);

      let clock = new THREE.Clock();
      const renderLoop = () => {
        animId = requestAnimationFrame(renderLoop);
        const elapsed = clock.getElapsedTime();

        targetX += (mouseX - targetX) * 0.05;
        targetY += (mouseY - targetY) * 0.05;

        particles.rotation.y = elapsed * 0.45 + targetX * 0.4;
        particles.rotation.x = Math.sin(elapsed * 0.25) * 0.15 + targetY * 0.2;
        lines.rotation.y = particles.rotation.y;
        lines.rotation.x = particles.rotation.x;

        coreSphere.rotation.y = -elapsed * 0.3;
        const scale = 1 + Math.sin(elapsed * 2.5) * 0.07;
        coreSphere.scale.set(scale, scale, scale);

        renderer.render(scene, camera);
      };
      renderLoop();

      cleanupFn = () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('resize', onResize);
        if (renderer && renderer.domElement && currentMount.contains(renderer.domElement)) {
          currentMount.removeChild(renderer.domElement);
          renderer.dispose();
        }
        geometry.dispose();
        pMaterial.dispose();
        lineGeo.dispose();
        lineMaterial.dispose();
        sphereGeo.dispose();
        sphereMat.dispose();
      };
    };

    const init2DFallback = () => {
      if (!currentMount) return;
      currentMount.innerHTML = '';
      const canvas = document.createElement('canvas');
      canvas.width = currentMount.clientWidth || 500;
      canvas.height = currentMount.clientHeight || 360;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      currentMount.appendChild(canvas);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let tick = 0;
      const draw2D = () => {
        animId = requestAnimationFrame(draw2D);
        tick += 0.03;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const count = 30;
        for (let i = 0; i < count; i++) {
          const x = (canvas.width / count) * i;
          const y1 = canvas.height / 2 + Math.sin(tick + i * 0.3) * 50;
          const y2 = canvas.height / 2 - Math.sin(tick + i * 0.3) * 50;

          ctx.fillStyle = i % 2 === 0 ? '#0ea5e9' : '#14b8a6';
          ctx.beginPath();
          ctx.arc(x, y1, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#818cf8';
          ctx.beginPath();
          ctx.arc(x, y2, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = 'rgba(14, 165, 233, 0.25)';
          ctx.beginPath();
          ctx.moveTo(x, y1);
          ctx.lineTo(x, y2);
          ctx.stroke();
        }
      };
      draw2D();

      cleanupFn = () => {
        cancelAnimationFrame(animId);
        if (currentMount.contains(canvas)) currentMount.removeChild(canvas);
      };
    };

    // Load Three.js
    if (typeof window !== 'undefined' && window.THREE) {
      initScene(window.THREE);
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      script.async = true;
      script.onload = () => {
        if (window.THREE) initScene(window.THREE);
        else init2DFallback();
      };
      script.onerror = () => init2DFallback();
      document.head.appendChild(script);
    }

    return () => cleanupFn();
  }, []);

  return (
    <div 
      ref={mountRef} 
      data-testid="three-hero-canvas"
      aria-label="Interactive 3D Medical DNA Visualization"
      role="img"
      style={{
        width: '100%',
        height: '100%',
        minHeight: '340px',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}
    />
  );
}
