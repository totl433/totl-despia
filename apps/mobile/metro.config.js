const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const packagesRoot = path.resolve(workspaceRoot, "packages");

const config = getDefaultConfig(projectRoot);

// Watch monorepo packages
config.watchFolders = [packagesRoot];

// Resolve from mobile first, then workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Allow file:/symlinked packages
config.resolver.unstable_enableSymlinks = true;

// CRITICAL: force single React + RN instance (fixes invalid hook call)
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
};

module.exports = config;
