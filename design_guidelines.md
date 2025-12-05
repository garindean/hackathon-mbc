# Design Guidelines: Base Prediction Market Strategy Platform

## Design Approach

**System-Based Approach** using Material Design principles adapted for Web3/fintech contexts, drawing inspiration from Linear's clean data presentation and Uniswap's minimal aesthetic.

**Core Principles:**
- Data clarity over decoration - information hierarchy is paramount
- Trustworthy and professional for financial decisions
- Scannable layouts for quick market evaluation
- Focused interactions with clear call-to-actions

---

## Typography

**Font Stack:** Inter (primary), JetBrains Mono (monospace for numbers/data)

**Hierarchy:**
- Hero/Page Titles: text-4xl md:text-5xl, font-bold
- Section Headers: text-2xl md:text-3xl, font-semibold
- Card Titles: text-lg font-semibold
- Body Text: text-base, font-normal
- Data/Metrics: text-sm md:text-base, font-medium (use monospace for numerical values)
- Captions/Meta: text-xs md:text-sm, font-normal

---

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12, 16 for consistency
- Component padding: p-4 to p-8
- Section spacing: py-12 to py-16
- Card spacing: p-6
- Grid gaps: gap-4 to gap-6

**Container Strategy:**
- Max width: max-w-7xl for main content
- Full bleed for navigation and major sections
- Responsive padding: px-4 md:px-6 lg:px-8

---

## Component Library

### Navigation
- Fixed header with wallet connection prominent in top-right
- Logo/brand left, main nav center (Topics, History, About)
- Wallet connect button with address truncation when connected
- Mobile: hamburger menu with slide-out drawer

### Topics Grid (Main Screen)
- Grid layout: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6
- Topic card structure:
  - Topic name header with follow button in top-right
  - Short description text
  - Badge showing active signal count (e.g., "12 signals")
  - Subtle border, rounded-lg, hover state with slight elevation

### Topic Detail Screen
- Two-column layout on desktop: lg:grid-cols-3
  - Main content area (col-span-2): Signals feed
  - Sidebar (col-span-1): Strategy Builder panel (sticky)
- Mobile: single column, strategy builder at bottom

**Signals Cards:**
- Bordered cards with rounded-lg, p-6 spacing
- Structure per signal:
  - Market question (text-lg font-semibold)
  - Two-column data grid showing: Current Odds vs AI Fair Price
  - Edge percentage badge (prominent, e.g., "+12.5%" with basis point context)
  - Explanation text (2-3 bullet points, text-sm)
  - Action buttons: "Add to Strategy" (primary) + "Dismiss" (ghost)

**Strategy Builder Panel:**
- Sticky sidebar: sticky top-4
- Header: "Your Strategy" with signal count
- List of selected signals with:
  - Market name (truncated)
  - USDC allocation input (number input with validation)
  - Remove button (× icon)
- Summary section:
  - Total USDC amount
  - Risk level indicator (Low/Medium/High with visual indicator)
- Primary CTA: "Review & Execute" button (w-full, large)

### Strategy Review/Execute Screen
- Table layout for desktop, card stack for mobile
- Columns: Market | Side | Odds | Edge | Allocation | Expected Value
- Summary panel above table:
  - Total allocation
  - Weighted average edge
  - Risk assessment
- Large execute button: "Execute Strategy on Base" with wallet icon
- Secondary: "Edit Strategy" link

### History Screen
- Timeline/list view of past strategies
- Each entry card shows:
  - Topic badge + timestamp
  - Markets count and total amount
  - Status badge (Executed, Pending, Failed)
  - Link to BaseScan (external link icon)
  - Expand/collapse for strategy details
- Empty state when no history: illustration + "Execute your first strategy"

### Data Visualization Elements
- Percentage badges: rounded-full with px-3 py-1, text-xs font-medium
- Price displays: Use monospace font, larger sizing (text-xl to text-2xl)
- Edge indicators: Inline badges with +/- symbols
- Status indicators: Dot + text pattern (e.g., • Active, • Completed)

### Forms & Inputs
- Input fields: border, rounded-lg, px-4 py-3
- Number inputs for allocations: Monospace font, right-aligned
- Wallet connect: Prominent button with gradients/visual interest
- Form validation: Inline error messages below inputs

---

## Images

**Minimal Image Usage** - This is a data-focused application:

**Topics Screen:**
- Optional small topic icons (32x32px) as decorative elements in cards
- No hero image needed - jump straight to topics grid

**Empty States:**
- Simple illustrations for:
  - No topics followed
  - No active signals
  - No execution history
- Style: Line art, minimal, supportive not distracting

**No traditional hero section** - Users come here for data and execution, not marketing messaging. Lead immediately with functionality.

---

## Animations

**Minimal & Purposeful:**
- Smooth transitions on card hover (transform: scale(1.02))
- Loading states: Skeleton screens for data fetching
- Strategy builder: Smooth add/remove animations (fade in/out)
- Toast notifications: Slide in from top-right for transaction status
- No scroll animations, no decorative motion

---

## Responsive Behavior

- **Mobile:** Single column, bottom-anchored strategy builder, stacked data tables
- **Tablet:** Two-column grids, collapsible sidebar
- **Desktop:** Three-column layouts, fixed sidebars, wider data tables