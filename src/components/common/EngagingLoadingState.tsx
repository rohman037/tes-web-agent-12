import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import * as THREE from 'three';

export interface EngagingLoadingStep {
  title?: string;
  description?: string;
}

export interface EngagingLoadingStateProps {
  title?: string;
  subtitle?: string;
  steps?: string[];
  activeStep?: number;
  progress?: number; // 0 to 100
  estimatedSeconds?: number;
  icon?: any;
  tips?: string[];
  badgeText?: string;
  themeColor?: string; // default #5b50e5
  isDark?: boolean;
}

export const EngagingLoadingState: React.FC<EngagingLoadingStateProps> = ({
  progress,
  estimatedSeconds = 14,
  isDark = false
}) => {
  // Auto-progress simulation if progress is not strictly provided
  const [internalProgress, setInternalProgress] = useState(progress !== undefined ? progress : 12);
  const container3DRef = useRef<HTMLDivElement>(null);

  // Sync external progress or simulate progress smoothly
  useEffect(() => {
    if (progress !== undefined) {
      setInternalProgress(progress);
    }
  }, [progress]);

  // Internal auto-progress simulation if no external progress provided
  useEffect(() => {
    if (progress !== undefined) return;

    const intervalTime = Math.max(120, Math.floor((estimatedSeconds * 1000) / 92));
    const timer = setInterval(() => {
      setInternalProgress((prev) => {
        if (prev >= 96) return 96; // hold near 96% until parent completes
        const stepInc = Math.max(1, Math.floor((96 - prev) / 10));
        return prev + stepInc;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [progress, estimatedSeconds]);

  const currentProgress = progress !== undefined ? progress : internalProgress;

  // Arc math for the circular progress gauge
  // Radius = 42 -> Circumference = 2 * PI * 42 ≈ 263.89
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (currentProgress / 100) * circumference;
  // Angle for headlight tip: starting at -90deg (top)
  const angleRad = ((currentProgress / 100) * 360 - 90) * (Math.PI / 180);
  const tipX = 50 + radius * Math.cos(angleRad);
  const tipY = 50 + radius * Math.sin(angleRad);

  // Three.js 3D Neural Sphere & Atmospheric Floating Shapes
  useEffect(() => {
    const container = container3DRef.current;
    if (!container) return;

    let animId: number;
    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;

    try {
      const width = container.clientWidth || 600;
      const height = container.clientHeight || 450;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.z = 21;

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      container.appendChild(renderer.domElement);

      // Lighting setup
      const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
      scene.add(ambientLight);

      const dirLight1 = new THREE.DirectionalLight(0x00F2FE, 2.0); // Bright cyan key light
      dirLight1.position.set(15, 20, 15);
      scene.add(dirLight1);

      const dirLight2 = new THREE.DirectionalLight(0xD8B4FE, 2.2); // Pastel purple fill light
      dirLight2.position.set(-15, -10, 12);
      scene.add(dirLight2);

      const pointLight = new THREE.PointLight(0x38BDF8, 2.5, 30);
      pointLight.position.set(0, 0, 5);
      scene.add(pointLight);

      // Central Holographic Neural Sphere Group
      const centralGroup = new THREE.Group();
      scene.add(centralGroup);

      // 1. Holographic wireframe lattice sphere
      const wireGeo = new THREE.IcosahedronGeometry(4.7, 3);
      const wireMat = new THREE.MeshStandardMaterial({
        color: 0xC084FC,
        wireframe: true,
        transparent: true,
        opacity: 0.35,
        roughness: 0.2,
        metalness: 0.1
      });
      const wireMesh = new THREE.Mesh(wireGeo, wireMat);
      centralGroup.add(wireMesh);

      // 2. Synaptic Neural Nodes (Points on surface)
      const nodeCount = 130;
      const nodeCoords: THREE.Vector3[] = [];
      const nodeRadius = 4.75;
      for (let i = 0; i < nodeCount; i++) {
        const phi = Math.acos(-1 + (2 * i) / nodeCount);
        const theta = Math.sqrt(nodeCount * Math.PI) * phi;
        const x = nodeRadius * Math.cos(theta) * Math.sin(phi);
        const y = nodeRadius * Math.sin(theta) * Math.sin(phi);
        const z = nodeRadius * Math.cos(phi);
        nodeCoords.push(new THREE.Vector3(x, y, z));
      }
      const nodeGeo = new THREE.BufferGeometry().setFromPoints(nodeCoords);
      const nodeMat = new THREE.PointsMaterial({
        color: 0x00F2FE, // Bright cyan
        size: 0.28,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending
      });
      const nodePoints = new THREE.Points(nodeGeo, nodeMat);
      centralGroup.add(nodePoints);

      // 3. Synaptic dynamic lines between close nodes
      const linePoints: THREE.Vector3[] = [];
      const maxDist = 2.4;
      for (let i = 0; i < nodeCount; i++) {
        for (let j = i + 1; j < nodeCount; j++) {
          if (nodeCoords[i].distanceTo(nodeCoords[j]) < maxDist) {
            linePoints.push(nodeCoords[i]);
            linePoints.push(nodeCoords[j]);
          }
        }
      }
      const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x818CF8,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending
      });
      const synapticLines = new THREE.LineSegments(lineGeo, lineMat);
      centralGroup.add(synapticLines);

      // 4. Luminous inner nucleus core
      const coreGeo = new THREE.SphereGeometry(1.7, 32, 32);
      const coreMat = new THREE.MeshPhongMaterial({
        color: 0xE879F9,
        emissive: 0x9333EA,
        specular: 0x00F2FE,
        shininess: 90,
        transparent: true,
        opacity: 0.8
      });
      const nucleus = new THREE.Mesh(coreGeo, coreMat);
      centralGroup.add(nucleus);

      // 5. Floating 3D Geometric Shapes
      const shapesGroup = new THREE.Group();
      scene.add(shapesGroup);

      const matCyanGlass = new THREE.MeshPhysicalMaterial({
        color: 0x22D3EE,
        roughness: 0.15,
        transmission: 0.7,
        thickness: 1.2,
        transparent: true,
        opacity: 0.75,
        ior: 1.4
      });

      const matPurpleGlass = new THREE.MeshPhysicalMaterial({
        color: 0xC084FC,
        roughness: 0.2,
        transmission: 0.75,
        thickness: 1.2,
        transparent: true,
        opacity: 0.75,
        ior: 1.4
      });

      const geometries = [
        new THREE.OctahedronGeometry(0.75, 0),
        new THREE.TorusGeometry(0.7, 0.22, 16, 32),
        new THREE.TetrahedronGeometry(0.85, 0),
        new THREE.BoxGeometry(0.9, 0.9, 0.9),
        new THREE.IcosahedronGeometry(0.65, 0)
      ];

      const shapePositions = [
        { pos: [-8.5, 4.8, -2], rotSpeed: [0.015, 0.02, 0.01], mat: matCyanGlass },
        { pos: [8.8, 5.2, -1], rotSpeed: [0.012, -0.018, 0.014], mat: matPurpleGlass },
        { pos: [-9.2, -4.5, 1], rotSpeed: [-0.01, 0.015, 0.02], mat: matPurpleGlass },
        { pos: [9.0, -4.2, 0], rotSpeed: [0.018, 0.01, -0.015], mat: matCyanGlass },
        { pos: [-5.5, 7.8, -3], rotSpeed: [0.02, 0.012, 0.01], mat: matPurpleGlass },
        { pos: [6.2, -7.5, -2], rotSpeed: [-0.015, 0.02, 0.01], mat: matCyanGlass }
      ];

      interface FloatingItem {
        mesh: THREE.Mesh;
        initPos: THREE.Vector3;
        rotSpeed: number[];
        floatOffset: number;
      }

      const shapeList: FloatingItem[] = [];

      shapePositions.forEach((item, idx) => {
        const geo = geometries[idx % geometries.length];
        const mesh = new THREE.Mesh(geo, item.mat);
        mesh.position.set(item.pos[0], item.pos[1], item.pos[2]);
        shapesGroup.add(mesh);
        shapeList.push({
          mesh,
          initPos: new THREE.Vector3(...item.pos),
          rotSpeed: item.rotSpeed,
          floatOffset: idx * 1.1
        });
      });

      // Subtle floating particle micro-dust
      const dustCount = 200;
      const dustGeo = new THREE.BufferGeometry();
      const dustPositions = new Float32Array(dustCount * 3);
      for (let i = 0; i < dustCount * 3; i += 3) {
        dustPositions[i] = (Math.random() - 0.5) * 30;
        dustPositions[i + 1] = (Math.random() - 0.5) * 20;
        dustPositions[i + 2] = (Math.random() - 0.5) * 14;
      }
      dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
      const dustMat = new THREE.PointsMaterial({
        color: 0x38BDF8,
        size: 0.14,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending
      });
      const dustParticles = new THREE.Points(dustGeo, dustMat);
      scene.add(dustParticles);

      // Interactive subtle parallax
      let mouseX = 0;
      let mouseY = 0;
      let targetX = 0;
      let targetY = 0;

      const handleMouseMove = (e: MouseEvent) => {
        const halfX = window.innerWidth / 2;
        const halfY = window.innerHeight / 2;
        mouseX = (e.clientX - halfX) * 0.00035;
        mouseY = (e.clientY - halfY) * 0.00035;
      };

      window.addEventListener('mousemove', handleMouseMove);

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          const h = entry.contentRect.height;
          if (w > 0 && h > 0 && camera && renderer) {
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
          }
        }
      });
      resizeObserver.observe(container);

      // Animation Loop
      const clock = new THREE.Clock();

      const animate = () => {
        animId = requestAnimationFrame(animate);
        const elapsedTime = clock.getElapsedTime();

        // Central Holographic Breathing
        const pulse = 1.0 + Math.sin(elapsedTime * 2.0) * 0.035;
        wireMesh.scale.set(pulse, pulse, pulse);
        nodePoints.scale.set(pulse, pulse, pulse);
        synapticLines.scale.set(pulse, pulse, pulse);

        const corePulse = 1.0 + Math.cos(elapsedTime * 2.8) * 0.08;
        nucleus.scale.set(corePulse, corePulse, corePulse);

        // Gentle rotations
        centralGroup.rotation.y = elapsedTime * 0.22;
        centralGroup.rotation.x = Math.sin(elapsedTime * 0.35) * 0.12;

        // Floating geometric shapes
        shapeList.forEach(item => {
          item.mesh.rotation.x += item.rotSpeed[0];
          item.mesh.rotation.y += item.rotSpeed[1];
          item.mesh.rotation.z += item.rotSpeed[2];
          item.mesh.position.y = item.initPos.y + Math.sin(elapsedTime * 1.5 + item.floatOffset) * 0.4;
          item.mesh.position.x = item.initPos.x + Math.cos(elapsedTime * 1.2 + item.floatOffset) * 0.22;
        });

        dustParticles.rotation.y = elapsedTime * 0.025;
        dustParticles.rotation.x = -elapsedTime * 0.015;

        // Smooth camera parallax
        targetX += (mouseX - targetX) * 0.05;
        targetY += (mouseY - targetY) * 0.05;
        if (camera) {
          camera.position.x = targetX * 8;
          camera.position.y = -targetY * 8;
          camera.lookAt(0, 0, 0);
        }

        if (renderer && scene && camera) {
          renderer.render(scene, camera);
        }
      };

      animate();

      return () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('mousemove', handleMouseMove);
        resizeObserver.disconnect();
        if (renderer && renderer.domElement) {
          container.removeChild(renderer.domElement);
          renderer.dispose();
        }
      };
    } catch (err) {
      console.warn('WebGL initialization failed in EngagingLoadingState:', err);
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`studio-bg rounded-3xl p-6 sm:p-10 shadow-xl relative overflow-hidden text-slate-800 font-sans border border-slate-200/90 min-h-[500px] flex flex-col justify-between select-none ${
        isDark ? 'dark' : ''
      }`}
    >
      {/* Ambient Studio Lighting Gradients */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        {/* Top-left soft cyan studio lamp glow */}
        <div className="absolute -top-32 -left-32 w-[550px] h-[550px] rounded-full bg-gradient-to-br from-cyan-200/40 via-sky-200/20 to-transparent blur-3xl pointer-events-none" />
        {/* Bottom-right pastel purple warm studio bounce */}
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-gradient-to-tl from-purple-200/45 via-indigo-100/25 to-transparent blur-3xl pointer-events-none" />
        {/* Center soft radial illumination */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-white/70 blur-2xl pointer-events-none" />
      </div>

      {/* Persistent Interactive 3D Three.js Layer */}
      <div 
        ref={container3DRef}
        className="absolute inset-0 w-full h-full bg-transparent z-10 pointer-events-none"
      />

      {/* High-Fidelity Futuristic HUD Layer (Overlay) - Clean Minimalist 3D */}
      <div className="relative z-20 flex flex-col items-center justify-center h-full w-full max-w-4xl mx-auto pointer-events-none my-auto">
        
        {/* Center Hero HUD: Circular Translucent Glowing Progress Bar & Percentage */}
        <div className="relative flex flex-col items-center justify-center my-auto">
          
          {/* Glowing Ring Frame Container */}
          <div className="relative w-[300px] h-[300px] sm:w-[360px] sm:h-[360px] flex items-center justify-center">
            
            {/* Outer Dashed Decorative Gyro Ring */}
            <svg 
              className="absolute inset-0 w-full h-full animate-spin-reverse-slower pointer-events-none opacity-50" 
              viewBox="0 0 100 100"
            >
              <circle cx="50" cy="50" fill="none" opacity="0.6" r="48" stroke="#C084FC" strokeDasharray="2 6" strokeWidth="0.75" />
              <circle cx="50" cy="50" fill="none" opacity="0.8" r="45" stroke="#00F2FE" strokeDasharray="1 9" strokeWidth="0.5" />
              {/* Orbiting micro accent markers */}
              <circle cx="50" cy="2" fill="#00F2FE" r="1.5" />
              <circle cx="98" cy="50" fill="#A855F7" r="1.5" />
              <circle cx="50" cy="98" fill="#00F2FE" r="1.5" />
            </svg>

            {/* Main Translucent Glowing SVG Progress Bar Arc */}
            <svg 
              className="w-[260px] h-[260px] sm:w-[310px] sm:h-[310px] transform -rotate-90 pointer-events-none filter drop-shadow-[0_0_16px_rgba(0,242,254,0.45)]" 
              viewBox="0 0 100 100"
            >
              <defs>
                <linearGradient id="hudProgressGrad" x1="0%" x2="100%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="#C084FC" />
                  <stop offset="50%" stopColor="#818CF8" />
                  <stop offset="100%" stopColor="#00F2FE" />
                </linearGradient>
                <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Background track: subtle translucent glass ring */}
              <circle cx="50" cy="50" fill="none" r="42" stroke="rgba(255, 255, 255, 0.75)" strokeWidth="3.5" />
              <circle cx="50" cy="50" fill="none" r="42" stroke="rgba(148, 163, 184, 0.22)" strokeWidth="2.5" />

              {/* Active Glowing Progress Arc */}
              <circle 
                className="transition-all duration-700 ease-out" 
                cx="50" 
                cy="50" 
                fill="none" 
                filter="url(#softGlow)" 
                r="42" 
                stroke="url(#hudProgressGrad)" 
                strokeDasharray={`${(currentProgress / 100) * circumference} ${circumference}`}
                strokeLinecap="round" 
                strokeWidth="4.2" 
              />

              {/* Head Light Tip on the arc */}
              <circle 
                className="animate-pulse" 
                cx={tipX} 
                cy={tipY} 
                fill="#FFFFFF" 
                filter="drop-shadow(0 0 4px #00F2FE)" 
                r="2.8" 
              />
            </svg>

            {/* Inner Frosted Glass Disc with Large Elegant Percentage Text */}
            <div className="absolute w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] rounded-full glass-card flex flex-col items-center justify-center text-center p-5 shadow-2xl pointer-events-auto">
              {/* Large Elegant Percentage Typography */}
              <div className="flex items-baseline justify-center tracking-tighter my-0.5">
                <span className="text-5xl sm:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-[#1E1B4B] via-[#6366F1] to-[#0EA5E9] font-sans tracking-tight">
                  {Math.round(currentProgress)}
                </span>
                <span className="text-xl sm:text-2xl font-light text-slate-400 font-sans ml-0.5">%</span>
              </div>

              {/* Mini pulse indicator dots */}
              <div className="flex items-center gap-1.5 mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C084FC]" />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#00F2FE] animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              </div>
            </div>

          </div>

        </div>

      </div>
    </motion.div>
  );
};

export default EngagingLoadingState;
