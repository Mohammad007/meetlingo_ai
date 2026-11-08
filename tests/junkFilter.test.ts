import { isJunkCaption } from '@/features/captions/junkFilter';

describe('isJunkCaption', () => {
  it.each(['uh', 'Um.', 'hmm hmm', 'uh the', '', '  ', 'A', 'mm,'])('drops filler / noise: %p', (t) => {
    expect(isJunkCaption(t)).toBe(true);
  });

  it.each(['Yes.', 'No', 'Okay', 'Done', 'Thanks', 'Hello'])('keeps real one-word answers: %p', (t) => {
    expect(isJunkCaption(t, 150)).toBe(false);
  });

  it('drops a very short unexplained single word but keeps it when it lasted long enough', () => {
    expect(isJunkCaption('the', 900)).toBe(true);
    expect(isJunkCaption('Tuesday', 120)).toBe(true);
    expect(isJunkCaption('Tuesday', 600)).toBe(false);
  });

  it('keeps normal sentences, even with fillers inside', () => {
    expect(isJunkCaption('uh please share the latest build')).toBe(false);
    expect(isJunkCaption('I will test it')).toBe(false);
  });
});
