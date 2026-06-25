// A tiny gallery of how a consumer wires us3's runtimes into a plain R3F app.
// Each tab is a self-contained example — read the source, the pattern is always the same:
// import a hook, it owns the runtime and ticks it in useFrame, you drive it from your code.
import { useState } from 'react';
import { FollowDemo } from './FollowDemo';
import { NavDemo } from './NavDemo';
import { GuardDemo } from './GuardDemo';

const TABS = [
  { id: 'follow', label: 'Follow me', blurb: 'AnimatedCharacter + behaviour tree + nav — move your mouse; the NPC paths to you and blends idle→walk→run by its own speed.', el: <FollowDemo /> },
  { id: 'nav', label: 'Navigation', blurb: 'useNavMesh + useNavAgent — click the floor to path around obstacles.', el: <NavDemo /> },
  { id: 'guard', label: 'Guard AI', blurb: 'useBehaviorTree + nav over a plain board — patrols, chases the player in sight.', el: <GuardDemo /> },
] as const;

export function App() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('follow');
  const active = TABS.find((t) => t.id === tab)!;
  return (
    <div className="app">
      <header>
        <div className="brand">us3 <span>quickstart</span></div>
        <nav>
          {TABS.map((t) => (
            <button key={t.id} className={t.id === tab ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>
        <a className="src" href="https://www.npmjs.com/package/@kutlaytunc/us3" target="_blank" rel="noreferrer">npm i @kutlaytunc/us3</a>
      </header>
      <p className="blurb">{active.blurb}</p>
      <main key={active.id}>{active.el}</main>
    </div>
  );
}
