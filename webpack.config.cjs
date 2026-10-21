const path = require('path');
const CircularDependencyPlugin = require('circular-dependency-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');


const projectRoot = 'c:/projects/';
const exportsProofMode = process.env.EXPORTS_PROOF === '1';


module.exports = {
    // mode: 'production',
    mode: 'development',
    devtool: 'inline-source-map',
    entry: './src/app.tsx',
    output: {
        path: path.resolve(__dirname, './dist'),
        filename: 'index.js'
    },
    resolve: {
        extensions: [
            '.js', '.mjs', '.cjs', 
            '.jsx', '.cjsx', '.mjsx',
            '.tsx', '.ts', '.d.ts'
        ],
        extensionAlias: {
            ".js": [".js", ".ts", ".tsx"],
            ".cjs": [".cjs", ".cts"],
            ".mjs": [".mjs", ".mts"]
        },
        alias: {
            // 'flo-boolean$': path.resolve(__dirname, projectRoot, 'boolean/src/index.ts'),
            // 'flo-mat$':     path.resolve(__dirname, projectRoot, 'mat/src/index.ts'),
            // 'flo-bezier3$': path.resolve(__dirname, projectRoot, 'bezier/src/index.ts'),
        },
    },
    module: {
        // swc only transpiles (no type checking) - run `npm run typecheck`
        rules: [{
            test: /\.tsx?$/,
            loader: 'swc-loader',
            options: {
                jsc: {
                    parser: { syntax: 'typescript', tsx: true },
                    // tsconfig `"jsx": "react-jsx"` (automatic runtime)
                    transform: { react: { runtime: 'automatic' } },
                    target: 'esnext'
                },
                sourceMaps: true
            },
            exclude: /node_modules/,
            sideEffects: false
        }]
    },
    stats: {
        // Don't display anything, then add back colors, ...
        all: false,
        colors: true,
        errors: true,
        // circular-dependency-plugin reports cycles as warnings
        // warnings: true,
        warnings: false,
        builtAt: true
    },
    plugins: [
        // new CircularDependencyPlugin({
        //     exclude: /node_modules/,
        //     failOnError: false,
        //     allowAsyncCycles: false,
        //     cwd: process.cwd()
        // }),
        // new BundleAnalyzerPlugin(
        //     exportsProofMode
        //         ? {
        //             analyzerMode: 'disabled',
        //             generateStatsFile: true,
        //             statsFilename: 'stats-proof.json',
        //             statsOptions: {
        //                 all: false,
        //                 modules: true,
        //                 providedExports: true,
        //                 usedExports: true,
        //                 source: false
        //             }
        //         }
        //         : {}
        // )
    ],
    optimization: {
        minimize: false
        // minimize: true,
        // concatenateModules: false
    },
    experiments: {
        outputModule: true
    }
};