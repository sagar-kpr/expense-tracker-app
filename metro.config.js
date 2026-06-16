const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push("cjs");
config.resolver.unstable_enablePackageExports = false;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith("@/")) {
    return context.resolveRequest(
      context,
      path.join(__dirname, moduleName.slice(2)),
      platform,
    );
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
