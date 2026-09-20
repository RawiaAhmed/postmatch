import { describe, expect, it } from 'vitest';
import { findInRegister, normaliseCompanyName, parseRegister } from './uk-sponsors';

/** A few lines in the same shape as the built index. */
const register = parseRegister(
  [
    'monzo bank\tMonzo Bank Ltd\tLondon\tSkilled Worker|Global Business Mobility',
    'roofoods t/a deliveroo\tRoofoods Ltd t/a Deliveroo\tLondon\tSkilled Worker',
    'pigment global\tPigment Global Limited\tLondon\tSkilled Worker',
    'tronox pigment\tTronox Pigment UK Limited\tGrimsby\tSkilled Worker',
  ].join('\n'),
);

describe('normaliseCompanyName', () => {
  it('reduces the spellings of one company to the same key', () => {
    const keys = ['MONZO BANK LTD', ' Monzo Bank Limited ', 'Monzo Bank Ltd.', 'Monzo   Bank  plc'].map(
      normaliseCompanyName,
    );

    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe('monzo bank');
  });

  it('spells out an ampersand, so "A&B" and "A and B" agree', () => {
    expect(normaliseCompanyName('Marks & Spencer')).toBe(normaliseCompanyName('Marks and Spencer'));
  });
});

describe('findInRegister', () => {
  it('finds a licensed sponsor however its name is spelled', () => {
    const result = findInRegister(register, 'monzo bank limited');

    expect(result.licensed).toBe(true);
    expect(result.licensed && result.sponsor.routes).toContain('Skilled Worker');
  });

  it('suggests the full name when a partial one is given, rather than claiming it is not licensed', () => {
    const result = findInRegister(register, 'Deliveroo');

    expect(result.licensed).toBe(false);
    expect(result.licensed === false && result.suggestions.map((s) => s.name)).toEqual([
      'Roofoods Ltd t/a Deliveroo',
    ]);
  });

  it('puts the closest name first when several contain the query', () => {
    const result = findInRegister(register, 'Pigment');

    expect(result.licensed === false && result.suggestions.map((s) => s.name)).toEqual([
      'Pigment Global Limited',
      'Tronox Pigment UK Limited',
    ]);
  });

  it('reports a company that is genuinely absent, with nothing to suggest', () => {
    expect(findInRegister(register, 'Zzzz Nonexistent')).toEqual({ licensed: false, suggestions: [] });
  });

  it('treats an empty name as not found rather than matching everything', () => {
    expect(findInRegister(register, '   ')).toEqual({ licensed: false, suggestions: [] });
  });
});
