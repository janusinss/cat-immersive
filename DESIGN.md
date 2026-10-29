# Visual direction

Experience mode. A kinetic film-poster composition built from the supplied footage and typography alone. Monumental cool-white lettering crosses the edge of a breathing film frame. Charcoal and silver-mist negative space replaces the green surround. Quiet editorial pauses make the action feel larger. No external imagery.

Typography: locally served Barlow Condensed 500/600 for display, DM Sans 400 for notes and controls. Canvas #101216, ink #f2f3f4, muted #c2c8d0, accent #d4deeb. Text shadows and film shading use cool charcoal rather than green.

The surround uses 3 grayscale, softly blurred plates derived from VIDEO.mp4 at 1.5, 19, and 26 seconds (reeds, water, river). Their total size is about 6.5KB. Blur is baked into the images; playback animates only transform and opacity. Plate crossfades at timeline units 6 and 13 bring a restrained silver light around the film. Overscan prevents edge exposure. Reduced motion retains only the first static plate.

## Liquid cinema Overdrive

User-selected direction: silver-water refractions behind the film, with pulse energy at the airborne moments. Desktop uses a lightweight WebGL1 analytic water shader, capped at 640 render pixels wide and 45 updates per second, without altering the video or lettering. It consumes the existing media clock instead of creating a second animation loop. Render calls stop when playback pauses or the page is hidden.

Mobile uses 14 low-opacity Canvas2D water contours at a maximum 540 pixels wide and 30 updates per second. Slower desktop timing switches to pre-rendered water contours with compositor-only drift, avoiding repeated canvas redraws. GPU setup failure or context loss exposes the existing atmosphere plates. Reduced motion initializes no liquid renderer. Teardown deletes GPU resources, listeners, and canvases. All effects remain decorative and pointer-transparent.

Local headless Chromium timing did not establish a 60fps guarantee. Physical-device and Safari performance remain unverified; automatic fallback limits additional rendering cost.

## Liquid lettering Overdrive

User-selected direction: flowing ribbon lettering that resolves into crisp type. Every word contains individually animated glyphs plus one faint outlined wake. Entrances stretch the word horizontally and compress it vertically while a bounded sine wave travels through the letters; skew and rotation resolve to neutral. Staggers finish by about 40% of each moment. The readable middle has no glyph distortion or visible wake. Exits briefly stretch and release the letters into the next shot.

Mobile halves glyph deformation, reduces word stretch, and lowers echo opacity. Reduced motion hides echoes and resets word/glyph transforms. No SVG distortion filters, full-screen blur, extra animation loops, or video-rate changes are introduced. All lettering remains on the existing media-driven GSAP timeline.

## Word-specific Overdrive

The ribbon treatment is now limited to WATER, REEDS, and related flow words. Each keyword selects its own motion family: UP/ABOVE/LEAP rise, LOW/STAY compress, LINES/STRAIGHT/BREAKS fracture, ALONE/NOT turn through depth, BREATHE/STILLNESS settle gently, LET/GO release under gravity, LANDING/PAWS/STANDING land, ACROSS/REACH sweep, OPEN/GAP/FIND unfold, CLOSE/TOO hinge, and ONWARD resolves from the center. Neutral connector words gather quietly.

Word containers remain intact for semantic effect selection; individual glyphs supply secondary motion. All 13 families settle before the readable hold. Exits follow the same meaning rather than sharing one liquid stretch. Outline wakes appear only on ribbon words. Mobile travel is reduced, and reduced motion bypasses every spatial effect.

## Playback and pacing

Manual scrolling is the default. Lenis smooths wheel input; linear page progress requests a serialized, 24fps frame-aligned video seek. Text, framing, and liquid effects follow the frame actually displayed via requestVideoFrameCallback metadata; pending seek targets never advance the artwork ahead of the film. Browsers without frame callbacks use completed-seek/media events. Latest scroll targets coalesce while a seek is in flight.

The Start experience button is optional and transfers clock ownership to native HTML video playback at playbackRate 1. Actual media time drives automatic page position through the 3700svh stage; presented frames drive the visual timeline. Automatic mode never seeks or eases video playback. It runs about 30.2 seconds through 20 moments. Wheel, touch, scroll keys, Escape, or tapping the film release control back to manual scrolling at the current position.

During automatic playback, only the film and text appear. The full film is an invisible, accessible pause target. Resume/Restart appear on pause; the initial Start option disappears during manual exploration. Hidden-page transitions pause playback and restore manual input. Promise failures produce visible retry feedback without locking scrolling.

## Art direction

Four main set pieces define the journey: an opening poster with opposing title lines; split pursuit typography; a falling LET / GO composition around the leap; and a large closing title over a smaller film frame. Quiet scenes use small notes and oversized outlined echoes behind the film. GSAP reveals words and letters with masked lifts, hinged arrivals, opposing line drift, and shot-specific departures. Text settles by about 38% of each moment and holds until 86%; masks accommodate the line transforms without clipping.

Each of the 20 moments has a curated word-motion profile: soft gather, alternating crosswind, 3D hinge, duck, lift, float, breath, slip, light landing, fall, ripple, or center-out resolution. Individual words and selected letters stagger within a bounded 0.1 timeline-unit window. Every entrance settles by 42%, holding until 82.5%, before a coordinated departure finishes by 99.5%. Mobile horizontal travel is reduced to 65%. Transform and opacity animation avoids blur filters and layout changes. Local perspective supplies depth; reduced motion bypasses these profiles entirely.

Quiet moments now use bold, condensed film typography instead of small prose. Phrases include IN THE / REEDS, ABOVE / IT ALL, BREATHE, FIND / THE GAP, ACROSS, OPEN / WATER, and STILLNESS. Two-line compositions alternate solid and outlined lettering; single-word horizon scenes form broad titles across the lower frame. Desktop and mobile sizes use viewport-relative scales with short-screen height caps. Secondary narrative notes are removed from the film; only functional Start/pause guidance remains small outside playback.

The film window expands during action and contracts during pauses. Its child plane uses reciprocal transforms, preserving source proportions while changing the crop. Mobile uses gentler framing. Both video assets use independently decodable H.264 frames for responsive seeking: desktop retains 1278x720 (14.2MB), mobile uses 854x480 (8.3MB). This increases transfer size to reduce decoding latency. Both use fast-start metadata and retain 24fps. The original VIDEO.mp4 remains intact.

Local fast-scroll audit, 100 samples: previous desktop median displayed-frame lag 0.87s, p95 1.54s, and 58 text/video chapter disagreements. With seek-friendly assets and the presented-frame clock: median about 0.22s, desktop p95 0.44s, and zero chapter disagreements; mobile p95 0.23s. This measures local Chromium behavior, not a physical-device guarantee.

## Accessibility

Reduced motion still offers explicit Start and native 1x video playback, but removes Lenis, automatic page movement, camera scaling, and spatial text animation. Captions change without spatial movement in one viewport. A complete screen-reader transcript remains available. Focused playback controls have visible focus rings; all buttons meet the 44px target minimum.
