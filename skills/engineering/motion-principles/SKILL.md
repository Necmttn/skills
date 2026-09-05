---
name: motion-principles
description: Apply the twelve classic animation principles (squash and stretch, anticipation, staging, pose to pose, follow through, slow in slow out, arcs, secondary action, timing, exaggeration, solid drawing, appeal) as a vocabulary and rule set for UI motion. Use when designing, implementing, or critiquing any interface animation - transitions, springs, easing curves, staggered lists, loaders, error shakes, morphing icons, sheet/panel choreography, widget or Live Activity motion - or when the user asks "why does this animation feel off", wants motion added to a screen, or wants an animation review.
---

# Motion Principles

The twelve principles are Disney-era animation vocabulary (Frank Thomas & Ollie
Johnston, *The Illusion of Life*, 1930s-80s) that transfer surprisingly well to
interface motion. The UI mapping here is our own distillation, informed by
Raphael Salaja's essay ["12 Principles of Animation"](https://www.raphaelsalaja.com/library/12-principles-of-animation)
(read it for the interactive demos - Family's wallet icon picker, Dia's split
tabs, Apple's Dynamic Island, and per-curve easing visualizations). The essay
is copyrighted, so it is linked, not vendored; this file states our rules in
our own words.

Governing idea: animation is communication, not decoration. The end state to
aim for: users report "smooth", never "animated". Both failure modes are real -
sterile/jarring on one side, showy/sluggish on the other.

## The vocabulary, with UI rules

### 1. Squash & Stretch - weight and material

- **Trigger:** press states, icon morphs, drag-and-drop, playful brand moments.
- **Rule:** subtle scale deformation tells the user an element is physical and
  responsive. Keep it barely perceptible in product UI; visible squash reads
  cartoon and belongs on marketing surfaces.

### 2. Anticipation - telegraph before the event

- **Trigger:** destructive holds (hold-to-delete), incoming updates, state
  changes the user did not initiate.
- **Rule:** a small preparatory cue sets the expectation for what comes next.
  Reserve it for significant transitions - anticipation on routine actions
  reads gimmicky and makes the UI feel slower than it is.

### 3. Staging - one focal motion at a time

- **Trigger:** sheets, panels, modals, any composite transition.
- **Rule:** sequence the choreography (backdrop, then surface, then primary
  control) so attention lands where the interaction continues. Never animate
  many peers simultaneously; simultaneous motion is noise.

### 4. Pose to Pose - design key states, let interpolation work

- **Trigger:** every state transition.
- **Rule:** UI motion is pose-to-pose by nature: define the key states and let
  easing/springs interpolate. Corollary - frequency gates animation: surfaces
  used dozens of times per session (context menus, keyboards, tab switches)
  animate minimally or not at all.

### 5. Follow Through & Overlapping Action - settle and stagger

- **Trigger:** list/grid entrances, multi-element reveals, spring settles.
- **Rule:** cascaded per-item delays read as alive; a single block reveal reads
  as a repaint. Cap the total stagger - by the last item the user is already
  waiting, and accumulated delay reads as lag.

### 6. Slow In & Slow Out - never linear

- **Trigger:** any spatial motion.
- **Rule:** linear position change looks mechanical. Standardize a small set of
  curves and reuse them; on Apple platforms prefer springs (WWDC23 "Animate
  with Springs") - spring response/damping is our native easing. Curve
  reference: easing.dev.

### 7. Arcs - curved paths are organic, and rarely worth it in product UX

- **Trigger:** large transitions, hero moments, marketing pages.
- **Rule:** straight-line slides are correct for almost all product UI; arcs
  earn their cost only on showpiece transitions (Dynamic Island class). Treat
  an arc as a deliberate exception, not a default.

### 8. Secondary Action - one supporting flourish

- **Trigger:** success/failure feedback moments.
- **Rule:** one reinforcing accent - a particle, a haptic, a sound cue (our
  cues kit, `packages/swift` AppFoundation, PR #1170) - attached to the primary
  action. It supports; it never competes. Two flourishes is one too many.

### 9. Timing - duration is personality

- **Trigger:** every animation you write.
- **Rule:** under ~300ms for routine interactions; tooltips and hovers nearer
  ~150ms; longer only for spatial reorientation. Define shared duration/spring
  tokens once per app and reuse them - coherence beats per-screen tuning.

### 10. Exaggeration - amplify only feedback

- **Trigger:** error states, confirmations, onboarding beats, empty states.
- **Rule:** past-realism motion (error shake, oversized checkmark) buys clarity
  at emotional moments. Routine navigation never exaggerates.

### 11. Solid Drawing - dimensional consistency

- **Trigger:** 3D-ish effects: perspective tilts, rotating icons, stacked cards,
  parallax.
- **Rule:** if an element implies volume, it must keep that volume through the
  whole motion (consistent perspective, shadow, layering). An icon that goes
  flat mid-rotation breaks the illusion worse than never rotating.

### 12. Appeal - the invisibility test

- **Trigger:** final review of any motion work.
- **Rule:** great interface animation is nearly invisible. If a tester mentions
  an animation unprompted, it is either a showpiece (fine, if chosen) or a bug.

## House rules that extend the twelve

- **CLOCK RULE (ours, lockin motion lab):** inside `TimelineView`, animate off
  `timeline.date`, never a captured `value.time` - mixing clocks skews phase
  between elements. Verified in the lockin motion lab before it was retired.
- **Design law wins:** per-app DESIGN.md constraints (e.g. Lock In Chinese
  "zero hairlines, no shadows in light mode") override any generic motion
  advice, including this file.
- **Extensions stay still:** widgets and app extensions get system-driven
  transitions only; they never run custom animation loops (battery + the
  extension-never-emits discipline).

## Review protocol

When critiquing a screen's motion, report findings as
**principle -> violation -> concrete fix**, same shape as the ux-psychology
skill. Example: "Staging - backdrop, sheet, and toolbar all animate at once ->
stagger: backdrop 0-100ms, sheet spring after, toolbar fade last."
