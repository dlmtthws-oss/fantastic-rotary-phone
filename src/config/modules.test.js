import { MODULES, PLANS, TIER_ORDER, resolveEntitlements, planThatUnlocks, getModule } from './modules';

describe('modules registry', () => {
  test('every module belongs to a known tier', () => {
    Object.values(MODULES).forEach((module) => {
      expect(TIER_ORDER).toContain(module.tier);
    });
  });

  test('plans are cumulative across tiers', () => {
    expect(PLANS.solo.modules.length).toBeGreaterThan(0);
    expect(PLANS.team.modules.length).toBeGreaterThan(PLANS.solo.modules.length);
    expect(PLANS.business.modules.length).toBeGreaterThan(PLANS.team.modules.length);
    expect(PLANS.ai.modules.length).toBeGreaterThan(PLANS.business.modules.length);

    PLANS.solo.modules.forEach((key) => expect(PLANS.team.modules).toContain(key));
    PLANS.team.modules.forEach((key) => expect(PLANS.business.modules).toContain(key));
    PLANS.business.modules.forEach((key) => expect(PLANS.ai.modules).toContain(key));
  });

  test('ai plan includes every registered module', () => {
    expect(PLANS.ai.modules.sort()).toEqual(Object.keys(MODULES).sort());
  });
});

describe('resolveEntitlements', () => {
  test('solo plan only includes solo-tier modules', () => {
    const entitlements = resolveEntitlements('solo', null);
    expect(entitlements.has('customers')).toBe(true);
    expect(entitlements.has('invoicing')).toBe(true);
    expect(entitlements.has('quotes')).toBe(false);
    expect(entitlements.has('ai_copilot')).toBe(false);
  });

  test('team plan includes solo and team modules but not business/ai', () => {
    const entitlements = resolveEntitlements('team', null);
    expect(entitlements.has('customers')).toBe(true);
    expect(entitlements.has('quotes')).toBe(true);
    expect(entitlements.has('vat_mtd')).toBe(false);
    expect(entitlements.has('ai_copilot')).toBe(false);
  });

  test('unknown plan falls back to solo', () => {
    const entitlements = resolveEntitlements('not-a-real-plan', null);
    expect(entitlements).toEqual(resolveEntitlements('solo', null));
  });

  test('per-company overrides add extra modules on top of the plan', () => {
    const entitlements = resolveEntitlements('solo', ['ai_copilot', 'quotes']);
    expect(entitlements.has('customers')).toBe(true);
    expect(entitlements.has('ai_copilot')).toBe(true);
    expect(entitlements.has('quotes')).toBe(true);
    expect(entitlements.has('vat_mtd')).toBe(false);
  });

  test('overrides cannot be used to remove modules included in the plan', () => {
    const withOverrides = resolveEntitlements('ai', []);
    const withoutOverrides = resolveEntitlements('ai', null);
    expect(withOverrides).toEqual(withoutOverrides);
    expect(withOverrides.size).toBe(Object.keys(MODULES).length);
  });
});

describe('planThatUnlocks', () => {
  test('returns solo for core modules', () => {
    expect(planThatUnlocks('customers')).toBe('solo');
    expect(planThatUnlocks('invoicing')).toBe('solo');
  });

  test('returns the cheapest plan that includes the module', () => {
    expect(planThatUnlocks('quotes')).toBe('team');
    expect(planThatUnlocks('vat_mtd')).toBe('business');
    expect(planThatUnlocks('ai_copilot')).toBe('ai');
  });
});

describe('getModule', () => {
  test('returns module config for a known key', () => {
    expect(getModule('ai_copilot')).toEqual(MODULES.ai_copilot);
  });

  test('returns null for an unknown key', () => {
    expect(getModule('does_not_exist')).toBeNull();
  });
});
