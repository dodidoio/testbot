#!/usr/bin/env node
const parseArgs = require('minimist');
var args = parseArgs(process.argv.slice(2));

if(args.help){
	if(typeof args.help === 'string'){
		try{
			let text = require('./platforms/'+args.help).help();
			console.info('Platform specific options for ' + args.help);
			console.info(text);
		}catch(e){
			console.info(`No specific help found for platform '${args.help}'. Here is the general help info:`);
			showFormat();
			process.exit(0);
		}
	}else{
		showFormat();
	}
	process.exit(0);
}

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
	[
		'$ testbot {botname} {filename} --param1 value1 --param2 value2',
		'For platform specific help write $ testbot --help platform',
		"Each script line is processed in order. The following script line formats are supported",
		"\t//line beginning with // are ignored",
		"\t.param param-name param-value",
		"\t.connect\ttconnect to the dodido server",
		"\t.wait ms-to-wait",
		"\t.exit\texit the script processing",
		"\tlines not starting with dot are sent to the bot as an outgoing message",
		"\tlines starting with tab represent expected response",
		"\t/expected response regular expression/",
		"\t\\{event} {js expression} - Wait for  event and test its json (this is the event json)",
		"${command}\t execute a platform specific command",
		].forEach((line)=>console.info(line));
}