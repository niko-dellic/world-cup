"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LinearFilter,
  Line as ThreeLine,
  LineBasicMaterial,
  Mesh,
  Points,
  SRGBColorSpace,
  ShaderMaterial,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
} from "three";
import type { DisplayMatch, Team } from "@/lib/types";

type WorldCupSceneProps = {
  activeMatch: DisplayMatch | null;
};

const FLAG_BACKDROP_Z = -1.65;
const EXIT_ANIMATION_MS = 3000;

export function WorldCupScene({ activeMatch }: WorldCupSceneProps) {
  const [renderMatch, setRenderMatch] = useState<DisplayMatch | null>(activeMatch);
  const leftTeam = renderMatch?.displayHomeTeam ?? null;
  const rightTeam = renderMatch?.displayAwayTeam ?? null;
  const hasMatch = Boolean(leftTeam && rightTeam);
  const isActive = Boolean(activeMatch && renderMatch?.id === activeMatch.id);

  useEffect(() => {
    if (activeMatch) {
      setRenderMatch(activeMatch);
      return undefined;
    }

    if (!renderMatch) return undefined;

    const clearTimer = window.setTimeout(() => {
      setRenderMatch(null);
    }, EXIT_ANIMATION_MS);

    return () => window.clearTimeout(clearTimer);
  }, [activeMatch, renderMatch]);

  return (
    <div className="scene-layer" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={["#050507"]} />
        <SpeckleField />
        {hasMatch ? (
          <group key={`${renderMatch!.id}-${leftTeam!.id}-${rightTeam!.id}`}>
            <MassiveFlagBackdrop leftTeam={leftTeam!} rightTeam={rightTeam!} active={isActive} />
            <EnergyField intensity={isActive ? 1 : 0} />
            <ambientLight intensity={0.6} />
            <pointLight position={[-2.5, 1.8, 3]} intensity={8} color="#38bdf8" />
            <pointLight position={[2.5, -1.4, 3]} intensity={8} color="#67e8f9" />
            <SeamLightning active={isActive} />
            <ElectricArcs leftTeam={leftTeam!} rightTeam={rightTeam!} active={isActive} />
          </group>
        ) : null}
      </Canvas>
    </div>
  );
}

function EnergyField({ intensity }: { intensity: number }) {
  const materialRef = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: intensity },
    }),
    [],
  );

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uIntensity.value += (intensity - uniforms.uIntensity.value) * (intensity > 0 ? 0.08 : 0.04);
  });

  return (
    <mesh position={[0, 0, -2]} scale={[15, 9, 1]}>
      <planeGeometry args={[1, 1, 96, 96]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={energyVertexShader}
        fragmentShader={energyFragmentShader}
        side={DoubleSide}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

function MassiveFlagBackdrop({
  leftTeam,
  rightTeam,
  active,
}: {
  leftTeam: Team;
  rightTeam: Team;
  active: boolean;
}) {
  return (
    <group position={[0, 0, FLAG_BACKDROP_Z]}>
      <MassiveFlagPanel team={leftTeam} side="left" active={active} />
      <MassiveFlagPanel team={rightTeam} side="right" active={active} />
    </group>
  );
}

function MassiveFlagPanel({ team, side, active }: { team: Team; side: "left" | "right"; active: boolean }) {
  const meshRef = useRef<Group>(null);
  const materialRef = useRef<ShaderMaterial>(null);
  const progressRef = useRef(0);
  const texture = useFlagCoverTexture(team, side);
  const { camera, viewport } = useThree();
  const flagViewport = viewport.getCurrentViewport(camera, [0, 0, FLAG_BACKDROP_Z]);
  const direction = side === "left" ? -1 : 1;
  const height = flagViewport.height;
  const width = flagViewport.width * 0.5 + 0.08;
  const planeAspect = width / height;
  const uniforms = useMemo(
    () => ({
      uMap: { value: texture },
      uTime: { value: 0 },
      uSide: { value: direction },
      uProgress: { value: 0 },
      uRepeat: { value: new Vector2(1, 1) },
      uOffset: { value: new Vector2(0, 0) },
    }),
    [direction, texture],
  );

  useEffect(() => {
    applyCoverCrop(texture, planeAspect);
    uniforms.uMap.value = texture;
    uniforms.uRepeat.value.copy(texture.repeat);
    uniforms.uOffset.value.copy(texture.offset);
  }, [planeAspect, texture, uniforms]);

  useFrame(({ clock }, delta) => {
    if (!meshRef.current) return;
    const motion = active ? delta * 2.75 : -delta * 0.85;
    progressRef.current = Math.min(1, Math.max(0, progressRef.current + motion));
    const eased = easeSmooth(progressRef.current);
    const startX = direction * flagViewport.width * 0.86;
    const endX = direction * flagViewport.width * 0.25;
    meshRef.current.position.x = startX + (endX - startX) * eased;
    meshRef.current.position.y = (1 - eased) * direction * -0.38;
    meshRef.current.rotation.z = direction * (1 - eased) * 0.12;
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.elapsedTime;
      materialRef.current.uniforms.uProgress.value = eased;
      materialRef.current.uniforms.uRepeat.value.copy(texture.repeat);
      materialRef.current.uniforms.uOffset.value.copy(texture.offset);
    }
  });

  return (
    <group ref={meshRef} position={[direction * flagViewport.width * 0.86, 0, 0]}>
      <mesh scale={[width, height, 1]}>
        <planeGeometry args={[1, 1, 96, 48]} />
        <shaderMaterial
          ref={materialRef}
          uniforms={uniforms}
          vertexShader={flagVertexShader}
          fragmentShader={flagFragmentShader}
          transparent
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}

function SeamLightning({ active }: { active: boolean }) {
  const viewport = useThree((state) => state.viewport);
  const intensityRef = useRef(active ? 1 : 0.62);
  const lastFrameRef = useRef(-1);
  const lightning = useMemo(() => createLightningObjects(), []);

  useEffect(() => {
    return () => disposeLightningObjects(lightning);
  }, [lightning]);

  useFrame(({ clock }, delta) => {
    const time = clock.elapsedTime;
    const motion = getLightningMotion(time);
    const targetIntensity = active ? 1 : 0;
    const blend = active ? 1 - Math.pow(0.0008, delta) : 1 - Math.pow(0.02, delta);
    intensityRef.current += (targetIntensity - intensityRef.current) * blend;

    lightning.group.rotation.z = -0.2 + motion.shear * 0.16 + Math.sin(time * 3.7) * 0.018;
    lightning.group.position.x = motion.shear * 0.2;
    lightning.group.scale.setScalar(1 + motion.flash * 0.025);

    updateLightningRibbonMaterial(
      lightning.coreMaterial,
      (0.78 + motion.flash * 0.26) * intensityRef.current,
      time,
      motion.flash,
    );
    updateLightningRibbonMaterial(
      lightning.glowMaterial,
      (0.3 + motion.flash * 0.2) * intensityRef.current,
      time,
      motion.flash,
    );
    updateLightningRibbonMaterial(
      lightning.outerGlowMaterial,
      (0.18 + motion.flash * 0.14) * intensityRef.current,
      time,
      motion.flash,
    );

    const frame = Math.floor(time * 18);
    if (frame !== lastFrameRef.current) {
      lastFrameRef.current = frame;
      const frameData = createLightningFrame(time, viewport.width, viewport.height);
      replaceRibbonGeometry(lightning.outerGlowMesh, frameData.points, 0.66 + motion.flash * 0.22);
      replaceRibbonGeometry(lightning.glowMesh, frameData.points, 0.36 + motion.flash * 0.16);
      replaceRibbonGeometry(lightning.coreMesh, frameData.points, 0.12 + motion.flash * 0.045);

      lightning.branches.forEach((branch, index) => {
        const branchPoints = frameData.branches[index] ?? null;
        branch.line.visible = Boolean(branchPoints) && intensityRef.current > 0.04;
        branch.material.opacity = (branchPoints ? branchPoints.opacity : 0) * intensityRef.current;
        if (branchPoints) {
          replaceLineGeometry(branch.line, branchPoints.points);
        }
      });
    }
  });

  return <primitive object={lightning.group} />;
}

function ElectricArcs({
  leftTeam,
  rightTeam,
  active,
}: {
  leftTeam: Team;
  rightTeam: Team;
  active: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const lines = useMemo(
    () => createArcLines(active ? 11 : 5, leftTeam, rightTeam, active),
    [active, leftTeam, rightTeam],
  );

  useEffect(() => {
    return () => {
      lines.forEach((line) => {
        line.geometry.dispose();
        if (Array.isArray(line.material)) {
          line.material.forEach((material) => material.dispose());
        } else {
          line.material.dispose();
        }
      });
    };
  }, [lines]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.z = -0.34 + Math.sin(clock.elapsedTime * 1.8) * 0.04;
    groupRef.current.children.forEach((child, index) => {
      child.visible = Math.sin(clock.elapsedTime * 6 + index) > (active ? -0.35 : 0.35);
    });
  });

  return (
    <group ref={groupRef} position={[0, 0, 0.35]}>
      {lines.map((line, index) => (
        <primitive key={index} object={line} />
      ))}
    </group>
  );
}

function SpeckleField() {
  const pointsRef = useRef<Points>(null);
  const { geometry } = useMemo(() => createSpeckleGeometry(), []);

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.z = clock.elapsedTime * 0.015;
    pointsRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.25) * 0.08;
  });

  return (
    <points ref={pointsRef} geometry={geometry} position={[0, 0, -0.35]}>
      <pointsMaterial
        vertexColors
        size={0.035}
        transparent
        opacity={0.86}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

function useFlagCoverTexture(team: Team, side: "left" | "right"): Texture {
  const fallbackTexture = useMemo(() => createFallbackFlagTexture(team, side), [team, side]);
  const [texture, setTexture] = useState<Texture>(fallbackTexture);

  useEffect(() => {
    setTexture(fallbackTexture);
    if (!team.countryCode) return undefined;

    let cancelled = false;
    const loader = new TextureLoader();
    loader.setCrossOrigin("anonymous");
    const url = `https://flagcdn.com/w2560/${team.countryCode.toLowerCase()}.png`;
    loader.load(
      url,
      (loadedTexture) => {
        if (cancelled) {
          loadedTexture.dispose();
          return;
        }
        loadedTexture.colorSpace = SRGBColorSpace;
        loadedTexture.minFilter = LinearFilter;
        loadedTexture.magFilter = LinearFilter;
        loadedTexture.needsUpdate = true;
        setTexture(loadedTexture);
      },
      undefined,
      () => {
        if (!cancelled) setTexture(fallbackTexture);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [fallbackTexture, team.countryCode]);

  useEffect(() => {
    return () => {
      fallbackTexture.dispose();
    };
  }, [fallbackTexture]);

  return texture;
}

function createFallbackFlagTexture(team: Team, side: "left" | "right") {
  const canvas = document.createElement("canvas");
  canvas.width = 2560;
  canvas.height = 1600;
  const context = canvas.getContext("2d");
  if (!context) return new CanvasTexture(canvas);

  const gradient = context.createLinearGradient(
    side === "left" ? 0 : canvas.width,
    0,
    side === "left" ? canvas.width : 0,
    canvas.height,
  );
  gradient.addColorStop(0, team.colors[0]);
  gradient.addColorStop(0.52, team.colors[1]);
  gradient.addColorStop(1, "#f8fafc");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.globalAlpha = 0.16;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#ffffff";
  context.font = "900 720px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillText(team.shortName, canvas.width / 2, canvas.height * 0.56);
  context.globalAlpha = 1;

  const edgeGradient = context.createLinearGradient(
    side === "left" ? canvas.width * 0.68 : canvas.width * 0.32,
    0,
    side === "left" ? canvas.width : 0,
    0,
  );
  edgeGradient.addColorStop(0, "rgba(5,5,7,0)");
  edgeGradient.addColorStop(1, "rgba(5,5,7,0.52)");
  context.fillStyle = edgeGradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function applyCoverCrop(texture: Texture, planeAspect: number) {
  const image = texture.image as HTMLImageElement | HTMLCanvasElement | undefined;
  const imageWidth =
    image instanceof HTMLImageElement ? image.naturalWidth || image.width : image?.width;
  const imageHeight =
    image instanceof HTMLImageElement ? image.naturalHeight || image.height : image?.height;

  if (!imageWidth || !imageHeight) return;

  const imageAspect = imageWidth / imageHeight;
  texture.offset.set(0, 0);
  texture.repeat.set(1, 1);

  if (imageAspect > planeAspect) {
    const repeatX = planeAspect / imageAspect;
    texture.repeat.set(repeatX, 1);
    texture.offset.set((1 - repeatX) / 2, 0);
  } else {
    const repeatY = imageAspect / planeAspect;
    texture.repeat.set(1, repeatY);
    texture.offset.set(0, (1 - repeatY) / 2);
  }

  texture.needsUpdate = true;
}

function easeSmooth(value: number) {
  return value * value * (3 - 2 * value);
}

function getLightningMotion(time: number) {
  const lowShear = Math.sin(time * 1.22) * 0.55 + Math.sin(time * 2.45 + 1.7) * 0.2;
  const snap = Math.max(0, Math.sin(time * 6.8 + Math.sin(time * 1.9) * 2.8));
  const strike = Math.floor(time * 14 + Math.sin(time * 2.1) * 2.2);
  const flashA = Math.pow(Math.max(0, Math.sin(time * 12.9 + Math.sin(time * 2.3) * 3.4)), 9);
  const flashB = Math.pow(Math.max(0, Math.sin(time * 21.5 + 1.3)), 16);
  const flash = Math.min(1, flashA * 0.72 + flashB * 0.45 + snap * snap * 0.2);

  return {
    shear: Math.max(-1, Math.min(1, lowShear + (snap - 0.5) * 0.18)),
    strike,
    flash,
  };
}

type LightningBranchFrame = {
  points: Vector3[];
  opacity: number;
};

type LightningObjects = {
  group: Group;
  coreMesh: Mesh;
  glowMesh: Mesh;
  outerGlowMesh: Mesh;
  coreMaterial: ShaderMaterial;
  glowMaterial: ShaderMaterial;
  outerGlowMaterial: ShaderMaterial;
  branches: Array<{
    line: ThreeLine;
    material: LineBasicMaterial;
  }>;
};

function createLightningObjects(): LightningObjects {
  const group = new Group();
  group.position.z = 0.45;

  const initialPoints = [new Vector3(0, -4, 0), new Vector3(0, 4, 0)];
  const outerGlowMaterial = createLightningRibbonMaterial("#0891b2", 0.18, 0.62);
  const glowMaterial = createLightningRibbonMaterial("#22d3ee", 0.42, 0.9);
  const coreMaterial = createLightningRibbonMaterial("#f8feff", 0.95, 1.8);

  const outerGlowMesh = new Mesh(createRibbonGeometry(initialPoints, 0.66), outerGlowMaterial);
  const glowMesh = new Mesh(createRibbonGeometry(initialPoints, 0.36), glowMaterial);
  const coreMesh = new Mesh(createRibbonGeometry(initialPoints, 0.12), coreMaterial);
  outerGlowMesh.position.z = -0.03;
  glowMesh.position.z = 0.01;
  coreMesh.position.z = 0.05;

  group.add(outerGlowMesh, glowMesh, coreMesh);

  const branches = Array.from({ length: 14 }, (_, index) => {
    const material = new LineBasicMaterial({
      color: index % 3 === 0 ? "#f8feff" : index % 3 === 1 ? "#67e8f9" : "#38bdf8",
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const line = new ThreeLine(createLineGeometry(initialPoints), material);
    line.visible = false;
    group.add(line);
    return { line, material };
  });

  return {
    group,
    coreMesh,
    glowMesh,
    outerGlowMesh,
    coreMaterial,
    glowMaterial,
    outerGlowMaterial,
    branches,
  };
}

function createLightningFrame(time: number, viewportWidth: number, viewportHeight: number) {
  const motion = getLightningMotion(time);
  const top = viewportHeight * 0.82;
  const bottom = -top;
  const pointCount = 26;
  const maxSwing = Math.max(0.55, viewportWidth * 0.085);
  const points = Array.from({ length: pointCount }, (_, index) => {
    const t = index / (pointCount - 1);
    const y = bottom + (top - bottom) * t;
    const cell = Math.floor(t * 18);
    const strikeJitter = (hashNumber(cell * 9.17 + motion.strike * 1.91) - 0.5) * (0.42 + motion.flash * 0.28);
    const wave =
      Math.sin(t * Math.PI * 6.6 + time * 5.2) * 0.18 +
      Math.sin(t * Math.PI * 13.0 - time * 7.4) * 0.08;
    const shear = (t - 0.5) * motion.shear * viewportHeight * 0.085;
    const x = clamp(shear + strikeJitter + wave, -maxSwing, maxSwing);
    const z = Math.sin(t * Math.PI * 2 + time * 2.2) * 0.045;
    return new Vector3(x, y, z);
  });

  const branches = Array.from({ length: 14 }, (_, index): LightningBranchFrame | null => {
    const seed = index * 27.13 + motion.strike * 1.7;
    const branchGate = hashNumber(seed);
    if (branchGate < 0.26 - motion.flash * 0.16) return null;

    const startIndex = 3 + Math.floor(hashNumber(seed + 9.4) * (pointCount - 7));
    const start = points[startIndex];
    const direction = hashNumber(seed + 2.2) > 0.5 ? 1 : -1;
    const length = 0.28 + hashNumber(seed + 4.6) * (0.62 + motion.flash * 0.25);
    const lift = (hashNumber(seed + 7.2) - 0.5) * 0.95;
    const branchPoints = Array.from({ length: 5 }, (_, branchIndex) => {
      const t = branchIndex / 4;
      const wobble = (hashNumber(seed + branchIndex * 5.1) - 0.5) * 0.16;
      return new Vector3(
        start.x + direction * length * t + wobble,
        start.y + lift * t + Math.sin(t * Math.PI + time * 8.0 + seed) * 0.08,
        0.08 + t * 0.05,
      );
    });

    return {
      points: branchPoints,
      opacity: (0.2 + motion.flash * 0.58) * (0.6 + branchGate * 0.5),
    };
  });

  return { points, branches };
}

function createLightningRibbonMaterial(color: string, opacity: number, edgePower: number) {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(color) },
      uOpacity: { value: opacity },
      uTime: { value: 0 },
      uEdgePower: { value: edgePower },
      uFlicker: { value: 0 },
    },
    vertexShader: lightningRibbonVertexShader,
    fragmentShader: lightningRibbonFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
}

function updateLightningRibbonMaterial(
  material: ShaderMaterial,
  opacity: number,
  time: number,
  flicker: number,
) {
  material.uniforms.uOpacity.value = opacity;
  material.uniforms.uTime.value = time;
  material.uniforms.uFlicker.value = flicker;
}

function replaceRibbonGeometry(mesh: Mesh, points: Vector3[], width: number) {
  const previousGeometry = mesh.geometry;
  mesh.geometry = createRibbonGeometry(points, width);
  previousGeometry.dispose();
}

function replaceLineGeometry(line: ThreeLine, points: Vector3[]) {
  const previousGeometry = line.geometry;
  line.geometry = createLineGeometry(points);
  previousGeometry.dispose();
}

function createLineGeometry(points: Vector3[]) {
  const geometry = new BufferGeometry();
  geometry.setFromPoints(points);
  return geometry;
}

function createRibbonGeometry(points: Vector3[], width: number) {
  const smoothedPoints = smoothLightningPoints(points);
  const positions: number[] = [];
  const sideValues: number[] = [];
  const progressValues: number[] = [];
  const indices: number[] = [];
  const halfWidth = width * 0.5;

  smoothedPoints.forEach((point, index) => {
    const previous = smoothedPoints[Math.max(0, index - 1)];
    const next = smoothedPoints[Math.min(smoothedPoints.length - 1, index + 1)];
    const tangentX = next.x - previous.x;
    const tangentY = next.y - previous.y;
    const tangentLength = Math.hypot(tangentX, tangentY) || 1;
    const normalX = -tangentY / tangentLength;
    const normalY = tangentX / tangentLength;
    const progress = smoothedPoints.length === 1 ? 0 : index / (smoothedPoints.length - 1);

    [-1, -0.42, -0.12, 0.12, 0.42, 1].forEach((sideValue) => {
      positions.push(
        point.x + normalX * halfWidth * sideValue,
        point.y + normalY * halfWidth * sideValue,
        point.z,
      );
      sideValues.push(sideValue);
      progressValues.push(progress);
    });

    if (index < smoothedPoints.length - 1) {
      const base = index * 6;
      const nextBase = base + 6;
      for (let sideIndex = 0; sideIndex < 5; sideIndex += 1) {
        indices.push(
          base + sideIndex,
          base + sideIndex + 1,
          nextBase + sideIndex,
          base + sideIndex + 1,
          nextBase + sideIndex + 1,
          nextBase + sideIndex,
        );
      }
    }
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aSide", new Float32BufferAttribute(sideValues, 1));
  geometry.setAttribute("aProgress", new Float32BufferAttribute(progressValues, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function smoothLightningPoints(points: Vector3[]) {
  if (points.length < 3) return points;

  const result: Vector3[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const current = points[index];
    const next = points[index + 1];
    const afterNext = points[Math.min(points.length - 1, index + 2)];
    const steps = 3;

    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      result.push(catmullRomPoint(previous, current, next, afterNext, t));
    }
  }

  result.push(points[points.length - 1].clone());
  return result;
}

function catmullRomPoint(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return new Vector3(
    0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    0.5 *
      (2 * p1.z +
        (-p0.z + p2.z) * t +
        (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
        (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
  );
}

function disposeLightningObjects(lightning: LightningObjects) {
  lightning.coreMesh.geometry.dispose();
  lightning.glowMesh.geometry.dispose();
  lightning.outerGlowMesh.geometry.dispose();
  lightning.coreMaterial.dispose();
  lightning.glowMaterial.dispose();
  lightning.outerGlowMaterial.dispose();
  lightning.branches.forEach((branch) => {
    branch.line.geometry.dispose();
    branch.material.dispose();
  });
}

function hashNumber(value: number) {
  const hashed = Math.sin(value * 12.9898) * 43758.5453123;
  return hashed - Math.floor(hashed);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createArcLines(count: number, leftTeam: Team, rightTeam: Team, active: boolean) {
  return Array.from({ length: count }, (_, index) => {
    const points: number[] = [];
    const segments = 28;
    const seed = index * 9.17;
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const x =
        -0.62 +
        t * 1.24 +
        Math.sin(t * Math.PI * 5 + seed) * 0.18 +
        (Math.random() - 0.5) * 0.16;
      const y = -3.4 + t * 6.8;
      const z = 0.3 + Math.sin(t * Math.PI * 2 + seed) * 0.12;
      points.push(x, y, z);
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(points, 3));
    const material = new LineBasicMaterial({
      color: index % 3 === 0 ? "#f8fdff" : index % 3 === 1 ? "#67e8f9" : "#2563eb",
      transparent: true,
      opacity: active ? 0.82 : 0.32,
      blending: AdditiveBlending,
    });
    return new ThreeLine(geometry, material);
  });
}

function createSpeckleGeometry() {
  const count = 620;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const left = new Color("#bae6fd");
  const right = new Color("#22d3ee");
  const accent = new Color("#ffffff");

  for (let i = 0; i < count; i += 1) {
    const radius = 1.2 + Math.random() * 4.8;
    const angle = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = Math.sin(angle) * radius * 0.58;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 1.6;

    const color = i % 3 === 0 ? left : i % 3 === 1 ? right : accent;
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return { geometry, colors };
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

const energyVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const energyFragmentShader = `
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    vec2 uv = vUv;
    vec2 centered = uv - 0.5;
    float seam = pow(1.0 - smoothstep(0.0, 0.46, abs(centered.x)), 2.2);
    float radial = 1.0 - smoothstep(0.05, 0.68, length(centered));
    float wave = noise(uv * 8.0 + vec2(uTime * 0.7, -uTime * 0.35));
    float lightning = smoothstep(0.72, 0.98, sin((uv.y + wave * 0.26) * 34.0 + uTime * 6.0));
    vec3 color = vec3(0.02, 0.16, 0.32) * seam * 0.44;
    color += vec3(0.02, 0.55, 0.9) * radial * seam * 0.36;
    color += vec3(0.35, 0.95, 1.0) * lightning * seam * 0.28;
    gl_FragColor = vec4(color, seam * 0.48 * uIntensity);
  }
`;

const lightningRibbonVertexShader = `
  attribute float aSide;
  attribute float aProgress;
  varying float vSide;
  varying float vProgress;

  void main() {
    vSide = aSide;
    vProgress = aProgress;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const lightningRibbonFragmentShader = `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uEdgePower;
  uniform float uFlicker;
  varying float vSide;
  varying float vProgress;

  float boltHash(float value) {
    return fract(sin(value * 41.183) * 43758.5453123);
  }

  void main() {
    float edgeDistance = 1.0 - abs(vSide);
    float feather = smoothstep(0.0, 0.82, edgeDistance);
    float softAura = pow(max(feather, 0.0), uEdgePower);
    float hotCenter = pow(smoothstep(0.18, 1.0, edgeDistance), 3.2);
    float travelingPulse = 0.78 + 0.22 * sin(uTime * 20.0 - vProgress * 36.0);
    float brokenCharge = 0.82 + 0.18 * sin(uTime * 47.0 + vProgress * 117.0 + boltHash(vProgress) * 6.28);
    float flash = 1.0 + uFlicker * (0.75 + hotCenter * 1.45);
    float alpha = uOpacity * softAura * travelingPulse * brokenCharge;
    vec3 whiteHeat = vec3(0.82, 0.98, 1.0) * hotCenter * flash;
    vec3 color = uColor * (0.7 + softAura * 0.95) + whiteHeat;
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`;

const seamShapeGlsl = `
  float seamHash(vec2 p) {
    return fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453123);
  }

  float seamNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = seamHash(i);
    float b = seamHash(i + vec2(1.0, 0.0));
    float c = seamHash(i + vec2(0.0, 1.0));
    float d = seamHash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  float seamOffset(float y, float time) {
    float offset = (y - 0.5) * 0.18;
    offset += sin(y * 24.0 + time * 8.6) * 0.052;
    offset += sin(y * 51.0 - time * 6.2) * 0.026;
    offset += (seamNoise(vec2(y * 13.0, time * 2.2)) - 0.5) * 0.07;
    return clamp(offset, -0.16, 0.16);
  }
`;

const flagVertexShader = `
  uniform float uTime;
  uniform float uSide;
  uniform float uProgress;
  varying vec2 vUv;
  varying float vWave;

  void main() {
    vUv = uv;
    vec3 pos = position;
    float freeEdge = uSide < 0.0 ? uv.x : 1.0 - uv.x;
    float seamPull = smoothstep(0.42, 1.0, freeEdge) * uProgress;
    float gust = sin(uv.y * 18.0 + uv.x * 7.0 + uTime * 4.2);
    float ripple = sin(uv.y * 31.0 - uTime * 6.6 + uv.x * 11.0);
    float crosswind = sin((uv.x - uv.y) * 15.0 + uTime * 5.4);
    float wave = (gust * 0.088 + ripple * 0.042 + crosswind * 0.026) * freeEdge * uProgress;
    float shear = (uv.y - 0.5) * 0.065 * seamPull;
    pos.z += wave;
    pos.x += wave * 0.14 * uSide - shear * uSide;
    pos.y += sin(uv.x * 8.0 + uTime * 3.0) * freeEdge * 0.014 * uProgress;
    vWave = abs(wave);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const flagFragmentShader = `
  uniform sampler2D uMap;
  uniform vec2 uRepeat;
  uniform vec2 uOffset;
  uniform float uTime;
  uniform float uSide;
  uniform float uProgress;
  varying vec2 vUv;
  varying float vWave;
  ${seamShapeGlsl}

  void main() {
    vec2 coverUv = vUv * uRepeat + uOffset;
    vec4 flag = texture2D(uMap, coverUv);
    float seamDistance = uSide < 0.0 ? 1.0 - vUv.x : vUv.x;
    float sharedOffset = seamOffset(vUv.y, uTime);
    float edgeNoise = seamNoise(vec2(vUv.y * 34.0, uTime * 3.0));
    float edgeSpark = sin(vUv.y * 88.0 + uTime * 18.0 + edgeNoise * 4.0) * 0.012;
    float cutWidth = clamp(0.075 + uSide * sharedOffset + edgeSpark, 0.018, 0.24);
    float featherWidth = 0.105 + edgeNoise * 0.055;
    float lightningMask = smoothstep(cutWidth, cutWidth + featherWidth, seamDistance);
    float edgeGlow = 1.0 - smoothstep(0.0, featherWidth * 1.65, abs(seamDistance - cutWidth));
    float smokeFade = 0.78 + edgeNoise * 0.22;
    float gustShade = 1.0 + vWave * 2.2;
    flag.rgb *= gustShade;
    flag.rgb += vec3(0.08, 0.92, 1.0) * edgeGlow * 0.42 * uProgress;
    flag.a *= mix(lightningMask, lightningMask * smokeFade, edgeGlow * 0.42) * uProgress;
    gl_FragColor = flag;
  }
`;
