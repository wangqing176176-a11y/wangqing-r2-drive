"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    Plyr?: PlyrConstructor;
  }
}

type PlyrInstance = {
  destroy: () => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  off: (event: string, handler: (...args: unknown[]) => void) => void;
};

type PlyrConstructor = new (element: HTMLVideoElement, options?: Record<string, unknown>) => PlyrInstance;

const PLYR_CSS_URL = "https://cdn.plyr.io/3.7.8/plyr.css";
const PLYR_JS_URL = "https://cdn.plyr.io/3.7.8/plyr.polyfilled.js";
const PLYR_SVG_URL = "https://cdn.plyr.io/3.7.8/plyr.svg";

const loadStylesheetOnce = (href: string, id: string) =>
  new Promise<void>((resolve, reject) => {
    if (typeof document === "undefined") return resolve();
    const existing = document.getElementById(id) as HTMLLinkElement | null;
    if (existing) return resolve();

    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load css: ${href}`));
    document.head.appendChild(link);
  });

const loadScriptOnce = (src: string, id: string) =>
  new Promise<void>((resolve, reject) => {
    if (typeof document === "undefined") return resolve();
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) return resolve();

    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });

let plyrLoadPromise: Promise<void> | null = null;
const ensurePlyrLoaded = async () => {
  if (typeof window === "undefined") return;
  if (window.Plyr) return;
  if (!plyrLoadPromise) {
    plyrLoadPromise = Promise.all([
      loadStylesheetOnce(PLYR_CSS_URL, "plyr-css"),
      loadScriptOnce(PLYR_JS_URL, "plyr-js"),
    ]).then(() => undefined);
  }
  await plyrLoadPromise;
};

type PlyrVideoProps = {
  src: string;
  title?: string;
};

export default function PlyrVideo({ src, title }: PlyrVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<PlyrInstance | null>(null);

  const [ready, setReady] = useState(false);
  const [portrait, setPortrait] = useState<boolean | null>(null);
  const [buffering, setBuffering] = useState(false);
  const [started, setStarted] = useState(false);

  const wrapperClassName = useMemo(() => {
    const base =
      "relative bg-black rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.3)] overflow-hidden mx-auto w-full";
    if (portrait === true) return `${base} max-w-md aspect-[9/16]`;
    return `${base} max-w-5xl aspect-video`;
  }, [portrait]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const onLoadedMetadata = () => {
      if (el.videoWidth > 0 && el.videoHeight > 0) {
        setPortrait(el.videoHeight > el.videoWidth);
      }
    };

    const onPlay = () => setStarted(true);
    const onWaiting = () => setBuffering(true);
    const onStalled = () => setBuffering(true);
    const onSeeking = () => setBuffering(true);
    const onCanPlay = () => setBuffering(false);
    const onPlaying = () => setBuffering(false);
    const onSeeked = () => setBuffering(false);

    el.addEventListener("loadedmetadata", onLoadedMetadata);
    el.addEventListener("play", onPlay);
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("stalled", onStalled);
    el.addEventListener("seeking", onSeeking);
    el.addEventListener("canplay", onCanPlay);
    el.addEventListener("playing", onPlaying);
    el.addEventListener("seeked", onSeeked);

    return () => {
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("stalled", onStalled);
      el.removeEventListener("seeking", onSeeking);
      el.removeEventListener("canplay", onCanPlay);
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("seeked", onSeeked);
    };
  }, [src]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setReady(false);
      setStarted(false);
      setBuffering(false);
      setPortrait(null);

      await ensurePlyrLoaded();
      if (cancelled) return;

      const el = videoRef.current;
      const Plyr = window.Plyr;
      if (!el || !Plyr) return;

      try {
        playerRef.current?.destroy();
      } catch {
        // ignore
      }

      playerRef.current = new Plyr(el, {
        controls: ["play-large", "play", "progress", "current-time", "duration", "mute", "volume", "settings", "fullscreen"],
        settings: ["speed"],
        speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
        iconUrl: PLYR_SVG_URL,
        playsinline: true,
      });

      setReady(true);
    };

    init();
    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        // ignore
      } finally {
        playerRef.current = null;
      }
    };
  }, [src]);

  return (
    <div className={wrapperClassName} style={{ maxHeight: "100%" }}>
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        playsInline
        webkit-playsinline="true"
        preload="metadata"
        controls={false}
        aria-label={title ?? "Video preview"}
      />

      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-10 w-10 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        </div>
      )}

      {ready && started && buffering && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-12 w-12 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        </div>
      )}
    </div>
  );
}
