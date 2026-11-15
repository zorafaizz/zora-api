import type React from 'react';
import { LandingAction } from './LandingAction';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';

interface LandingHeroProps {
  endpointCount: number;
  reducedMotion: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  videoMuted: boolean;
  videoPaused: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onPlaybackChange: (paused: boolean) => void;
}

export function LandingHero({
  endpointCount,
  reducedMotion,
  videoRef,
  videoMuted,
  videoPaused,
  onToggleAudio,
  onToggleVideo,
  onPlaybackChange,
}: LandingHeroProps) {
  return (
    <section className="hero-cinematic relative isolate min-h-[100svh] overflow-hidden">
      <div className="hero-background-media absolute inset-0 -z-20">
        <video
          ref={videoRef}
          autoPlay={!reducedMotion}
          loop
          muted
          playsInline
          preload="metadata"
          poster="/assets/media/intro-poster.webp"
          aria-hidden="true"
          onPlay={() => onPlaybackChange(false)}
          onPause={() => onPlaybackChange(true)}
        >
          <source src="/assets/media/intro.webm" type="video/webm" />
          <source src="/assets/media/intro.mp4" type="video/mp4" />
        </video>
      </div>
      <div className="hero-film-overlay absolute inset-0 -z-10" aria-hidden="true" />

      <div className="hero-editorial-grid hero-copy mx-auto flex min-h-[100svh] max-w-[1480px] flex-col justify-end px-5 pb-6 pt-28 sm:px-8 sm:pb-10 lg:px-12 lg:pb-12">
        <div className="max-w-6xl">
          <p className="hero-reveal hero-eyebrow"><span className="hero-eyebrow-line" />KanjutGede API <span className="hero-eyebrow-separator">/</span> REST infrastructure</p>
          <h1 className="hero-title">
            <span className="hero-mask-word"><span>The web,</span></span>
            <span className="hero-mask-word hero-title-accent"><span>ready to</span></span>
            <span className="hero-mask-word hero-title-accent"><span>build with.</span></span>
          </h1>

          <div className="hero-reveal hero-summary mt-6 grid gap-6 border-t pt-5 sm:grid-cols-[minmax(0,36rem)_auto] sm:items-end lg:mt-8 lg:max-w-6xl">
            <p className="max-w-xl text-pretty text-sm leading-6 sm:text-base sm:leading-7">
              Search, extract, discover, and automate through one focused API contract. No dashboard theatre. No request fires without you.
            </p>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-end">
              <LandingAction href="/explorer">Open Workbench</LandingAction>
              <LandingAction href="/docs" secondary>Read API Docs</LandingAction>
            </div>
          </div>
        </div>

        <div className="hero-reveal hero-proof-row mt-7 flex items-center justify-between gap-4 border-t pt-4 font-mono text-[10px] uppercase tracking-[0.14em] sm:mt-10 sm:text-[11px]">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <span><strong>{endpointCount || '—'}</strong> routes</span>
            <span><strong>3.1</strong> OpenAPI</span>
            <span className="hidden sm:inline"><strong>1 MB</strong> stream guard</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={onToggleVideo} aria-label={videoPaused ? 'Play hero video' : 'Pause hero video'} className="media-control">
              {videoPaused ? <Play aria-hidden="true" className="h-4 w-4" /> : <Pause aria-hidden="true" className="h-4 w-4" />}
            </button>
            <button type="button" onClick={onToggleAudio} aria-label={videoMuted ? 'Unmute hero video' : 'Mute hero video'} className="media-control">
              {videoMuted ? <VolumeX aria-hidden="true" className="h-4 w-4" /> : <Volume2 aria-hidden="true" className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
