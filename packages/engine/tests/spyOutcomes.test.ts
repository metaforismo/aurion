import { describe, expect, it } from 'vitest';
import { createGame } from '../src/createGame.js';
import { SPY_DETECTED_ATTITUDE_PENALTY, sabotageGdpLoss } from '../src/actions/deploySpy.js';
import { tick } from '../src/tick.js';
import type { GameState, SpyOperation, SpyPayload } from '../src/types.js';
import { makeScenario, sampleTechs } from './fixtures.js';

const scenario = makeScenario();
const base = createGame(scenario, {
  seed: 'spy-outcomes',
  victory: 'economic',
  playerCountryId: 'aurion',
});

/** Resolve one operation on the next tick with the dice loaded. */
function resolve(payload: SpyPayload, odds: { success: number; detection: number }): GameState {
  const op: SpyOperation = {
    id: 'spy_test',
    type: payload.kind,
    ownerCountryId: 'aurion',
    targetCountryId: 'borealis',
    payload,
    progressTicks: 0,
    durationTicks: 1,
    successProbability: odds.success,
    detectionRisk: odds.detection,
    status: 'active',
    startedAtTick: 0,
  };
  return tick({ ...base, spyOperations: [op] }, { techCatalog: sampleTechs });
}

const SURE = { success: 1, detection: 0 };
const relKey = 'aurion::borealis';

describe('spy operation outcomes', () => {
  it('returns the agent when the operation is not detected', () => {
    const after = resolve({ kind: 'destabilize' }, SURE);
    expect(after.countries.aurion!.intelligence.spyCount).toBe(
      base.countries.aurion!.intelligence.spyCount + 1,
    );
    expect(after.spyOperations[0]!.result).toEqual({ success: true, detected: false, agentReturned: true });
  });

  it('loses the agent and sours relations when detected, keeping the effect', () => {
    const after = resolve({ kind: 'propaganda', targetFaction: null }, { success: 1, detection: 1 });
    expect(after.countries.aurion!.intelligence.spyCount).toBe(base.countries.aurion!.intelligence.spyCount);
    const op = after.spyOperations[0]!;
    expect(op.status).toBe('detected');
    expect(op.result).toEqual({ success: true, detected: true, agentReturned: false });
    const before = base.relations[relKey as keyof typeof base.relations]!.attitude;
    const now = after.relations[relKey as keyof typeof after.relations]!.attitude;
    expect(before - now).toBeGreaterThanOrEqual(Math.min(SPY_DETECTED_ATTITUDE_PENALTY, before + 100) - 1);
  });

  it('sabotage cuts deeper into a bigger sector', () => {
    expect(sabotageGdpLoss(0.6)).toBeGreaterThan(sabotageGdpLoss(0.1));
    const sectors = base.countries.borealis!.economy.sectors;
    const [big, small] = (Object.keys(sectors) as Array<keyof typeof sectors>).sort(
      (a, b) => sectors[b] - sectors[a],
    ) as [keyof typeof sectors, keyof typeof sectors];
    const clean = tick(base, { techCatalog: sampleTechs }).countries.borealis!.economy.gdp;
    const hitBig = resolve({ kind: 'sabotage', targetSector: big }, SURE).countries.borealis!.economy.gdp;
    const hitSmall = resolve({ kind: 'sabotage', targetSector: small }, SURE).countries.borealis!.economy.gdp;
    expect(hitBig).toBeLessThan(clean);
    if (sectors[big] > sectors[small]) expect(hitBig).toBeLessThan(hitSmall);
  });

  it('propaganda aimed at one faction hits that faction hardest', () => {
    const after = resolve({ kind: 'propaganda', targetFaction: 'army' }, SURE);
    const clean = tick(base, { techCatalog: sampleTechs });
    const drop = (fid: 'army' | 'business') =>
      clean.countries.borealis!.politics.factions[fid].satisfaction -
      after.countries.borealis!.politics.factions[fid].satisfaction;
    expect(drop('army')).toBeGreaterThan(10);
    expect(drop('army')).toBeGreaterThan(drop('business'));
  });

  it('each assassination target does something different', () => {
    const clean = tick(base, { techCatalog: sampleTechs }).countries.borealis!;
    const defence = resolve({ kind: 'assassinate', targetRoleKey: 'role.defence_minister' }, SURE);
    const chief = resolve({ kind: 'assassinate', targetRoleKey: 'role.intelligence_chief' }, SURE);
    const head = resolve({ kind: 'assassinate', targetRoleKey: 'role.head_of_state' }, SURE);

    if (clean.military.doctrineLevel > 0) {
      expect(defence.countries.borealis!.military.doctrineLevel).toBeLessThan(clean.military.doctrineLevel);
    }
    // No direct blow to the government: at most the drift an unhappier army causes.
    expect(clean.politics.popularity - defence.countries.borealis!.politics.popularity).toBeLessThan(1);

    expect(chief.countries.borealis!.intelligence.counterIntelLevel).toBeLessThanOrEqual(
      Math.max(0, clean.intelligence.counterIntelLevel - 0.1) + 1e-9,
    );
    expect(chief.countries.aurion!.intelligence.knownIntel.borealis).toBe('full');

    expect(head.countries.borealis!.politics.popularity).toBeLessThan(clean.politics.popularity);
  });
});
