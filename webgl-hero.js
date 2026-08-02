import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const canvases = document.querySelectorAll("[data-webgl-hero] .webgl-hero__canvas");

if (!reduceMotion.matches) {
  canvases.forEach((canvas) => {
    const host = canvas.closest("[data-webgl-hero]");
    const mode = host.dataset.webglHero || "blog";
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    const group = new THREE.Group();
    const points = new THREE.Group();
    let frameId = 0;

    camera.position.set(0, 0, 8.8);
    scene.add(group, points);

    const primary = mode === "transparency" ? 0x4ec1b1 : 0x2a9d8f;
    const secondary = mode === "transparency" ? 0x85d7cf : 0x6ed3c4;
    const wire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.2, 2),
      new THREE.MeshBasicMaterial({
        color: primary,
        wireframe: true,
        transparent: true,
        opacity: 0.24
      })
    );
    const inner = new THREE.Mesh(
      new THREE.TorusKnotGeometry(1.04, 0.035, 150, 12),
      new THREE.MeshBasicMaterial({
        color: secondary,
        transparent: true,
        opacity: 0.7
      })
    );

    group.add(wire, inner);

    const dotGeometry = new THREE.SphereGeometry(0.026, 8, 8);
    const dotMaterial = new THREE.MeshBasicMaterial({ color: secondary, transparent: true, opacity: 0.55 });
    for (let i = 0; i < 46; i += 1) {
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);
      const radius = 2.9 + Math.random() * 1.9;
      const angle = Math.random() * Math.PI * 2;
      const z = (Math.random() - 0.5) * 2.7;
      dot.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.72, z);
      dot.userData = { angle, radius, speed: 0.0015 + Math.random() * 0.002 };
      points.add(dot);
    }

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      group.position.x = width > 760 ? width / height * 0.94 : 0.65;
      group.position.y = width > 760 ? 0.05 : 0.15;
      group.scale.setScalar(width > 760 ? 1 : 0.78);
    };

    const render = (time) => {
      const t = time * 0.001;
      group.rotation.x = Math.sin(t * 0.35) * 0.12;
      group.rotation.y = t * 0.18;
      inner.rotation.x = t * 0.42;
      inner.rotation.z = t * 0.22;
      points.children.forEach((dot) => {
        dot.userData.angle += dot.userData.speed;
        dot.position.x = Math.cos(dot.userData.angle) * dot.userData.radius;
        dot.position.y = Math.sin(dot.userData.angle) * dot.userData.radius * 0.72;
      });
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(render);
    };

    try {
      resize();
      host.classList.add("is-webgl-ready");
      frameId = window.requestAnimationFrame(render);
      window.addEventListener("resize", resize, { passive: true });
      reduceMotion.addEventListener("change", () => {
        if (reduceMotion.matches && frameId) window.cancelAnimationFrame(frameId);
      }, { once: true });
    } catch (error) {
      host.classList.remove("is-webgl-ready");
    }
  });
}
