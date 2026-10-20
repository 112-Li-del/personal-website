# Rig architecture

This is the part that actually fixes "agents draw bad stickmen." Read this
before touching the math in `assets/starter.html`. Every claim below was
verified by rendering the rig headlessly and checking pixel/coordinate
output — not just eyeballed — while building this skill; the specific bugs
mentioned were real bugs that produced visibly broken figures, kept here so
nobody reintroduces them.

## The core idea

A stickman is not a drawing, it is a **skeleton**: a small, fixed set of
bones (torso, neck, 2× upper arm, 2× forearm, 2× thigh, 2× shin, 2× foot)
connected at joints. The bone *lengths* never change. Only the *angles*
change, frame to frame. An agent that reasons about "rotate the elbow 20°"
cannot draw an anatomically broken arm. An agent that reasons about "draw a
line from (412, 350) to (480, 290)" absolutely can, and reliably does,
because there is nothing tying that line's length to the forearm two frames
earlier.

This rig has two halves, deliberately using different math because they
solve different problems:

| Part | Method | Why |
|---|---|---|
| Torso, head, neck, arms | **Forward kinematics (FK)** — you set an angle, the chain follows | Arms move freely in space; there is no external constraint to satisfy |
| Legs | **Inverse kinematics (IK)** — you set a foot *target point*, the rig solves the angles | Feet must land on a specific point (the ground) or they float/slide — the single most common tell of an AI-generated walk cycle |

## Angle convention

All angles are degrees, and every bone is either "down-reference" or
"up-reference":

- **Down-reference** (arms, legs): `0°` points straight down. `+90°`
  points toward `+X` (screen right when `facing = 1`). `-90°` points
  toward `-X`.
- **Up-reference** (torso, neck): `0°` points straight up. Same sign rule.

```
downVec(angle, len, facing) = { dx: facing*len*sin(angle), dy: len*cos(angle) }
upVec(angle, len, facing)   = { dx: facing*len*sin(angle), dy: -len*cos(angle) }
```

Elbow and knee bends are **relative** to their parent bone:
`child_absolute_angle = parent_absolute_angle + bend`. This is why posing
the upper arm never requires recomputing the forearm — you only ever add a
bend on top of whatever the parent is doing. `chain2()` in the starter
implements exactly this composition for a 2-bone FK chain.

## Forward kinematics (arms, torso, head)

Straightforward: walk the chain, adding each bone's vector to the running
position. See `chain2()` and the arm/torso/head block inside `render()`.
Nothing here is subtle — the subtlety is all in the legs.

## Inverse kinematics (legs) — the 2-bone solver

Given a hip position and a **target point** for the ankle, `solveLegIK()`
returns the thigh angle and knee bend that reach it exactly, using the
standard law-of-cosines 2-bone solver:

```
d  = distance(hip, target)               // clamped to [|L1-L2|, L1+L2]
angleToFoot = atan2(dx, dy)               // down-reference angle to target
B  = acos((L1² + d² - L2²) / (2·L1·d))    // angle at hip, between thigh and hip→target line
C  = acos((L1² + L2² - d²) / (2·L1·L2))   // interior angle at the knee

thighAngle = angleToFoot - kneeSign·B     // NOTE: subtract, not add
kneeBend   = kneeSign·(180° - C)
```

**The sign matters and is easy to get backwards.** An earlier version of
this rig added `B` instead of subtracting it; the formula still "ran"
(no NaN, no crash) but placed the knee on the wrong side of the hip→target
line, folding the leg up and backward instead of down toward the ground —
visually, a collapsed/kneeling shape no matter what target you gave it. The
fix was verified by picking a target, solving by hand with a second
independent method (placing the knee directly from a chosen thigh angle and
checking the resulting shin reaches the target within floating-point
tolerance), and matching that against the formula's output. If you modify
this solver, re-verify the same way — a sign error here does not throw, it
just quietly produces a "broken doll" pose that still has valid numbers.

`kneeSign` is a rig constant (not a per-pose value) because a human knee
only bends one way. Keep it fixed.

## Why legs use foot *targets*, never raw angles

Every pose (`POSES.STAND`, `POSES.CROUCH`, etc.) specifies legs as
`footLdx/footLdy/footRdx/footRdy` — an offset from **the ground line**, fed
through `solveLegIK()`. It would be simpler to just hand-author thigh/knee
angles directly, but that reintroduces exactly the problem this rig exists
to solve: an agent (or you, eyeballing numbers) has to mentally solve the
same trigonometry to guess angles that place the foot on the ground, and
will get it wrong the moment the hip height changes (crouch, jump). Foot
targets make foot placement an *input*, not a *consequence* — the IK solver
does the trigonometry every time, so a foot can never float or clip through
the ground because of a bad guess.

## The walk cycle — deterministic foot-lock

This is the single highest-leverage piece of this rig. A walk cycle looks
"AI-generated and wrong" the instant a planted foot slides across the
ground or hovers above it. Both are avoidable by construction, not by
tuning.

**Setup.** The hip (root) is translated by exactly one GSAP tween, at a
constant `speed` (px/s) — this is the *only* place forward motion is
authored. `gaitFoot(t, T, duty, speed, stepHeight, phaseOffset)` never
computes an absolute world position; it returns a **bounded** offset
relative to the hip, plus a ground-relative Y. Given a gait cycle duration
`T` and a stance duty fraction `duty` (0.62 = the foot is planted for 62%
of the cycle, swinging for the remaining 38%, which is roughly correct for
a walk):

```
phi = (t/T + phaseOffset) mod 1              // 0..1 position in the gait cycle
relAmp = speed * T * duty                    // distance the hip travels during ONE stance phase

stance (phi < duty):
  u = phi / duty
  relX = relAmp/2 - relAmp*u                 // sweeps backward, linearly
  y = groundY

swing (phi >= duty):
  u = (phi - duty) / (1 - duty)
  relX = -relAmp/2 + relAmp*ease(u)          // eases forward to the next contact point
  y = groundY - stepHeight*sin(pi*u)         // arcs up and back down
```

**Why this locks the foot in world space during stance.** The hip's own
world position advances at `speed` px/s (that is the definition of
`speed`). During stance, `relX` decreases *linearly* at rate
`relAmp/duty/T = speed` — the exact same rate, in the opposite direction.
`footWorldX = hipX(t) + relX(phi(t))`, so its time-derivative during stance
is `speed + (-speed) = 0`. The foot does not move in world space while it
is planted. This is not tuned to look right — it is algebraically
guaranteed for any `speed`, `T`, or `duty` you choose, which is why you
never need to hand-adjust a walk cycle to stop feet from sliding.

**This guarantee has exactly one precondition: the `speed` passed into
`gaitFoot()` must equal the actual px/s the caller is moving the hip.**
`renderWalk()` reads `WALK.speed`; the demo timeline derives the hip
tween's `duration` from `WALK.speed` (`WALK_DUR = distance / WALK.speed`)
instead of picking a duration independently — this is deliberate. An
earlier version of this file picked the walk's stride length and the hip
tween's duration independently (150px "stride" at one implied speed, a
flat `duration: 4.0` at another), and the two speeds silently disagreed.
Nothing crashed; the feet just landed tens of pixels from the hip on every
step, in a periodic sawtooth error that got worse cycle over cycle. If you
change the hip's translation speed, change `WALK.speed` (or vice versa) —
never let a walk's distance/duration be authored independently of the
speed `gaitFoot()` is told about.

`scripts/snap.mjs` asserts this invariant automatically: it samples
`gaitFoot()` across a full walk and fails if any stance-phase sample is not
exactly on the ground line. Run it after changing any of the gait math.

## Hip bounce is cosmetic, not load-bearing

`renderWalk()` gives the hip a small vertical bounce
(`WALK.bounce * |sin(...)|`) purely for visual life. Because leg length is
resolved by IK from a *ground-relative* foot target, changing the bounce
amount, curve, or removing it entirely cannot break foot placement — the
IK solver just computes a different thigh/knee split for whatever hip
height you give it. This is the payoff of using IK for legs: styling
concerns (bounce, crouch depth, stride width) and correctness concerns
(feet on the ground) are fully decoupled.

## Running

There is no separate `RUN` pose table. Derive a run from the same
`gaitFoot()` machinery by changing parameters, not by hand-authoring new
angles: shorter `T` (faster cadence), larger `WALK.speed` and
`stepHeight`, a bigger torso forward-lean in `renderWalk()`'s pose object,
and (optionally) a `duty` below 0.5 so both feet are airborne for part of
the cycle (a true running flight phase). Nothing about the foot-lock
derivation above changes — it holds for any `T`/`duty`/`speed`.

## A GSAP gotcha worth knowing before you extend the demo timeline

Two real bugs were hit (and fixed) while building the demo timeline in
`assets/starter.html`, both worth knowing before you add scenes:

1. **Never tween a nested object property.** `gsap.to(pose, {footL: {dx,
   dy}})` does not interpolate — GSAP's plain-object tweening only
   understands numeric leaf properties. Every pose field in `POSES` is
   flat (`footLdx`, `footLdy`, ...) for exactly this reason. If you add a
   new pose field, keep it a number.
2. **Never reassign a tweened object mid-timeline.** `S.pose = {...
   POSES.CROUCH}` replaces the object; any `tl.to(S.pose, ...)` tween
   created *earlier* (at timeline-build time) keeps a reference to the
   *original* object and will keep mutating that orphaned object forever,
   while `frame()` reads whatever `S.pose` now points to — frozen. Use
   `tl.set(S.pose, {...POSES.CROUCH}, atTime)` to mutate the existing
   object's properties in place instead. This produced a symptom that is
   easy to misdiagnose: the pose looked "stuck" at a seemingly unrelated
   earlier pose for the rest of the timeline, with no console error at
   all.

## Customization anchors

- `STYLE` — stroke color/weight, head fill.
- `BONES` — every bone length, in units of `HEAD_R`. Shrink `TORSO`/
  `THIGH`/`SHIN` for a chibi figure; lengthen them for a heroic one. The
  rig math is agnostic to proportions.
- `GROUND_Y` — where the ground line sits. All foot targets and the gait
  function are relative to this, so moving it moves the whole figure's
  baseline without touching any pose.
- `WALK` — cycle duration, stance duty, speed, step height, hip bounce.
