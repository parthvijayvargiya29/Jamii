# Design Guidelines: React + Node.js Web Application

## Design Approach
**System Selected:** Fluent Design + Linear-inspired aesthetics
Modern SaaS application requiring clean, professional interface with efficient workflows. Focus on clarity, spatial hierarchy, and purposeful design elements.

## Typography
- **Primary Font:** Inter (Google Fonts)
- **Secondary Font:** JetBrains Mono (for code/data)
- **Scale:** 
  - Headings: text-4xl/5xl/6xl (font-bold)
  - Body: text-base/lg (font-normal)
  - Small: text-sm/xs (font-medium for labels)
  - Data/Metrics: text-2xl/3xl (font-semibold)

## Layout System
**Spacing Primitives:** Tailwind units 2, 4, 6, 8, 12, 16, 20
- Component padding: p-4, p-6, p-8
- Section spacing: py-12, py-16, py-20
- Card gaps: gap-4, gap-6
- Margins: m-4, m-6, m-8

**Grid System:**
- Landing: max-w-7xl mx-auto
- Dashboard: Full-width with sidebar (w-64 fixed)
- Content: max-w-4xl for forms/content areas

## Component Library

### Navigation
- **Landing Header:** Sticky top navigation, flex justify-between, h-16, logo left, nav center, auth buttons right
- **Dashboard Sidebar:** Fixed left, w-64, navigation items with icons (Heroicons), role-based menu visibility
- **Top Bar:** Dashboard header with breadcrumbs, user profile dropdown, notifications

### Core Components
- **Cards:** Rounded-xl, shadow-sm, border, p-6, hover:shadow-md transition
- **Buttons:** px-6 py-3, rounded-lg, font-medium, shadow-sm
- **Form Inputs:** w-full, px-4 py-2.5, rounded-lg, border, focus:ring-2
- **Tables:** Striped rows, sticky headers, sortable columns, pagination
- **Modals:** Center overlay, rounded-xl, max-w-lg/xl/2xl based on content

### Data Display
- **Stat Cards:** Grid layout (grid-cols-1 md:grid-cols-2 lg:grid-cols-4), large numbers with trend indicators
- **Charts:** Use Chart.js/Recharts, contained within cards
- **Lists:** Alternating row treatment, action buttons on hover
- **Badges:** Role indicators, status tags, rounded-full, px-3 py-1, text-xs

## Page Structures

### Landing Page (5-6 Sections)
1. **Hero:** h-screen or min-h-[600px], two-column (60/40), headline left, large hero image right showing dashboard preview
2. **Features:** Grid-cols-3, icon + title + description cards, py-20
3. **Authentication Preview:** Screenshot of login/dashboard with security features highlighted
4. **Role Management:** Visual diagram showing admin/user permissions flow
5. **CTA Section:** Centered, background with subtle gradient, sign-up form with benefits listed
6. **Footer:** Four columns (Product, Company, Resources, Legal), newsletter signup, social links

### Dashboard Layout
- **Sidebar Navigation:** Fixed left, categorized menu items, role-based visibility
- **Main Content:** Flex-1, px-8 py-6, breadcrumb navigation
- **Overview Dashboard:** 4 stat cards top, charts middle (grid-cols-2), recent activity table bottom

### Authentication Pages
- **Login/Register:** Centered card (max-w-md), form with validation, "Remember me" checkbox, password strength indicator
- **Split Layout:** Form left (w-1/2), benefits/testimonials right (w-1/2, hidden on mobile)

## Icons
**Heroicons** (CDN): Navigation, form inputs, stat indicators, action buttons

## Animations
**Minimal & Purposeful:**
- Card hover: scale-105 transition-transform
- Button interactions: Standard hover/active states
- Page transitions: Fade-in for dashboard views
- No scroll animations, no excessive motion

## Images

### Hero Section
**Large Hero Image:** Dashboard preview/mockup showing the application interface, positioned right side of hero, w-full lg:w-1/2, rounded-xl shadow-2xl. Image should convey professionalism and showcase key features.

### Feature Sections
**Dashboard Screenshots:** 2-3 screenshots showing admin panel, user management, analytics views. Place within feature cards or as visual breaks between sections.

### Authentication Pages
**Background Pattern:** Subtle geometric pattern or abstract gradient (not photo), low opacity, adds visual interest without distraction.

### Trust Elements
**Optional:** Client logos, team photos (About page), security badges near authentication sections.

## Accessibility
- WCAG 2.1 AA compliance
- Focus indicators on all interactive elements (ring-2)
- Keyboard navigation throughout
- ARIA labels for icon-only buttons
- Form validation with clear error messages

---

**Design Philosophy:** Clean, efficient, professional. Every element serves a purpose. Prioritize usability over decoration. Consistent spacing creates rhythm. Typography hierarchy guides user attention.