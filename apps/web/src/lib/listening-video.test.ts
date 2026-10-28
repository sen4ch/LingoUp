import { describe, expect, it } from 'vitest';
import { subtitlesVtt, youtubeEmbed } from './listening-video';

describe('listening video sources', () => {
  it('accepts publisher video and playlist links without allowing arbitrary iframe origins', () => {
    expect(youtubeEmbed('https://youtu.be/eRsGyueVLvQ')?.src).toContain('/embed/eRsGyueVLvQ?');
    expect(youtubeEmbed('https://www.youtube.com/watch?v=vAi1JlMIQVM')?.original).toContain(
      'vAi1JlMIQVM',
    );
    expect(youtubeEmbed('https://www.youtube.com/playlist?list=PL1234567890abcd')?.src).toContain(
      '/videoseries?list=PL1234567890abcd',
    );
    for (const url of [
      'javascript:alert(1)',
      'https://youtube.com.attacker.test/watch?v=eRsGyueVLvQ',
      'https://example.com/embed/video',
      'https://youtube.com/watch?v=../evil',
    ])
      expect(youtubeEmbed(url)).toBeNull();
  });
  it('converts SRT timestamps to WebVTT and rejects files without subtitle cues', () => {
    expect(subtitlesVtt('1\n00:00:01,000 --> 00:00:03,500\nHello!')).toContain(
      '00:00:01.000 --> 00:00:03.500',
    );
    expect(subtitlesVtt('WEBVTT\n\n00:00.000 --> 00:01.000\nHi')).toMatch(/^WEBVTT/);
    expect(() => subtitlesVtt('not subtitles')).toThrow();
  });
});
