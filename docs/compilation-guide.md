# Compilation and Packaging Guide

This comprehensive guide covers building Docu from source code, packaging for distribution, and deployment options.

## Table of Contents

1. [Development Environment Setup](#development-environment-setup)
2. [Building from Source](#building-from-source)
3. [Testing](#testing)
4. [Packaging for Distribution](#packaging-for-distribution)
5. [VS Code Extension Installation](#vs-code-extension-installation)
6. [Troubleshooting Build Issues](#troubleshooting-build-issues)
7. [Continuous Integration](#continuous-integration)

## Development Environment Setup

### Prerequisites

#### Required Software
- **Node.js 20.x or higher** - [Download Node.js](https://nodejs.org/)
- **npm 10.x or higher** - Included with Node.js
- **Git** - [Download Git](https://git-scm.com/)
- **VS Code 1.97.0+** - [Download VS Code](https://code.visualstudio.com/)

#### Recommended Tools
- **VS Code Extensions**:
  - TypeScript and JavaScript Language Features (built-in)
  - ESLint
  - Prettier
  - Jest Test Explorer
- **Command Line Tools**:
  - `vsce` - VS Code Extension Manager
  - `typescript` - TypeScript compiler

### Environment Verification

Check your environment setup:

```bash
# Check Node.js version
node --version
# Should output: v20.x.x or higher

# Check npm version
npm --version
# Should output: 10.x.x or higher

# Check Git version
git --version
# Should output: git version 2.x.x or higher

# Check VS Code version
code --version
# Should output: 1.97.0 or higher
```

### Install Global Dependencies

```bash
# Install VS Code Extension Manager
npm install -g @vscode/vsce

# Install TypeScript compiler (optional, project includes local version)
npm install -g typescript

# Verify installations
vsce --version
tsc --version
```

## Building from Source

### Step 1: Clone Repository

```bash
# Clone the repository
git clone https://github.com/docu/vscode-docu-extension.git

# Navigate to project directory
cd vscode-docu-extension

# Check repository status
git status
```

### Step 2: Install Dependencies

```bash
# Install all project dependencies
npm install

# This installs:
# - TypeScript compiler and types
# - VS Code extension API types
# - Testing frameworks (Jest, @types/jest)
# - Linting tools (ESLint, Prettier)
# - Build tools and utilities
```

**Dependency Overview:**
- **Runtime Dependencies**: VS Code API, GitHub Copilot integration
- **Development Dependencies**: TypeScript, ESLint, Jest, build tools
- **Type Definitions**: @types packages for TypeScript support

### Step 3: Compile TypeScript

```bash
# Compile TypeScript to JavaScript
npm run compile

# Alternative: Watch mode for development
npm run watch

# Check compilation output
ls -la out/
```

**Compilation Process:**
1. TypeScript files in `src/` are compiled to JavaScript in `out/`
2. Source maps are generated for debugging
3. Type checking is performed
4. Module resolution is handled

### Step 4: Verify Build

```bash
# Check build output structure
tree out/
# Should show compiled JavaScript files matching src/ structure

# Verify main entry point
ls -la out/extension.js
# Should exist and be recent
```

## Testing

### Unit Tests

```bash
# Run all unit tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- --testNamePattern="AgentManager"
```

### Integration Tests

```bash
# Run integration tests
npm run test:integration

# Run with VS Code test environment
npm run test:vscode
```

### End-to-End Tests

```bash
# Run E2E tests (requires VS Code)
npm run test:e2e

# Run with specific VS Code version
npm run test:e2e -- --vscode-version=1.97.0
```

### Test Coverage

```bash
# Generate coverage report
npm run coverage

# View coverage report
open coverage/lcov-report/index.html
```

**Coverage Targets:**
- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 85%
- **Lines**: > 80%

## Packaging for Distribution

### Step 1: Pre-packaging Checks

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Run all tests
npm test

# Compile for production
npm run compile:production
```

### Step 2: Package Extension

```bash
# Create VSIX package
npm run package

# This creates: vscode-docu-extension-X.X.X.vsix
# Where X.X.X is the version from package.json
```

**Package Contents:**
- Compiled JavaScript files (`out/`)
- Package manifest (`package.json`)
- Extension metadata (`README.md`, `CHANGELOG.md`)
- Assets (`images/`, `templates/`)
- License and legal files

### Step 3: Verify Package

```bash
# List package contents
vsce ls

# Show package info
vsce show

# Validate package
vsce package --no-dependencies
```

### Step 4: Test Package Locally

```bash
# Install package locally
code --install-extension vscode-docu-extension-X.X.X.vsix

# Verify installation
code --list-extensions | grep docu

# Test basic functionality
# Open VS Code, try @docu commands
```

## VS Code Extension Installation

### Method 1: Command Line Installation

```bash
# Install from VSIX file
code --install-extension vscode-docu-extension-X.X.X.vsix

# Install from marketplace (when published)
code --install-extension docu.vscode-docu-extension

# Verify installation
code --list-extensions | grep docu
```

### Method 2: VS Code UI Installation

1. **Open VS Code**
2. **Open Extensions View** (`Ctrl+Shift+X`)
3. **Click Menu** (three dots) → "Install from VSIX..."
4. **Select VSIX File** and click "Install"
5. **Restart VS Code** when prompted

### Method 3: Marketplace Installation (Future)

1. **Open Extensions View** in VS Code
2. **Search** for "Docu - AI Documentation Assistant"
3. **Click Install**
4. **Restart VS Code**

### Installation Verification

```bash
# Check extension is installed
code --list-extensions | grep docu

# Check extension version
code --list-extensions --show-versions | grep docu

# Test extension functionality
# Open VS Code, open Copilot Chat, try: @docu /help
```

## Troubleshooting Build Issues

### Common Build Problems

#### TypeScript Compilation Errors

**Problem**: TypeScript compilation fails
```bash
error TS2307: Cannot find module '@vscode/vscode-languageserver-types'
```

**Solution**:
```bash
# Clean and reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild TypeScript
npm run compile
```

#### Missing Dependencies

**Problem**: Module not found errors
```bash
Error: Cannot find module 'some-package'
```

**Solution**:
```bash
# Install missing dependencies
npm install

# Check for peer dependency issues
npm ls

# Install specific missing package
npm install some-package
```

#### VS Code API Version Mismatch

**Problem**: VS Code API compatibility issues
```bash
error: vscode API version mismatch
```

**Solution**:
```bash
# Update VS Code engine version in package.json
"engines": {
  "vscode": "^1.97.0"
}

# Update @types/vscode dependency
npm install --save-dev @types/vscode@^1.97.0
```

### Build Environment Issues

#### Node.js Version Problems

**Problem**: Node.js version too old
```bash
error: Node.js version 16.x is not supported
```

**Solution**:
```bash
# Update Node.js to version 20.x or higher
# Use nvm (Node Version Manager) for easy switching
nvm install 20
nvm use 20

# Verify version
node --version
```

#### Permission Issues

**Problem**: Permission denied during build
```bash
EACCES: permission denied, mkdir '/usr/local/lib/node_modules'
```

**Solution**:
```bash
# Use npm prefix for global installs
npm config set prefix ~/.npm-global

# Add to PATH in ~/.bashrc or ~/.zshrc
export PATH=~/.npm-global/bin:$PATH

# Or use npx for one-time commands
npx vsce package
```

### Testing Issues

#### Test Environment Setup

**Problem**: Tests fail to run
```bash
Error: Cannot find VS Code installation
```

**Solution**:
```bash
# Install VS Code test dependencies
npm install --save-dev @vscode/test-electron

# Set VS Code path environment variable
export VSCODE_PATH="/Applications/Visual Studio Code.app/Contents/MacOS/Electron"

# Run tests with explicit path
npm test -- --vscode-path="$VSCODE_PATH"
```

#### GitHub Copilot Integration Tests

**Problem**: Copilot tests fail
```bash
Error: GitHub Copilot not available in test environment
```

**Solution**:
```bash
# Mock Copilot API for tests
# Add to test setup:
jest.mock('@vscode/copilot-api', () => ({
  // Mock implementation
}));

# Or skip Copilot tests in CI
npm test -- --testPathIgnorePatterns="copilot"
```

## Continuous Integration

### GitHub Actions Workflow

Create `.github/workflows/build.yml`:

```yaml
name: Build and Test

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [20.x]
        vscode-version: [1.97.0]
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Lint code
      run: npm run lint
    
    - name: Compile TypeScript
      run: npm run compile
    
    - name: Run tests
      run: npm test
    
    - name: Package extension
      run: npm run package
    
    - name: Upload VSIX artifact
      uses: actions/upload-artifact@v4
      with:
        name: vscode-docu-extension
        path: '*.vsix'
```

### Release Workflow

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20.x'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
    
    - name: Package extension
      run: npm run package
    
    - name: Publish to VS Code Marketplace
      run: npx vsce publish
      env:
        VSCE_PAT: ${{ secrets.VSCE_PAT }}
    
    - name: Create GitHub Release
      uses: actions/create-release@v1
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      with:
        tag_name: ${{ github.ref }}
        release_name: Release ${{ github.ref }}
        draft: false
        prerelease: false
```

### Local Development Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "dev": "npm run compile && npm run watch",
    "build": "npm run lint && npm run compile && npm test",
    "package:dev": "npm run build && vsce package",
    "install:local": "code --install-extension *.vsix",
    "clean": "rm -rf out coverage *.vsix",
    "reset": "npm run clean && rm -rf node_modules && npm install"
  }
}
```

## Advanced Build Configuration

### TypeScript Configuration

Optimize `tsconfig.json` for production:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "out",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": false,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "out", "**/*.test.ts"]
}
```

### Webpack Configuration (Optional)

For optimized bundling, create `webpack.config.js`:

```javascript
const path = require('path');

module.exports = {
  target: 'node',
  mode: 'production',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'out'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: 'ts-loader'
      }
    ]
  },
  externals: {
    vscode: 'commonjs vscode'
  }
};
```

## Performance Optimization

### Bundle Size Optimization

```bash
# Analyze bundle size
npm install --save-dev webpack-bundle-analyzer

# Add to package.json scripts:
"analyze": "webpack-bundle-analyzer out/extension.js"

# Run analysis
npm run analyze
```

### Build Speed Optimization

```bash
# Use TypeScript incremental compilation
# Add to tsconfig.json:
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  }
}

# Use parallel processing
npm install --save-dev ts-loader thread-loader

# Configure in webpack.config.js for faster builds
```

---

**This guide provides everything needed to build, test, package, and distribute the Docu extension. Follow these steps for reliable builds and smooth deployment.**