/**
 * FILE: tailwind.config.js
 *
 * THE RESKIN LIVES HERE MORE THAN ANYWHERE ELSE.
 *
 * The app's screens use Tailwind's `slate` scale about a thousand times — every
 * panel, border, label and muted line. Restyling them one component at a time
 * would have meant editing every screen in the product for what is a change of
 * colour, and every one of those edits is a chance to change behaviour by
 * accident. So `slate` is redefined instead: same class names, same lightness
 * steps, but the hue moved from blue-grey to the deep teal of the reference
 * designs. Every existing screen picks it up without being touched.
 *
 * THE LIGHTNESS STEPS ARE PRESERVED ON PURPOSE. Components chose slate-400 for
 * muted text on slate-900 because of the contrast between them; each new value
 * keeps roughly the luminance of the one it replaces, so those choices stay
 * readable. slate-400 on slate-900 is about 6:1, as it was.
 *
 * PRINTING IS UNAFFECTED. The print stylesheet in src/index.css matches class
 * NAMES (`[class*="bg-slate-8"]`) and forces white paper, so a colour change
 * here cannot leak onto a PDF.
 */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        slate: {
          50:  '#f3fbfb',
          100: '#e4f3f4',
          200: '#cae4e7',
          300: '#a9cdd2',
          400: '#82abb2',
          500: '#5f8a92',
          600: '#3f6770',
          700: '#28505a',
          800: '#143a45',
          900: '#0b2a34',
          950: '#061b22'
        },
        // The page itself, under everything. Named rather than written as hex
        // in thirty places, which is how the old navy ended up hard-coded.
        abyss: {
          DEFAULT: '#061b22',
          2: '#0a2833'
        },
        // The "Brighter Tomorrow" aqua from the reference.
        aqua: {
          300: '#7ff0e6',
          400: '#3fe0d4',
          500: '#1fc4bb'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Outfit', 'Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
