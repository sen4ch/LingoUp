import { describe, expect, it } from 'vitest';
import { pickVoice, type VoiceLike } from './pronunciation';

const voice = (lang: string, localService: boolean, isDefault = false): VoiceLike => ({
  lang,
  localService,
  default: isDefault,
});

describe('pickVoice', () => {
  const online = voice('en-US', false);
  const localUs = voice('en-US', true);
  const localGb = voice('en_GB', true);
  const russian = voice('ru-RU', true, true);

  it('prefers an American, on-device voice', () => {
    expect(pickVoice([russian, online, localGb, localUs], false)).toBe(localUs);
  });

  it('falls back to any English voice', () => {
    expect(pickVoice([russian, localGb], false)).toBe(localGb);
    expect(pickVoice([russian, online], false)).toBe(online);
  });

  it('never picks an online voice when the text must stay on the device', () => {
    expect(pickVoice([online, localGb], true)).toBe(localGb);
    expect(pickVoice([online, russian], true)).toBeNull();
  });
});
