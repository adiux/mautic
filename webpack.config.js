// webpack.config.js
const Encore = require('@symfony/webpack-encore');

Encore
    // Directory where compiled assets will be stored
    .setOutputPath('media/build/')
    // Public path used by the web server to access the output path
    .setPublicPath('/media/build')

    // Enable source maps for development
    .enableSourceMaps(!Encore.isProduction())

    // Clean output directory before building
    .cleanupOutputBeforeBuild()

    // Enable hashed filenames (e.g. app.abc123.css) for cache busting
    // .enableVersioning(Encore.isProduction())
	.enableSingleRuntimeChunk()
	.splitEntryChunks()

    // Enable support for TypeScript (optional)
    .enableTypeScriptLoader()
    // Main JS entry point
    .addEntry('ckeditor', './app/assets/libraries/ckeditor/src/ckeditor.ts')
	// entry: path.resolve( __dirname, webroot + 'app/assets/libraries/ckeditor/src', 'ckeditor.ts' ),

    // Main CSS entry point
    // .addStyleEntry('styles', './assets/css/app.css')
    // Enable Sass/SCSS support (optional)
    // .enableSassLoader()
;

module.exports = Encore.getWebpackConfig();
