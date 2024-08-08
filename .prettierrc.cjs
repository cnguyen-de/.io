module.exports = {
  semi: true,
  singleQuote: true,
  useTabs: false,
  trailingComma: "none",
  printWidth: 120,
  plugins: ["prettier-plugin-astro", "prettier-plugin-tailwindcss"],
  overrides: [
    {
      files: "*.astro",
      options: {
        parser: "astro"
      }
    }
  ]
};
