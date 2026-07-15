"use client";

// 3D vlající vlajka (three.js). Látka je fixní podél tunelu (levá hrana + oblouk nahoře),
// vlnění roste směrem k volným okrajům. Při změně tvaru/barvy vlajka dostane poryv větru.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { FlagShape } from "@/lib/types";
import { drawFlagCanvas, type FlagTextureOptions } from "@/lib/flagShapes";

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  varying vec2 vUv;
  varying float vShade;

  float wave(vec2 uv, float t) {
    float yDown = 1.0 - uv.y;
    float stiff = pow(uv.x, 1.08) * pow(yDown, 0.85);
    float ph = (uv.x * 1.7 + yDown * 0.9) * 6.4 - t;
    float w = sin(ph) * 0.68 + sin(ph * 1.83 + 1.7) * 0.32;
    return w * stiff;
  }

  void main() {
    vUv = uv;
    float t = uTime;
    float z = wave(uv, t) * uAmp;
    float e = 0.012;
    float dzdx = (wave(uv + vec2(e, 0.0), t) - wave(uv - vec2(e, 0.0), t)) / (2.0 * e) * uAmp;
    float dzdy = (wave(uv + vec2(0.0, e), t) - wave(uv - vec2(0.0, e), t)) / (2.0 * e) * uAmp;
    vec3 n = normalize(vec3(-dzdx * 0.55, -dzdy * 0.55, 1.0));
    vec3 light = normalize(vec3(0.45, 0.35, 0.83));
    vShade = 0.62 + 0.5 * max(dot(n, light), 0.0);
    vec3 p = position + vec3(0.0, 0.0, z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uTex;
  varying vec2 vUv;
  varying float vShade;

  void main() {
    vec4 texel = texture2D(uTex, vUv);
    if (texel.a < 0.08) discard;
    gl_FragColor = vec4(texel.rgb * vShade, texel.a);
  }
`;

export type FlagWaveProps = {
  shape: FlagShape;
  color?: string;
  hs?: boolean;
  sleeveColor?: "black" | "white";
  logoSrc?: string;
  drawDesign?: FlagTextureOptions["drawDesign"];
  /** klidová síla větru 0–1 */
  wind?: number;
  /** zvýšit vítr při najetí myší */
  interactive?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

export default function FlagWave({
  shape,
  color = "#c9ccd1",
  hs = false,
  sleeveColor = "black",
  logoSrc,
  drawDesign,
  wind = 0.35,
  interactive = true,
  className,
  style,
}: FlagWaveProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer?: THREE.WebGLRenderer;
    mesh?: THREE.Mesh;
    material?: THREE.ShaderMaterial;
    texture?: THREE.CanvasTexture;
    texCanvas?: HTMLCanvasElement;
    texAspect: number;
    fitMesh?: () => void;
    gust: number;
    hover: number;
    wind: number;
    mounted: boolean;
  }>({ gust: 0, hover: 0, wind, mounted: false, texAspect: 0.3 });

  useEffect(() => {
    stateRef.current.wind = wind;
  }, [wind]);

  // init three
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const st = stateRef.current;
    st.mounted = true;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      return; // bez WebGL nic nekreslíme, náhled zajistí okolní UI
    }
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 10);
    camera.position.set(0.12, 0.02, 2.6);
    camera.lookAt(0, 0, 0);

    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uAmp: { value: 0.05 },
        uTex: { value: null },
      },
    });
    const geometry = new THREE.PlaneGeometry(1, 1, 72, 120);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.y = -0.14;
    scene.add(mesh);

    st.renderer = renderer;
    st.mesh = mesh;
    st.material = material;

    // vlajka se musí vždy celá vejít do záběru kamery
    const fitMesh = () => {
      const dist = camera.position.z;
      const visH = 2 * dist * Math.tan((camera.fov * Math.PI) / 360);
      const visW = visH * camera.aspect;
      const texAspect = st.texAspect;
      const H = Math.min(visH * 0.94, (visW * 0.9) / texAspect);
      mesh.scale.set(H * texAspect, H, 1);
    };
    st.fitMesh = fitMesh;

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      fitMesh();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(host);

    const onEnter = () => { st.hover = 1; };
    const onLeave = () => { st.hover = 0; };
    if (interactive) {
      host.addEventListener("pointerenter", onEnter);
      host.addEventListener("pointerleave", onLeave);
    }

    let raf = 0;
    let t = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || !st.material) { last = now; return; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      st.gust *= Math.pow(0.32, dt);
      const strength = Math.min(1.4, st.wind + st.hover * 0.45 + st.gust);
      const speed = 2.2 + 3.6 * strength;
      t += dt * speed;
      st.material.uniforms.uTime.value = t;
      st.material.uniforms.uAmp.value = 0.02 + 0.13 * strength;
      if (st.mesh) st.mesh.rotation.y = -0.14 + Math.sin(t * 0.31) * 0.03;
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      st.mounted = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      if (interactive) {
        host.removeEventListener("pointerenter", onEnter);
        host.removeEventListener("pointerleave", onLeave);
      }
      geometry.dispose();
      material.dispose();
      st.texture?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [interactive]);

  // (pře)kreslení textury při změně tvaru/barvy/loga + poryv větru
  useEffect(() => {
    const st = stateRef.current;
    if (!st.material) return;
    let cancelled = false;

    const apply = (logo: HTMLImageElement | null) => {
      if (cancelled || !st.material || !st.mesh) return;
      st.texCanvas = drawFlagCanvas({ shape, color, hs, sleeveColor, logo, drawDesign }, st.texCanvas);
      st.texture?.dispose();
      const tex = new THREE.CanvasTexture(st.texCanvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      st.texture = tex;
      st.material.uniforms.uTex.value = tex;
      st.texAspect = st.texCanvas.width / st.texCanvas.height;
      st.fitMesh?.();
      st.gust = 1;
    };

    if (logoSrc) {
      const img = new Image();
      img.onload = () => apply(img);
      img.onerror = () => apply(null);
      img.src = logoSrc;
    } else {
      apply(null);
    }
    return () => { cancelled = true; };
  }, [shape, color, hs, sleeveColor, logoSrc, drawDesign]);

  return <div ref={hostRef} className={className} style={{ width: "100%", height: "100%", ...style }} aria-hidden="true" />;
}
