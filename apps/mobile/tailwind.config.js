const { colors } = require("@cyaccess/shared");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        cardinal: colors.cardinal,
        "cyclone-dark": colors.cycloneDark,
        "cyclone-red": colors.cycloneRed,
        gold: colors.gold,
        "warm-gold": colors.warmGold,
        cream: colors.cream,
        "off-white": colors.offWhite,
        slate: colors.slate,
        muted: colors.muted,
      },
      fontFamily: {
        sans: ["System"],
      },
    },
  },
  plugins: [],
};
