/** Preamble generates a Jalangi2 preamble given a set of analysis **/

const acorn = require("acorn");
const babel = require("babel-core");
babel.transform('', { presets: ['babel-preset-es2015'] });
const fs = require('fs');
const path = require("path");
const instUtil = require("../instrument/instUtil");
const ArgumentParser = require('argparse').ArgumentParser;

require('../headers').headerSources.forEach(function (header) {
    require("./../../../" + header);
});

var EXTRA_SCRIPTS_DIR = "__jalangi_extra";
var JALANGI_RUNTIME_DIR = "jalangiRuntime";

/**
 * computes the Jalangi root directory based on the directory of the script
 */
function getJalangiRoot() {
    return path.join(__dirname, '../../..');
}

const parser = new ArgumentParser({
    addHelp: true,
    description: "Utility to apply Jalangi instrumentation to files or a folder."
});

parser.addArgument(['--analysis'], {
    help: "Analysis script.",
    action: "append"
});

parser.addArgument(['--initParam'], { help:"initialization parameter for analysis, specified as key:value", action:'append'});

parser.addArgument(['--extra_app_scripts'], {help: "list of extra application scripts to be injected and instrumented, separated by path.delimiter"});
parser.addArgument(['--astHandlerModule'], {help: "Path to a node module that exports a function to be used for additional AST handling after instrumentation"});
parser.addArgument(['inputFiles'], {
    help: "either a list of JavaScript files to instrument, or a single directory under which all JavaScript and HTML files should be instrumented (modulo the --no_html and --exclude flags)",
    nargs: '+'
});

const options = parser.parseArgs();

if (options.astHandlerModule) {
    options.astHandler = require(options.astHandlerModule);
}

/**
 * extra scripts to inject into the application and instrument
 * @type {Array.<String>}
 */
const extraAppScripts = [];

if (options.extra_app_scripts) {
    extraAppScripts = options.extra_app_scripts.split(path.delimiter);
}

instUtil.setHeaders();

const preambleData = instUtil.getScriptsToLoad(options.analysis, options.initParam, extraAppScripts, EXTRA_SCRIPTS_DIR, getJalangiRoot());

preambleData.forEach(script => {
    console.log('' + script);
});