// Expo + monorepo Metro config. Allows resolving workspace packages from
// ../../packages while keeping `node_modules` at the repo root.
//
// Do not set disableHierarchicalLookup — with pnpm's isolated installs Metro must be
// able to resolve transitive deps next to packages (e.g. expo-modules-core next to expo).
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules/.pnpm/node_modules"),
];
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
