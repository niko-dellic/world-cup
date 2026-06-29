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
  Points,
  SRGBColorSpace,
  ShaderMaterial,
  Texture,
  TextureLoader,
  Vector2,
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
  const materialRef = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: active ? 1 : 0.62 },
    }),
    [],
  );

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uIntensity.value += ((active ? 1 : 0) - uniforms.uIntensity.value) * (active ? 0.08 : 0.04);
  });

  return (
    <mesh
      position={[0, 0, 0.25]}
      rotation={[0, 0, -0.26]}
      scale={[viewport.width * 0.32, viewport.height * 1.38, 1]}
    >
      <planeGeometry args={[1, 1, 64, 128]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={energyVertexShader}
        fragmentShader={seamFragmentShader}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        side={DoubleSide}
      />
    </mesh>
  );
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
    float cutWidth = clamp(0.075 + uSide * sharedOffset, 0.018, 0.24);
    float lightningMask = smoothstep(cutWidth, cutWidth + 0.035, seamDistance);
    float edgeGlow = 1.0 - smoothstep(0.0, 0.13, abs(seamDistance - cutWidth));
    float gustShade = 1.0 + vWave * 2.2;
    flag.rgb *= gustShade;
    flag.rgb += vec3(0.08, 0.92, 1.0) * edgeGlow * 0.42 * uProgress;
    flag.a *= lightningMask * uProgress;
    gl_FragColor = flag;
  }
`;

const seamFragmentShader = `
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;
  ${seamShapeGlsl}

  void main() {
    vec2 uv = vUv;
    float boltPath = 0.5 + seamOffset(uv.y, uTime);
    float dist = abs(uv.x - boltPath);
    float core = smoothstep(0.055, 0.0, dist);
    float glow = smoothstep(0.42, 0.0, dist);
    float branches = smoothstep(
      0.78,
      1.0,
      sin((uv.x + uv.y) * 46.0 + seamNoise(uv * 18.0) * 8.0 + uTime * 11.0)
    );
    branches *= smoothstep(0.48, 0.0, abs(uv.x - boltPath));
    vec3 color = vec3(0.72, 0.96, 1.0) * core * 1.25;
    color += vec3(0.08, 0.72, 1.0) * glow * 0.98;
    color += vec3(0.05, 0.22, 1.0) * branches * 0.64;
    float alpha = clamp((core * 0.92 + glow * 0.58 + branches * 0.26) * uIntensity, 0.0, 1.0);
    gl_FragColor = vec4(color, alpha);
  }
`;
