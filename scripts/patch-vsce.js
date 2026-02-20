const fs = require('fs');
const path = require('path');

const vscePackageJsPath = path.join(__dirname, '../node_modules/@vscode/vsce/out/package.js');

if (fs.existsSync(vscePackageJsPath)) {
    let content = fs.readFileSync(vscePackageJsPath, 'utf8');

    // Replace `(0, minimatch_1.default)` with `(0, (minimatch_1.minimatch || minimatch_1.default))`
    // This handles both old minimatch (which has a default export or acts as a function)
    // and minimatch v10+ (which uses named exports and has `minimatch`)
    const patchedContent = content.replace(/\(0, minimatch_1\.default\)/g, '(0, (minimatch_1.minimatch || minimatch_1.default))');

    if (content !== patchedContent) {
        fs.writeFileSync(vscePackageJsPath, patchedContent);
        console.log('✅ Patched @vscode/vsce to support minimatch v10');
    } else {
        console.log('ℹ️ @vscode/vsce is already patched or does not require patching for minimatch');
    }
} else {
    console.warn('⚠️ Could not find @vscode/vsce package.js to patch. Is it installed?');
}
