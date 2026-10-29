import React, { useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import gsap from 'gsap';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/dm-sans/400.css';
import { moments, MOMENT_COUNT } from './moments';
import { artDirection } from './art-direction';
import { getPlaybackPosition } from './playback';
import { createLiquidCinema } from './liquid-cinema';
import { liquidLetterPose } from './liquid-lettering';
import { wordEffect, overdrivePose, glyphPose } from './word-overdrive';
import { getFrameTime } from './video-frame';
import { watchPresentedFrames } from './presented-frame';
import { loadSeekableVideo } from './seekable-video';
import './style.css';

type Phase = 'idle' | 'starting' | 'playing' | 'paused' | 'ended';

function FilmText({ text }: { text: string }) {
  return <>{text.split('\n').map((line, lineIndex) => <span className="line-mask" key={lineIndex}><span className="text-line">{line.split(' ').map((unit, index) => <React.Fragment key={index}><span className="motion-unit"><span className="word-ink">{Array.from(unit).map((glyph, glyphIndex) => <span className="liquid-glyph" key={glyphIndex}>{glyph === ' ' ? '\u00a0' : glyph}</span>)}</span><span className="ribbon-echo" aria-hidden="true">{unit}</span></span>{index < line.split(' ').length - 1 ? ' ' : ''}</React.Fragment>)}</span></span>)}</>;
}

function App() {
  const story = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const controller = useRef<{ play: (restart?: boolean) => void; pause: () => void } | null>(null);
  const phaseRef = useRef<Phase>('idle');
  const [phase, setPhase] = useState<Phase>('idle');
  const [playError, setPlayError] = useState<string | null>(null);
  const [manualMoved, setManualMoved] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [mobileAsset] = useState(() => matchMedia('(max-width: 600px)').matches);
  const [mediaSource, setMediaSource] = useState<string>();
  const [mediaAttempt, setMediaAttempt] = useState(0);

  useLayoutEffect(() => {
    const abort = new AbortController();
    let objectUrl: string | undefined;
    setMediaSource(undefined);
    setReady(false);
    setError(false);
    loadSeekableVideo(mobileAsset ? '/film-mobile.mp4' : '/film.mp4', abort.signal)
      .then(url => {
        if (abort.signal.aborted) { URL.revokeObjectURL(url); return; }
        objectUrl = url;
        setMediaSource(url);
      })
      .catch(() => { if (!abort.signal.aborted) setError(true); });
    return () => {
      abort.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mobileAsset, mediaAttempt]);

  useLayoutEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(preference.matches);
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useLayoutEffect(() => {
    const root = story.current;
    const media = video.current;
    if (!root || !media) return;

    // Scroll is the default clock; native playback temporarily takes over on request.
    const lenis = reduced ? null : new Lenis({ autoRaf: false, smoothWheel: true, lerp: .065, wheelMultiplier: .8 });
    let renderPlayback = () => {};
    let renderManual = () => {};
    const tick = (seconds: number) => { lenis?.raf(seconds * 1000); if (phaseRef.current === 'playing') renderPlayback(); else if (phaseRef.current !== 'starting') renderManual(); };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    if (lenis) document.documentElement.dataset.scrollEngine = 'lenis';
    let active = true;
    let command = 0;
    const changePhase = (value: Phase) => { phaseRef.current = value; setPhase(value); };
    changePhase(media.currentTime > 0 ? 'paused' : 'idle');
    let pauseExperience = () => {};

    const keyboardScroll = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey) return;
      if (event.key === 'Escape' && phaseRef.current === 'playing') { event.preventDefault(); pauseExperience(); }
      if (event.target instanceof HTMLElement && event.target.closest('button, input, textarea, select, a, [contenteditable="true"]')) return;
      const steps: Record<string, number> = { ArrowDown: 120, ArrowUp: -120, PageDown: innerHeight * .85, PageUp: -innerHeight * .85, ' ': innerHeight * .85 * (event.shiftKey ? -1 : 1) };
      if (event.key in steps || event.key === 'Home' || event.key === 'End') {
        if (phaseRef.current === 'playing' || phaseRef.current === 'starting') pauseExperience();
        if (lenis) {
          event.preventDefault();
          lenis.scrollTo(event.key === 'Home' ? 0 : event.key === 'End' ? lenis.limit : lenis.targetScroll + steps[event.key]);
        }
      }
    };
    window.addEventListener('keydown', keyboardScroll);

    let lastMoment = -1;
    let presentedTime = media.currentTime;
    let renderPresented = () => {};
    const stopFrameClock = watchPresentedFrames(media, time => {
      presentedTime = time;
      renderPresented();
    });
    media.pause();
    media.muted = true;
    media.playbackRate = 1;
    const liquidHost = root.querySelector<HTMLElement>('.liquid-cinema')!;
    const liquid = reduced ? null : createLiquidCinema(liquidHost, matchMedia('(max-width: 767px)').matches);
    let scrollStart = root.offsetTop;
    let scrollRange = Math.max(0, root.offsetHeight - innerHeight);
    const resize = () => { scrollStart = root.offsetTop; scrollRange = Math.max(0, root.offsetHeight - innerHeight); lenis?.resize(); if (phaseRef.current === 'playing') renderPlayback(); else renderManual(); };
    window.addEventListener('resize', resize);
    let sequence: gsap.core.Timeline;

    const context = gsap.context(() => {
      const captions = gsap.utils.toArray<HTMLElement>('.caption', root);
      const echoes = gsap.utils.toArray<HTMLElement>('.film-echo', root);
      const frameWindow = root.querySelector<HTMLElement>('.film-window')!;
      const filmPlane = root.querySelector<HTMLElement>('.film-plane')!;
      const atmosphere = gsap.utils.toArray<HTMLElement>('.atmosphere-plate', root);
      gsap.set(captions, { autoAlpha: 0 });
      gsap.set(echoes, { autoAlpha: 0 });
      const frameSize = { x: artDirection[0].frameX as number, y: artDirection[0].frameY as number };
      gsap.set(frameWindow, { scaleX: frameSize.x, scaleY: frameSize.y });
      gsap.set(filmPlane, { scaleX: 1 / frameSize.x, scaleY: 1 / frameSize.y });
      const windowX = gsap.quickSetter(frameWindow, 'scaleX');
      const windowY = gsap.quickSetter(frameWindow, 'scaleY');
      const planeX = gsap.quickSetter(filmPlane, 'scaleX');
      const planeY = gsap.quickSetter(filmPlane, 'scaleY');
      const renderFrame = () => {
        windowX(frameSize.x); windowY(frameSize.y);
        // Counter-scaling makes this a crop, never a stretched picture.
        planeX(1 / frameSize.x); planeY(1 / frameSize.y);
      };
      const playhead = { progress: 0 };
      sequence = gsap.timeline({ paused: true });
      sequence.to(playhead, {
        progress: 1, duration: MOMENT_COUNT, ease: 'none',
        onUpdate: () => {
          const frame = getPlaybackPosition(playhead.progress, 1);
          if (frame.chapter !== lastMoment) {
            lastMoment = frame.chapter;
            root.dataset.moment = String(frame.chapter + 1);
            media.style.objectPosition = `${moments[frame.chapter].focus}% center`;
          }
        },
      }, 0);
      if (!reduced) {
        sequence.fromTo(atmosphere[0], { xPercent: -2, scale: 1.08 }, { xPercent: 2, scale: 1.14, duration: 20, ease: 'none' }, 0);
        sequence.fromTo(atmosphere[1], { opacity: 0, xPercent: 2, scale: 1.12 }, { opacity: 1, xPercent: -2, scale: 1.06, duration: 5, ease: 'sine.inOut' }, 6);
        sequence.fromTo(atmosphere[2], { opacity: 0, yPercent: 2, scale: 1.12 }, { opacity: 1, yPercent: -2, scale: 1.06, duration: 5, ease: 'sine.inOut' }, 13);
      }
      if (!reduced) {
        sequence.fromTo(media, { scale: 1.015 }, { scale: 1.055, duration: 10, ease: 'none' }, 0);
        sequence.to(media, { scale: 1.015, duration: 10, ease: 'none' }, 10);
      }

      captions.forEach((caption, index) => {
        const scene = moments[index];
        const directionArt = artDirection[index];
        const units = caption.querySelectorAll('.motion-unit');
        const lines = caption.querySelectorAll('.text-line');
        const note = caption.querySelectorAll('.scene-note');
        const direction = scene.layout.includes('right') || scene.layout === 'right' ? -1 : 1;
        const quiet = scene.layout.includes('whisper') || scene.layout === 'subtitle';
        const flying = scene.layout === 'sky';
        const split = directionArt.composition === 'split';
        const falling = directionArt.composition === 'fall';
        const horizontal = directionArt.composition === 'sweep' || directionArt.composition === 'horizon';
        const closing = directionArt.composition === 'outro';
        if (reduced) {
          sequence.set(caption, { autoAlpha: 1 }, index);
          sequence.set(caption.querySelectorAll('.motion-unit, .text-line, .liquid-glyph, .scene-note'), { opacity: 1, x: 0, y: 0, yPercent: 0, rotation: 0, rotationX: 0, skewX: 0, scale: 1, scaleX: 1, scaleY: 1 }, index);
          if (index < MOMENT_COUNT - 1) sequence.set(caption, { autoAlpha: 0 }, index + .999);
          return;
        }
        sequence.to(frameSize, {
          x: () => innerWidth <= 600 ? Math.max(.9, directionArt.frameX) : directionArt.frameX,
          y: () => innerWidth <= 600 ? Math.max(.78, directionArt.frameY) : directionArt.frameY,
          duration: .42, ease: 'power2.inOut', onUpdate: renderFrame,
        }, index);
        if (directionArt.echo) {
          const echo = echoes[index];
          sequence.fromTo(echo, { autoAlpha: 0, xPercent: -8, scale: 1.12 }, { autoAlpha: .3, xPercent: 0, scale: 1, duration: .4, ease: 'power2.out' }, index + .03);
          sequence.to(echo, { autoAlpha: 0, xPercent: 8, duration: .2, ease: 'power2.in' }, index + .77);
        }
        sequence.set(caption, { autoAlpha: 1 }, index);

        if (index === 0) {
          sequence.fromTo(units, { yPercent: 0, opacity: 1 }, { yPercent: -4, duration: 0.68, stagger: 0.025, ease: 'none' }, 0);
          sequence.fromTo(note, { opacity: 1 }, { opacity: 0, duration: 0.12 }, 0.87);
        } else {
          Array.from(units).forEach((unit, wordIndex) => {
            const mobile = innerWidth <= 600;
            const effect = wordEffect(unit.querySelector('.word-ink')?.textContent || '');
            unit.setAttribute('data-effect', effect);
            const pose = overdrivePose(effect, wordIndex, units.length, mobile);
            const order = closing ? Math.abs(wordIndex - (units.length - 1) / 2) / Math.max(1, units.length / 2) : wordIndex / Math.max(1, units.length - 1);
            const delay = order * .065;
            const side = wordIndex % 2 ? -1 : 1;
            const arrival = index + .015 + delay;
            sequence.fromTo(unit, pose, {
              x: 0, yPercent: 0, rotation: 0, rotationX: 0, rotationY: 0,
              scaleX: 1, scaleY: 1, skewX: 0, opacity: 1,
              duration: .32, ease: effect === 'impact' ? 'back.out(1.12)' : effect === 'breathe' ? 'sine.out' : 'power3.out',
            }, arrival);
            const glyphs = unit.querySelectorAll('.liquid-glyph');
            Array.from(glyphs).forEach((glyph, glyphIndex) => {
              const letterPose = effect === 'ribbon' ? { ...glyphPose(effect, glyphIndex, glyphs.length, mobile), ...liquidLetterPose(glyphIndex, glyphs.length, mobile) } : glyphPose(effect, glyphIndex, glyphs.length, mobile);
              sequence.fromTo(glyph, letterPose, {
                x: 0, yPercent: 0, rotation: 0, rotationY: 0, skewX: 0, scaleX: 1, scaleY: 1,
                duration: .26, ease: 'sine.out',
              }, arrival + (effect === 'resolve' ? Math.abs(glyphIndex - (glyphs.length - 1) / 2) / Math.max(1, glyphs.length / 2) : glyphIndex / Math.max(1, glyphs.length - 1)) * .055);
            });
            const echo = unit.querySelector('.ribbon-echo');
            sequence.fromTo(echo, { opacity: effect === 'ribbon' ? (mobile ? .08 : .2) : 0, x: side * -14, y: 9, scaleX: 1.14, skewX: side * -12 }, {
              opacity: 0, x: 0, y: 0, scaleX: 1, skewX: 0, duration: .28, ease: 'power2.out',
            }, arrival);
          });
          sequence.fromTo(note, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.15 }, index + 0.2);
        }

        // Different lines move in opposing planes, following the pursuit and the leaps.
        lines.forEach((line, lineIndex) => {
          const polarity = lineIndex % 2 ? -1 : 1;
          sequence.fromTo(line, { x: split ? polarity * -65 : 0, y: 0, rotation: 0 }, {
            x: split ? polarity * 28 : falling ? polarity * 24 : flying ? (lineIndex % 2 ? 20 : -10) : quiet ? direction * -12 : polarity * 12,
            y: falling ? lineIndex * 12 : flying ? -26 : quiet ? -8 : 0,
            rotation: falling ? polarity * -3 : 0,
            duration: 0.3, ease: 'power2.out',
          }, index + 0.08);
        });
        if (index < MOMENT_COUNT - 1) {
          Array.from(units).forEach((unit, wordIndex) => {
            const mobile = innerWidth <= 600;
            const side = wordIndex % 2 ? -1 : 1;
            const effect = wordEffect(unit.querySelector('.word-ink')?.textContent || '');
            sequence.to(unit, {
              scaleX: effect === 'ribbon' ? (mobile ? 1.09 : 1.2) : effect === 'unfold' ? .35 : effect === 'breathe' ? .96 : 1,
              scaleY: effect === 'ribbon' ? (mobile ? .82 : .62) : effect === 'sink' ? .3 : 1,
              skewX: effect === 'ribbon' ? side * (mobile ? -6 : -12) : 0,
              duration: .15, ease: 'sine.in',
            }, index + .825);
            const glyphs = unit.querySelectorAll('.liquid-glyph');
            Array.from(glyphs).forEach((glyph, glyphIndex) => {
              const wave = effect === 'ribbon' ? liquidLetterPose(glyphIndex, glyphs.length, mobile) : glyphPose(effect, glyphIndex, glyphs.length, mobile);
              sequence.to(glyph, {
                yPercent: effect === 'fracture' ? wave.yPercent : -wave.yPercent,
                rotation: -wave.rotation,
                x: effect === 'fracture' ? glyphPose(effect, glyphIndex, glyphs.length, mobile).x * 1.4 : 0,
                duration: .12, ease: 'sine.inOut',
              }, index + .825 + glyphIndex / Math.max(1, glyphs.length - 1) * .035);
            });
          });
          const effectOf = (element: Element) => wordEffect(element.querySelector('.word-ink')?.textContent || '');
          sequence.to(units, {
            yPercent: (_i: number, element: Element) => {
              const effect = effectOf(element);
              return effect === 'rise' ? -100 : effect === 'gravity' ? 95 : effect === 'sink' ? 35 : effect === 'breathe' ? 0 : -25;
            },
            x: (_i: number, element: Element) => effectOf(element) === 'sweep' ? 65 : 0,
            rotation: 0,
            rotationX: (_i: number, element: Element) => effectOf(element) === 'hinge' ? 60 : 0,
            opacity: 0, duration: .14,
            stagger: { amount: .03, from: 'start' }, ease: 'power2.inOut',
          }, index + .825);
          sequence.to(note, { opacity: 0, duration: 0.1 }, index + 0.88);
          sequence.set(caption, { autoAlpha: 0 }, index + 0.999);
        }
      });
      if (reduced) { gsap.set(frameWindow, { scaleX: 1, scaleY: 1 }); gsap.set(filmPlane, { scaleX: 1, scaleY: 1 }); sequence.pause(); }
      if (sequence.progress() === 0) gsap.set(captions[0], { autoAlpha: 1 });
    }, root);

    renderPlayback = () => {
      const position = getPlaybackPosition(media.currentTime, media.duration);
      renderPresented();
      if (lenis) lenis.scrollTo(scrollStart + scrollRange * position.progress, { immediate: true, force: true });
    };
    let lastPresentedTime = -1;
    renderPresented = () => {
      if (presentedTime === lastPresentedTime) return;
      lastPresentedTime = presentedTime;
      const position = getPlaybackPosition(presentedTime, media.duration);
      sequence.progress(position.progress);
      liquid?.render(presentedTime, media.duration);
      root.dataset.presentedTime = String(presentedTime);
    };
    let lastScrollProgress = -1;
    let targetFrame = 0;
    let previousMoved = false;
    renderManual = () => {
      if (reduced && (phaseRef.current === 'paused' || phaseRef.current === 'ended')) return;
      const progress = scrollRange > 0 ? Math.max(0, Math.min(1, (scrollY - scrollStart) / scrollRange)) : 0;
      targetFrame = getFrameTime(progress * media.duration, media.duration);
      if (progress !== lastScrollProgress) {
        if (phaseRef.current === 'paused' || phaseRef.current === 'ended') changePhase('idle');
        lastScrollProgress = progress;
        const moved = progress > .025 && progress < .975;
        if (moved !== previousMoved) { previousMoved = moved; setManualMoved(moved); }
      }
      renderPresented();
      if (media.readyState >= 2 && !media.seeking && Math.round(media.currentTime * 24) !== Math.round(targetFrame * 24)) media.currentTime = targetFrame;
    };
    if (reduced && media.currentTime > 0) renderPlayback();
    else renderManual();
    pauseExperience = () => {
      ++command;
      media.pause();
      renderPlayback();
      lastScrollProgress = scrollRange > 0 ? Math.max(0, Math.min(1, (scrollY - scrollStart) / scrollRange)) : 0;
      lenis?.start();
      changePhase('paused');
    };
    controller.current = {
      pause: pauseExperience,
      play: (restart = false) => {
        const ticket = ++command;
        setPlayError(null);
        lenis?.stop();
        if (restart || media.ended) { media.currentTime = 0; presentedTime = 0; renderPlayback(); }
        media.playbackRate = 1;
        changePhase('starting');
        media.play().then(() => {
          if (active && ticket === command) changePhase('playing');
        }).catch(() => {
          if (active && ticket === command) { lenis?.start(); setPlayError('Playback could not start. Please try again.'); changePhase('paused'); }
        });
      },
    };
    const ended = () => { renderPlayback(); lastScrollProgress = 1; lenis?.start(); setManualMoved(false); changePhase('ended'); };
    const paused = () => { if (active && phaseRef.current === 'playing' && !media.ended) pauseExperience(); };
    const takeControl = () => { if (phaseRef.current === 'playing' || phaseRef.current === 'starting') pauseExperience(); };
    const loaded = () => { if (phaseRef.current !== 'playing' && phaseRef.current !== 'starting') { lastScrollProgress = -1; renderManual(); } };
    window.addEventListener('wheel', takeControl, { passive: true, capture: true });
    window.addEventListener('touchstart', takeControl, { passive: true, capture: true });
    media.addEventListener('loadeddata', loaded);
    media.addEventListener('ended', ended);
    media.addEventListener('pause', paused);

    const visibility = () => {
      if (document.hidden) { if (phaseRef.current === 'playing' || phaseRef.current === 'starting') pauseExperience(); gsap.ticker.remove(tick); }
      else { gsap.ticker.add(tick); resize(); }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      active = false;
      ++command;
      controller.current = null;
      stopFrameClock();
      media.pause();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('keydown', keyboardScroll);
      gsap.ticker.remove(tick);
      lenis?.destroy();
      liquid?.destroy();
      context.revert();
      window.removeEventListener('resize', resize);
      media.removeEventListener('ended', ended);
      media.removeEventListener('pause', paused);
      media.removeEventListener('loadeddata', loaded);
      window.removeEventListener('wheel', takeControl, true);
      window.removeEventListener('touchstart', takeControl, true);
      delete document.documentElement.dataset.scrollEngine;
      gsap.ticker.lagSmoothing(500, 33);
    };
  }, [reduced]);

  return <main className={`experience phase-${phase}`}>
    <section ref={story} className={`story ${reduced ? 'motion-reduced' : ''}`} data-moment="1" aria-label="The Last Paw, scroll or play an automatic film in 20 moments">
      <div className="film-stage">
        <div className="atmosphere" aria-hidden="true"><div className="atmosphere-plate reeds"/><div className="atmosphere-plate water"/><div className="atmosphere-plate river"/></div>
        <div className="liquid-cinema" aria-hidden="true" />
        <div className="echo-field" aria-hidden="true">{artDirection.map((direction, index) => <span className="film-echo" key={index}>{direction.echo}</span>)}</div>
        <div className="film-window"><div className="film-plane">
          <video ref={video} className="film" src={mediaSource} poster="/poster.jpg" preload="auto" muted playsInline disablePictureInPicture width="1278" height="720" aria-hidden="true" onLoadStart={() => { setReady(false); setError(false); }} onLoadedData={() => { setReady(true); setError(false); }} onError={() => { setError(true); controller.current?.pause(); }} />
          <div className="film-shade" aria-hidden="true" />
        </div></div>
        <div className="captions">
          {moments.map((scene, index) => <article className={`caption ${scene.layout} art-${artDirection[index].composition}`} key={scene.name} data-caption={index + 1} aria-hidden="true">
            {index === 0 ? <h1><FilmText text={scene.title} /></h1> : <h2><FilmText text={scene.title} /></h2>}
            {scene.line && <p className="scene-note">{scene.line}</p>}
          </article>)}
        </div>
        {!error && phase !== 'playing' && (!manualMoved || phase !== 'idle') && <div className="experience-controls">
          <button className="start-button" disabled={!ready || phase === 'starting'} onClick={() => controller.current?.play(phase === 'ended')}>{!ready ? 'Preparing the film…' : phase === 'starting' ? 'Starting…' : phase === 'ended' ? 'Replay experience' : phase === 'paused' ? 'Resume experience' : 'Start experience'}</button>
          {phase === 'paused' && ready && <button className="restart-button" onClick={() => controller.current?.play(true)}>Restart</button>}
          <p>{playError || (phase === 'paused' ? 'Scroll to explore, or resume automatic playback.' : phase === 'ended' ? 'Scroll back to explore, or replay.' : 'Scroll to explore. Or start automatic playback.')}</p>
        </div>}
        {phase === 'playing' && <button className="pause-surface" aria-label="Pause experience" onClick={() => controller.current?.pause()}><span>Pause experience</span></button>}
        {error && <div className="film-status" role="alert"><p>The film could not load.</p><button onClick={() => setMediaAttempt(attempt => attempt + 1)}>Try the film again</button></div>}
      </div>
    </section>
    <div className="accessible-story"><h1>The Last Paw</h1>{moments.map(scene => <section key={scene.name}><h2>{scene.title.replace('\n', ' ')}</h2>{scene.line && <p>{scene.line}</p>}</section>)}</div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
