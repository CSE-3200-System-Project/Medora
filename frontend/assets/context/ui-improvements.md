Below is a **proper, product-grade PRD** tailored to your Medora “Find a Doctor” screen. This is not generic UI advice. It is a **system-level spec** you can implement directly by adjusting your existing constants, Tailwind tokens, and motion rules. Everything includes **light and dark mode parity**, size guidance, and performance constraints.

I will structure this exactly like a real PRD used by senior frontend teams.

---

# PRODUCT REQUIREMENTS DOCUMENT

**Project:** Medora Web App
**Screen:** Find a Doctor
**Objective:**
Create a calm, premium, high-performance medical web app UI that feels intentional, trustworthy, mobile-first, and app-like, without visual heaviness.

---

## 1. DESIGN PRINCIPLES (NON-NEGOTIABLE)

1. Medical > Decorative
2. Calm > Flashy
3. Hierarchy > Uniform beauty
4. Motion communicates state, never decorates
5. Performance is a feature

---

## 2. BACKGROUND SYSTEM (UNIQUE, LIGHTWEIGHT, NON-SLOP)

### 2.1 Background Concept

Instead of “a gradient”, we use a **Clinical Depth Field**:

* Vertical tonal shift (environmental lighting cue)
* One directional soft-focus medical-blue glow
* Micro-noise for material realism
* Zero continuous animation

This feels intentional and premium, not AI-generated.

---

### 2.2 Light Mode Background Spec

#### Base Layer

Replace flat background usage with:

* Top: slightly brighter
* Bottom: slightly cooler

**Do NOT change `--background` value.**
Introduce **derived background layers**.

Add to `:root`:

```css
--bg-top: #F4FAFF;
--bg-bottom: #E6F5FC;

/* ambient medical glow */
--bg-glow: rgba(3, 96, 217, 0.08);

/* noise */
--bg-noise-opacity: 0.035;
```

#### Page Background CSS (global wrapper)

```css
.app-background {
  background:
    radial-gradient(
      900px 600px at 85% -10%,
      var(--bg-glow),
      transparent 60%
    ),
    linear-gradient(
      to bottom,
      var(--bg-top),
      var(--bg-bottom)
    );
  position: relative;
}
```

#### Noise Overlay (pseudo-element)

```css
.app-background::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: url("/noise.png");
  opacity: var(--bg-noise-opacity);
}
```

Noise image should be:

* 128x128 PNG
* Monochrome
* < 2 KB

---

### 2.3 Dark Mode Background Spec

Add to `.dark`:

```css
--bg-top: #041C33;
--bg-bottom: #021526;
--bg-glow: rgba(3, 96, 217, 0.18);
--bg-noise-opacity: 0.04;
```

Dark mode glow is stronger to avoid flatness.

---

### 2.4 Surface Elevation Rules

| Layer           | Token          | Usage            |
| --------------- | -------------- | ---------------- |
| Background      | `--background` | page             |
| Section surface | `--surface`    | search blocks    |
| Cards           | `--card`       | doctors, history |

Do **not** introduce new surface colors.

---

## 3. SIZE & SPACING SYSTEM (CHANGE THESE IN CONSTANTS)

### 3.1 Border Radius Rationalization

Currently you have too many options.

**Lock usage:**

* Cards: `radius-lg`
* Inputs: `radius-md`
* Buttons: `radius-md`
* Chips/toggles: `radius-sm`

Do NOT mix radii within the same section.

---

### 3.2 Vertical Rhythm (Critical)

Update spacing scale usage:

| Element               | Vertical spacing |
| --------------------- | ---------------- |
| Section to section    | 32–40px          |
| Card internal padding | 20–24px          |
| Mobile card gap       | 16px             |
| Desktop card gap      | 20px             |

This reduces visual noise immediately.

---

## 4. MOTION SYSTEM (GSAP-READY, REUSABLE)

### 4.1 Motion Philosophy

Motion exists only for:

* Entry
* State change
* Feedback

No ambient motion.

---

### 4.2 Global Motion Tokens

Create these constants:

```ts
export const motion = {
  duration: {
    fast: 0.25,
    base: 0.4,
    slow: 0.6,
  },
  ease: {
    standard: "power2.out",
    enter: "power3.out",
    exit: "power2.in",
  },
  offset: {
    small: 8,
    medium: 16,
  }
};
```

---

### 4.3 Allowed Animations

#### Page Entry

* Search bar fades in
* Filters slide slightly upward
* Results stagger in

GSAP pattern:

* opacity 0 → 1
* y: +16 → 0

#### Card Hover (desktop only)

* translateY: -2px
* shadow increases slightly

#### State Change

* Skeleton → content crossfade
* No sliding during loading

---

### 4.4 Lenis Rules

* Desktop only
* Disable on touch devices
* Smoothing < 0.8
* Never animate scroll position with GSAP

---

## 5. MOBILE FILTER EXPERIENCE (REDESIGN)

### 5.1 Problem

Inline filters feel cramped and cognitively heavy.

---

### 5.2 New Mobile Flow

#### Step 1: Default State

* Show only search bar
* “Filters” button with count badge

#### Step 2: Filter Button Tap

* Bottom sheet slides up
* Height: 85vh
* Rounded top only

#### Step 3: Inside Bottom Sheet

* Clear vertical stacking
* One filter per row
* Large tap targets

#### Step 4: Apply

* Sticky bottom “Apply Filters” CTA
* Secondary “Reset” inline text

---

### 5.3 Bottom Sheet Motion

* Slide from bottom
* Duration: 0.4s
* Ease: `power3.out`

---

## 6. PERFORMANCE AUDIT (CRITICAL)

### 6.1 Immediate Wins

* Lazy-load map only when visible
* Replace spinners with skeletons
* Avoid backdrop-filter on scrolling containers
* Avoid animated gradients

---

### 6.2 CSS Performance

Safe:

* transform
* opacity

Avoid:

* filter animation
* box-shadow animation
* layout-triggering transitions

---

### 6.3 JS & Rendering

* Memoize doctor cards
* Virtualize long lists
* Do not mount map until requested

---

## 7. DARK MODE PARITY RULES

Every light-mode change MUST:

* Preserve hierarchy
* Increase contrast slightly
* Strengthen glow, not brightness

Never invert colors blindly.

---

## 8. SUCCESS METRICS

* First interaction < 100ms
* Scroll stays at 60fps on mid-tier Android
* Users find a doctor in under 3 taps on mobile
* Zero animation jank during data fetch

---

## FINAL NOTE

You are not far from “best-in-class”.

What separates this from a generic UI:

* Controlled depth, not decoration
* Fewer choices, stronger intent
* Motion as communication
* Mobile-first cognitive load reduction

