export default ({ config }) => ({
  ...config,
  extra: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
  },
});
