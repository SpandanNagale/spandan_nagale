import { describe, expect, it } from 'vitest';
import { looksLikeRefusal } from './refusalLog';

describe('looksLikeRefusal', () => {
  it('flags a decline that points to the contact email', () => {
    expect(
      looksLikeRefusal(
        "That isn't in the corpus. Email spandan4844@gmail.com and Spandan can answer directly.",
      ),
    ).toBe(true);
  });

  it('flags "no information ... spandan4844@gmail.com"', () => {
    expect(
      looksLikeRefusal('There is no information about that here — reach him at spandan4844@gmail.com.'),
    ).toBe(true);
  });

  it('does not flag a normal grounded answer even if it is negative', () => {
    expect(
      looksLikeRefusal(
        'Spandan has no production Kubernetes experience; the closest is Docker Compose with GPU passthrough in Veritas [[proj:veritas]].',
      ),
    ).toBe(false);
  });

  it('does not flag a decline phrasing without the email', () => {
    expect(looksLikeRefusal("That isn't in the corpus.")).toBe(false);
  });

  it('flags the real "portfolio does not include ... contact ... email" shape', () => {
    expect(
      looksLikeRefusal(
        'The provided portfolio does not include a Financial Document Management System built with FastAPI and JWT authentication. For more information, you can contact Spandan directly at spandan4844@gmail.com.',
      ),
    ).toBe(true);
  });

  it('flags a decline that uses a typographic apostrophe', () => {
    expect(
      looksLikeRefusal(
        'The available information doesn’t include a company Spandan is planning to join. You can reach him at spandan4844@gmail.com.',
      ),
    ).toBe(true);
  });

  it('flags "has not disclosed" salary-type questions', () => {
    expect(
      looksLikeRefusal(
        'Spandan has not disclosed his current salary or notice period. Contact him at spandan4844@gmail.com.',
      ),
    ).toBe(true);
  });
});
