import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, ContactShadows } from '@react-three/drei';
import type { AnimController } from '@kutlaytunc/us3-anim';
import { AnimatedCharacter, preloadCharacter } from '@kutlaytunc/us3-react';
import { locomotionAsset } from './asset';

const MODEL_URL = '/models/Soldier.glb';
preloadCharacter(MODEL_URL);

const params = new URLSearchParams(window.location.search);
const STAGE = params.get('stage') ?? 'char';
const initialSpeed = (() => {
  const v = Number(params.get('speed'));
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
})();

function Lights() {
  return (
    <>
      <hemisphereLight args={['#dfe7ff', '#20242e', 1.4]} />
      <directionalLight position={[4, 8, 5]} intensity={2.6} castShadow shadow-mapSize={[2048, 2048]} />
      <directionalLight position={[-5, 4, -3]} intensity={0.5} color="#6ee7ff" />
    </>
  );
}

function GroundAndControls() {
  return (
    <>
      <ContactShadows position={[0, 0.01, 0]} opacity={0.5} scale={10} blur={2.4} far={4} />
      <Grid args={[20, 20]} cellSize={0.5} cellColor="#2a2f3a" sectionSize={2.5} sectionColor="#3b4252" fadeDistance={26} infiniteGrid />
      <OrbitControls makeDefault target={[0, 1, 0]} minDistance={1.6} maxDistance={12} maxPolarAngle={Math.PI / 1.9} />
    </>
  );
}

function Scene({ speed, paused, onReady }: { speed: number; paused: boolean; onReady: (c: AnimController) => void }) {
  return (
    <>
      <Lights />
      {STAGE === 'box' && (
        <mesh position={[0, 1, 0]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#4f8cff" />
        </mesh>
      )}
      {(STAGE === 'drei' || STAGE === 'char') && <GroundAndControls />}
      {STAGE === 'char' && (
        <Suspense fallback={null}>
          <AnimatedCharacter url={MODEL_URL} asset={locomotionAsset} params={{ speed }} paused={paused} onReady={onReady} />
        </Suspense>
      )}
    </>
  );
}

function WeightBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="bar-row">
      <span className="label">{label}</span>
      <span className="bar-track">
        <span className="bar-fill" style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
      <span className="val">{value.toFixed(2)}</span>
    </div>
  );
}

function ControlPanel({
  speed,
  setSpeed,
  paused,
  setPaused,
}: {
  speed: number;
  setSpeed: (v: number) => void;
  paused: boolean;
  setPaused: (v: boolean) => void;
}) {
  return (
    <div className="controls">
      <div className="controls-title">Locomotion</div>
      <label className="ctl-row">
        <span>speed</span>
        <input type="range" min={0} max={1} step={0.01} value={speed} onChange={(e) => setSpeed(e.target.valueAsNumber)} />
        <span className="ctl-val">{speed.toFixed(2)}</span>
      </label>
      <label className="ctl-row">
        <span>paused</span>
        <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} />
      </label>
    </div>
  );
}

export function App() {
  const [speed, setSpeed] = useState(initialSpeed);
  const [paused, setPaused] = useState(false);

  const controllerRef = useRef<AnimController | null>(null);
  const [weights, setWeights] = useState<Record<string, number>>({});

  useEffect(() => {
    const id = window.setInterval(() => {
      const c = controllerRef.current;
      if (!c) return;
      const w = Object.fromEntries(c.baseWeights);
      setWeights(w);
      (window as unknown as { __demo?: unknown }).__demo = { weights: w, activeState: c.activeStateId, stage: STAGE };
    }, 90);
    return () => window.clearInterval(id);
  }, []);

  return (
    <>
      <div className="brand">
        us3 · blendspace demo
      </div>

      <ControlPanel speed={speed} setSpeed={setSpeed} paused={paused} setPaused={setPaused} />

      <Canvas shadows camera={{ position: [2.6, 1.6, 3.2], fov: 45 }} dpr={[1, 2]}>
        <color attach="background" args={['#0b0d12']} />
        <Scene speed={speed} paused={paused} onReady={(c) => (controllerRef.current = c)} />
      </Canvas>

      <div className="overlay">
        <h1>Live clip weights</h1>
        <p className="sub">1D blend · Idle → Walk → Run (speed = {speed.toFixed(2)})</p>
        <WeightBar label="Idle" value={weights.Idle ?? 0} />
        <WeightBar label="Walk" value={weights.Walk ?? 0} />
        <WeightBar label="Run" value={weights.Run ?? 0} />
      </div>
    </>
  );
}
