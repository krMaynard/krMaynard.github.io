import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const canvases = document.querySelectorAll("[data-webgl-hero] .webgl-hero__canvas");

canvases.forEach((canvas) => {
    const host = canvas.closest("[data-webgl-hero]");
    const mode = host.dataset.webglHero || "blog";
    const isProfile = mode === "profile";
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    const group = new THREE.Group();
    const points = new THREE.Group();
    const profileRings = [];
    let profileCore = null;
    let frameId = 0;

    camera.position.set(0, 0, isProfile ? 6.8 : 8.8);
    scene.add(group, points);

    const primary = mode === "transparency" ? 0x4ec1b1 : 0x2a9d8f;
    const secondary = isProfile ? 0xf4a261 : mode === "transparency" ? 0x85d7cf : 0x6ed3c4;
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

    if (isProfile) {
      profileCore = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.62, 1),
        new THREE.MeshBasicMaterial({ color: primary })
      );
      group.add(profileCore);

      [0, Math.PI / 3, -Math.PI / 3].forEach((rotation, index) => {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(1.22 + index * 0.15, 0.028, 8, 80),
          new THREE.MeshBasicMaterial({
            color: index === 1 ? secondary : 0xb9d8d3,
            transparent: true,
            opacity: index === 1 ? 0.9 : 0.72
          })
        );
        ring.rotation.x = rotation;
        ring.rotation.y = Math.PI / 4;
        profileRings.push(ring);
        group.add(ring);
      });
    } else {
      group.add(wire, inner);
    }

    const dotGeometry = new THREE.SphereGeometry(0.026, 8, 8);
    const dotMaterial = new THREE.MeshBasicMaterial({ color: secondary, transparent: true, opacity: 0.55 });
    const dotCount = isProfile ? 0 : 46;
    for (let i = 0; i < dotCount; i += 1) {
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);
      const radius = isProfile ? 1.9 + Math.random() * 0.5 : 2.9 + Math.random() * 1.9;
      const angle = Math.random() * Math.PI * 2;
      const z = (Math.random() - 0.5) * (isProfile ? 1.5 : 2.7);
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
      group.position.x = isProfile ? 0 : width > 760 ? width / height * 0.94 : 0.65;
      group.position.y = isProfile ? 0 : width > 760 ? 0.05 : 0.15;
      group.scale.setScalar(isProfile ? 1 : width > 760 ? 1 : 0.78);
    };

    const draw = (time) => {
      const t = time * 0.001;
      group.rotation.x = Math.sin(t * 0.35) * (isProfile ? 0.04 : 0.12);
      group.rotation.y = isProfile ? Math.sin(t * 0.3) * 0.08 : t * 0.18;
      inner.rotation.x = t * 0.42;
      inner.rotation.z = t * 0.22;
      if (profileCore) {
        profileCore.rotation.x = t * 0.35;
        profileCore.rotation.y = t * 0.5;
      }
      profileRings.forEach((ring, index) => {
        ring.rotation.z = t * (0.1 + index * 0.03);
      });
      points.children.forEach((dot) => {
        dot.userData.angle += dot.userData.speed;
        dot.position.x = Math.cos(dot.userData.angle) * dot.userData.radius;
        dot.position.y = Math.sin(dot.userData.angle) * dot.userData.radius * 0.72;
      });
      renderer.render(scene, camera);
    };

    const render = (time) => {
      draw(time);
      frameId = window.requestAnimationFrame(render);
    };

    const updateMotion = () => {
      if (reduceMotion.matches) {
        if (frameId) window.cancelAnimationFrame(frameId);
        frameId = window.requestAnimationFrame((time) => {
          draw(time);
          frameId = 0;
        });
      } else if (!frameId) {
        frameId = window.requestAnimationFrame(render);
      }
    };

    const handleResize = () => {
      resize();
      if (reduceMotion.matches) window.requestAnimationFrame(draw);
    };

    try {
      resize();
      host.classList.add("is-webgl-ready");
      updateMotion();
      window.addEventListener("resize", handleResize, { passive: true });
      reduceMotion.addEventListener("change", updateMotion);
    } catch (error) {
      host.classList.remove("is-webgl-ready");
    }
});
