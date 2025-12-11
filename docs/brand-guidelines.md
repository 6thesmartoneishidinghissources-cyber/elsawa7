# ElSawa7 Brand Guidelines

## Logo

### Primary Wordmark
- Text: "ElSawa7" (English)
- Tagline: "السوّاح" (Arabic)
- Usage: Headers, marketing materials

### Logo Variants
1. **Primary**: Full wordmark with icon
2. **Icon Only**: Circular mark for favicons, app icons
3. **Monochrome**: Single color for printing, engraving

### Logo Files (To Be Created)
```
/design/
├── logo-primary.svg
├── logo-primary.png (1024px, 512px, 256px, 64px)
├── logo-icon.svg
├── logo-icon.png (512px, 192px, 96px, 72px)
├── logo-monochrome.svg
└── logo-monochrome.png
```

## Colors

### Primary Palette

| Name | Token | Hex | HSL | Usage |
|------|-------|-----|-----|-------|
| Primary | `--elsawa7-primary` | #0B6E4F | 158 82% 24% | Main brand, CTAs |
| Accent | `--elsawa7-accent` | #FFB400 | 42 100% 50% | Highlights, warnings |
| Dark | `--elsawa7-dark` | #1F2937 | 221 39% 17% | Text, headers |
| Background | `--elsawa7-bg` | #FAFBFC | 210 25% 99% | Page backgrounds |

### Extended Palette

| Name | Hex | Usage |
|------|-----|-------|
| Success | #10B981 | Confirmations, approved status |
| Warning | #F59E0B | Pending, caution |
| Error | #EF4444 | Rejections, errors |
| Info | #3B82F6 | Information, links |

### Contrast Ratios
All text combinations meet WCAG 2.1 AA standards (4.5:1 minimum):
- Primary on Background: 7.2:1 ✓
- Dark on Background: 14.5:1 ✓
- White on Primary: 4.8:1 ✓

## Typography

### Font Stack
```css
font-family: 'Cairo', 'Noto Kufi Arabic', system-ui, -apple-system, sans-serif;
```

### Font Weights
- Regular (400): Body text
- Medium (500): Subheadings
- Bold (700): Headlines, emphasis

### Font Sizes
| Name | Size | Usage |
|------|------|-------|
| xs | 0.75rem | Captions, labels |
| sm | 0.875rem | Secondary text |
| base | 1rem | Body text |
| lg | 1.125rem | Subheadings |
| xl | 1.25rem | Section headers |
| 2xl | 1.5rem | Page titles |
| 3xl | 1.875rem | Hero text |

## Spacing

Using 4px base unit:
- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px
- 2xl: 48px

## Components

### Buttons

**Primary Button**
- Background: var(--elsawa7-primary)
- Text: White
- Hover: 10% darker
- Border radius: 8px

**Secondary Button**
- Background: Transparent
- Border: 1px solid var(--elsawa7-primary)
- Text: var(--elsawa7-primary)

**Accent Button**
- Background: var(--elsawa7-accent)
- Text: var(--elsawa7-dark)

### Cards
- Background: White
- Border: 1px solid #E5E7EB
- Border radius: 12px
- Shadow: 0 1px 3px rgba(0,0,0,0.1)

### Badges

**Status Badges**
- Confirmed: Green background
- Pending: Yellow background
- Rejected: Red background
- Temporary: Gray background

## RTL Support

- All layouts support right-to-left (RTL)
- Text alignment: start (adapts to direction)
- Icons: Mirror where semantically appropriate
- Forms: Labels on the right

## Iconography

Using Lucide icons:
- Stroke width: 2px
- Size: 16px (small), 20px (default), 24px (large)
- Color: Inherit from parent

## Imagery

### Photo Style
- Clean, professional
- Natural lighting
- Focus on transportation/travel themes

### Illustrations
- Simple, flat design
- Use brand colors
- Minimal detail

## Voice & Tone

### Arabic Copy
- Egyptian colloquial (عامية مصرية)
- Friendly, approachable
- Clear, concise

### Key Phrases
| Context | Arabic |
|---------|--------|
| Book seat | احجز مقعد |
| Upload receipt | حط صورة حوالة فودافون كاش |
| Temporary booking | تم عمل حجز مؤقت |
| Confirmed | الحجز اتأكد |
| Rejected | الحجز مرفوض |
| Install app | نزّل التطبيق |

## Usage Guidelines

### Do
- Use consistent spacing
- Maintain color contrast
- Keep text readable
- Use proper Arabic typography

### Don't
- Stretch or distort logo
- Use unapproved colors
- Mix font families
- Ignore RTL requirements

## CSS Implementation

```css
:root {
  /* Brand Colors */
  --elsawa7-primary: 158 82% 24%;
  --elsawa7-accent: 42 100% 50%;
  --elsawa7-dark: 221 39% 17%;
  --elsawa7-bg: 210 25% 99%;
  
  /* Semantic Mapping */
  --primary: var(--elsawa7-primary);
  --accent: var(--elsawa7-accent);
  --foreground: var(--elsawa7-dark);
  --background: var(--elsawa7-bg);
}
```

## Contact

For brand-related questions or asset requests:
**صُنع بواسطة: م/ أحمد طارق — I do publishing**
