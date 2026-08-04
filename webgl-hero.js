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
    const signalNodes = [];
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
      const tealMaterial = new THREE.MeshBasicMaterial({ color: primary });
      const amberMaterial = new THREE.MeshBasicMaterial({ color: secondary });
      const segments = [
        [[-1.35, -1.3], [-1.35, 1.3]],
        [[-1.35, 0], [-0.2, 1.3]],
        [[-1.35, 0], [-0.2, -1.3]],
        [[0.15, -1.3], [0.15, 1.3]],
        [[0.15, 1.3], [0.85, 0.25]],
        [[0.85, 0.25], [1.55, 1.3]],
        [[1.55, 1.3], [1.55, -1.3]]
      ];

      segments.forEach(([from, to], index) => {
        const start = new THREE.Vector3(from[0], from[1], 0);
        const end = new THREE.Vector3(to[0], to[1], 0);
        const midpoint = start.clone().add(end).multiplyScalar(0.5);
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.035, start.distanceTo(end), 8),
          index === 4 || index === 5 ? amberMaterial : tealMaterial
        );
        beam.position.copy(midpoint);
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
        group.add(beam);
      });

      const anchors = [
        [-1.35, 1.3], [-1.35, 0], [-1.35, -1.3], [-0.2, 1.3], [-0.2, -1.3],
        [0.15, 1.3], [0.15, -1.3], [0.85, 0.25], [1.55, 1.3], [1.55, -1.3]
      ];
      anchors.forEach(([x, y], index) => {
        const node = new THREE.Mesh(
          new THREE.SphereGeometry(index === 7 ? 0.11 : 0.075, 12, 12),
          index === 7 ? amberMaterial : tealMaterial
        );
        node.position.set(x, y, 0.03);
        group.add(node);
      });

      [0, 2, 4, 6].forEach((segmentIndex, index) => {
        const [from, to] = segments[segmentIndex];
        const node = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 12), amberMaterial);
        signalNodes.push({
          node,
          from: new THREE.Vector3(from[0], from[1], 0.08),
          to: new THREE.Vector3(to[0], to[1], 0.08),
          phase: index / 4
        });
        group.add(node);
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
      group.rotation.x = Math.sin(t * 0.35) * (isProfile ? 0.05 : 0.12);
      group.rotation.y = isProfile ? Math.sin(t * 0.3) * 0.12 : t * 0.18;
      inner.rotation.x = t * 0.42;
      inner.rotation.z = t * 0.22;
      signalNodes.forEach(({ node, from, to, phase }) => {
        const progress = (t * 0.22 + phase) % 1;
        node.position.lerpVectors(from, to, progress);
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
