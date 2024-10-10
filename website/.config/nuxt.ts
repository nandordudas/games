export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },
  future: { compatibilityVersion: 4 },
  experimental: {
    typedPages: true,
  },
  runtimeConfig: {
    public: {
      packageVersion: import.meta.env.npm_package_version,
    },
  },
})
