module.exports = {
  builder: 'default',
  commands: {
    build: (options, projectInfo) => {
      process.env.VERSION = options?.version || projectInfo?.version;
      process.env.BUNDLE_NAME = options?.project || projectInfo?.project || 'brain';
      process.env.BUILD_ENV = options?.envType || projectInfo?.envType || 'dev';

      return [
        '$ fnpm install',
        '$ fnpm run build',
        '#tar ./dist ./dist/seed.jsbundle --path=build',
      ];
    },
  },
};
