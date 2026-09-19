/**
 * The preview card shown when the site is shared (LinkedIn, Slack, WhatsApp).
 * Next.js renders this to a PNG at build time.
 */
import { ImageResponse } from 'next/og';

export const alt = 'postmatch: job posting analyser';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 24,
          padding: 80,
          background: '#09090b',
          color: '#fafafa',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 88, fontWeight: 700 }}>postmatch</div>
        <div style={{ fontSize: 40, color: '#a1a1aa', lineHeight: 1.3 }}>
          Paste a job posting. Get its requirements, sponsorship and eligibility as structured facts, streamed live.
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 16, fontSize: 28, color: '#71717a' }}>
          <span>Next.js</span>
          <span>·</span>
          <span>TypeScript</span>
          <span>·</span>
          <span>Vercel AI SDK</span>
          <span>·</span>
          <span>Claude</span>
        </div>
      </div>
    ),
    size,
  );
}
