#!/usr/bin/env node
/*
 * Copyright 2014 Samsung Information Systems America, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Author: Koushik Sen
// Author: Manu Sridharan

/*jslint node: true */
/*global process */
/*global J$ */

var argparse = require('argparse');
var instUtil = require('../instrument/instUtil');
var parser = new argparse.ArgumentParser({
    addHelp: true,
    description: "Command-line utility to perform Jalangi2's instrumentation and analysis"
});
parser.addArgument(['--analysis', '-a'], {help: "absolute path to analysis file to run", action: 'append'});
parser.addArgument(['--initParam', '-p'], { help: "initialization parameter for analysis, specified as key:value", action:'append'});
parser.addArgument(['--inlineIID', '-iid'], {help: "Inline IID to (beginLineNo, beginColNo, endLineNo, endColNo) in J$.iids in the instrumented file", action: 'storeTrue'});
parser.addArgument(['--inlineSource', '-is'], {help: "Inline original source as string in J$.iids.code in the instrumented file", action: 'storeTrue'});
parser.addArgument(['--astHandlerModule', '-ast'], {help: "Path to a node module that exports a function to be used for additional AST handling after instrumentation"});
parser.addArgument(['script_and_args'], {
    help: "script to record and CLI arguments for that script",
    nargs: argparse.Const.REMAINDER
});
parser.addArgument(['--folderExceptFromInstrument', '-e'], {help: "Path to folders that to be ignored from instrumentation", action: 'append'})

var args = parser.parseArgs();
var path = require('path');
var astHandler = null;
if (args.astHandlerModule) {
    astHandler = require(args.astHandlerModule);
}

if (args.script_and_args.length === 0) {
    console.error("must provide script to record");
    process.exit(1);
}

// enable jalangji to skip folders that to be instrumented 
var folderExceptFromInstrument = [];
if (args.folderExceptFromInstrument != undefined &&  args.folderExceptFromInstrument.length > 0){
    args.folderExceptFromInstrument.forEach((folder => {
        folderExceptFromInstrument.push(path.resolve(folder));
    }));    
}

// we shift here so we can use the rest of the array later when
// hacking process.argv; see below
var script = args.script_and_args.shift();

var Module = require('module');
var path = require('path');
var fs = require('fs');
var originalLoader = Module._extensions['.js'];
var FILESUFFIX1 = "_jalangi_";

function makeInstCodeFileName(name) {
    return name.replace(/.js$/, FILESUFFIX1 + ".js").replace(/.html$/, FILESUFFIX1 + ".html");
}

function makeSMapFileName(name) {
    return name.replace(/.js$/, ".json");
}

acorn = require("acorn");

try {
  babel = require('babel-core');
  babel.transform('', { presets: ['es2017','es2015'] }); /* Precaches all dependencies o they dont get jalangi eval'd */
} catch (e) {}

esotope = require("esotope");
require('../headers').headerSources.forEach(function (header) {
    require("./../../../" + header);
});

var initParam = null;
if (args.initParam) {
    initParam = {};
    args.initParam.forEach(function (keyVal) {
        var split = keyVal.split(':');
        if (split.length !== 2) {
            throw new Error("invalid initParam " + keyVal);
        }
        initParam[split[0]] = split[1];
    });
}
J$.initParams = initParam || {};
if (args.analysis) {
    args.analysis.forEach(function (src) {
        require(path.resolve(src));
    });
}

Module._extensions['.js'] = function (module, filename) {    
    var code = fs.readFileSync(filename, 'utf8');

    // additional check to see if the file is except from in
    for(var i = 0; i < folderExceptFromInstrument.length; i++){
        if(filename.indexOf(folderExceptFromInstrument[i]) !== -1){
            module._compile(code, filename);
            return;
        }
    }

    var instFilename = makeInstCodeFileName(filename);
    var instCodeAndData = J$.instrumentCode(
        {
            code: code,
            isEval: false,
            origCodeFileName: filename,
            instCodeFileName: instFilename,
            inlineSourceMap: !!args.inlineIID,
            inlineSource: !!args.inlineSource
        });
    instUtil.applyASTHandler(instCodeAndData, astHandler, J$);
    fs.writeFileSync(makeSMapFileName(instFilename), instCodeAndData.sourceMapString, "utf8");
    fs.writeFileSync(instFilename, instCodeAndData.code, "utf8");
    
    module._compile(instCodeAndData.code, filename);
};

function startProgram() {
    // hack process.argv for the child script
    script = path.resolve(script);
    var newArgs = [process.argv[0], script];
    newArgs = newArgs.concat(args.script_and_args);
    process.argv = newArgs;
    // this assumes that the endExecution() callback of the analysis
    // does not make any asynchronous calls
    process.on('exit', function () { J$.endExecution(); });
    Module.Module.runMain(script, null, true);
}

if (J$.analysis && J$.analysis.onReady) {
    J$.analysis.onReady(startProgram);
} else {
    startProgram();
}
