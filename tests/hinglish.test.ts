import { hindiToHinglish, tidy, translateToHinglish } from '@/features/captions/hinglish/pipeline';
import { maskProtectedTerms, restoreAcronymsInHindi, restoreProtectedTerms, spellAcronymDevanagari } from '@/features/captions/hinglish/protect';
import { romanizeText, romanizeWord } from '@/features/captions/hinglish/romanize';
import type { GlossaryEntry, GlossaryRuleType } from '@/types';

const g = (sourcePhrase: string, ruleType: GlossaryRuleType = 'preserve_english', replacement = sourcePhrase, enabled = true): GlossaryEntry => ({
  id: sourcePhrase + ruleType,
  sourcePhrase,
  replacement,
  ruleType,
  enabled,
  updatedAt: 0,
});

describe('romanizeWord (schwa deletion + spelling)', () => {
  it.each([
    ['कमल', 'kamal'],
    ['समझना', 'samajhna'],
    ['बोलना', 'bolna'],
    ['मित्र', 'mitra'],
    ['पढ़ाई', 'padhaai'],
    ['ज़रा', 'zara'],
    ['फ़ाइल', 'faail'],
    ['ज्ञान', 'gyaan'],
    ['हिंदी', 'hindi'],
    ['संपर्क', 'sampark'],
    ['धर्म', 'dharm'],
    ['सत्य', 'satya'],
    ['कार्यक्रम', 'kaaryakram'],
    ['२०२६', '2026'],
  ])('%s -> %s', (dev, roman) => {
    expect(romanizeWord(dev)).toBe(roman);
  });

  it('passes Latin text and punctuation through unchanged', () => {
    expect(romanizeWord('API')).toBe('API');
    expect(romanizeText('build तैयार है।')).toBe('build taiyaar hai.');
  });
});

describe('glossary protection', () => {
  const glossary = [g('API'), g('React Native'), g('dashboard'), g('standup', 'translate_as', 'daily standup'), g('deploy', 'preserve_english', 'deploy', false)];

  it('masks whole-word, case-insensitive phrases, longest first, without overlap', () => {
    const r = maskProtectedTerms('Fix the api in react native and the Dashboard before standup; deploy rapidly.', glossary);
    expect(r.masked).toBe('Fix the ZX0Q in ZX1Q and the ZX2Q before ZX3Q; deploy rapidly.');
    expect(r.slots.map((s) => s.output)).toEqual(['API', 'React Native', 'dashboard', 'daily standup']);
  });

  it('does not match inside other words', () => {
    expect(maskProtectedTerms('rapid dashboards', glossary).slots).toHaveLength(0);
    expect(maskProtectedTerms('the APIs', glossary).slots).toHaveLength(0);
  });

  it('prefers translate_as over preserve_english for the same phrase', () => {
    const r = maskProtectedTerms('the build failed', [g('build'), g('build', 'translate_as', 'build number')]);
    expect(r.slots[0].output).toBe('build number');
  });

  it('restores placeholders and detects lost ones', () => {
    const { slots } = maskProtectedTerms('check the API', glossary);
    expect(restoreProtectedTerms('ZX0Q की जाँच करें', slots)).toEqual({ text: 'API की जाँच करें', ok: true });
    expect(restoreProtectedTerms('Z X0 Q की जाँच करें', slots).ok).toBe(true);
    expect(restoreProtectedTerms('की जाँच करें', slots).ok).toBe(false);
  });

  it('spells acronyms in Devanagari for the fallback path', () => {
    expect(spellAcronymDevanagari('API')).toBe('एपीआई');
    expect(spellAcronymDevanagari('dashboard')).toBeNull();
    expect(restoreAcronymsInHindi('एपीआई प्रतिक्रिया', [g('API')])).toBe('API प्रतिक्रिया');
  });
});

describe('hindiToHinglish', () => {
  const glossary = [g('API')];

  it('natural style restores loanwords and replaces formal words with common English', () => {
    expect(hindiToHinglish('कृपया नवीनतम बिल्ड साझा करें।', { style: 'natural_hinglish', glossary })).toBe('Please latest build share karein.');
  });

  it('simple style keeps Hindi words romanised but still restores English loanwords', () => {
    expect(hindiToHinglish('कृपया नवीनतम बिल्ड साझा करें।', { style: 'simple_hinglish', glossary })).toBe('Kripya naveentam build saajha karein.');
  });

  it('applies Devanagari and Roman romanisation overrides', () => {
    const overrides = [g('करें', 'romanization_override', 'karo'), g('latest', 'romanization_override', 'naya')];
    expect(hindiToHinglish('कृपया नवीनतम बिल्ड साझा करें।', { style: 'natural_hinglish', glossary: overrides })).toBe('Please naya build share karo.');
  });

  it('restores English greetings that ML Kit writes in Devanagari (seen on device: "Hailo")', () => {
    expect(hindiToHinglish('हैलो, आप कैसे हैं', { style: 'natural_hinglish', glossary })).toBe('Hello, aap kaise hain');
  });

  it('keeps Latin protected terms intact', () => {
    expect(hindiToHinglish('API प्रतिक्रिया की पुष्टि करें', { style: 'natural_hinglish', glossary })).toBe('API response ki confirm karein');
  });

  it('tidies spacing and capitalises sentences', () => {
    expect(tidy('hello  ,world .next one')).toBe('Hello, world. Next one');
  });
});

describe('translateToHinglish', () => {
  const glossary = [g('API'), g('dashboard')];

  it('masks terms, translates once, and restores them', async () => {
    const calls: string[] = [];
    const fake = async (t: string) => {
      calls.push(t);
      return 'कृपया ZX0Q प्रतिक्रिया की पुष्टि करें और ZX1Q अपडेट करें।';
    };
    const r = await translateToHinglish('Please confirm the API response and update the dashboard.', fake, { style: 'natural_hinglish', glossary });
    expect(calls).toEqual(['Please confirm the ZX0Q response and update the ZX1Q.']);
    expect(r.protectionFallback).toBe(false);
    expect(r.hindi).toBe('कृपया API प्रतिक्रिया की पुष्टि करें और dashboard अपडेट करें।');
    expect(r.hinglish).toBe('Please API response ki confirm karein aur dashboard update karein.');
    expect(r.protectedTerms).toEqual(['API', 'dashboard']);
  });

  it('falls back to unmasked translation when placeholders are lost', async () => {
    const responses = ['कृपया प्रतिक्रिया की पुष्टि करें', 'कृपया एपीआई प्रतिक्रिया की पुष्टि करें'];
    const fake = jest.fn(async () => responses.shift()!);
    const r = await translateToHinglish('Please confirm the API response', fake, { style: 'natural_hinglish', glossary });
    expect(fake).toHaveBeenCalledTimes(2);
    expect(r.protectionFallback).toBe(true);
    expect(r.hinglish).toBe('Please API response ki confirm karein');
  });

  it('returns empty output for empty input without calling the translator', async () => {
    const fake = jest.fn(async () => 'x');
    expect((await translateToHinglish('   ', fake, { style: 'natural_hinglish', glossary })).hinglish).toBe('');
    expect(fake).not.toHaveBeenCalled();
  });

  it('propagates translator errors so the caller can mark the segment failed', async () => {
    await expect(
      translateToHinglish('hello', async () => Promise.reject(new Error('translation_timeout')), { style: 'natural_hinglish', glossary }),
    ).rejects.toThrow('translation_timeout');
  });
});
