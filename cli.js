#!/usr/bin/env node
const parseArgs = require('minimist');
var args = parseArgs(process.argv.slice(2));
if(args._.length < 2){
	console.log('Missing arguments. Format must be:');
	showFormat();
	process.exit(1);
}
var filename = args._[1];
var botname = args._[0];
delete args._;
require('./index')(filename,botname,args);

function showFormat(){
	console.log('$ testbot {botname} {filename} --param1 value1 --param2 value2');
}