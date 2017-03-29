const fs = require('fs');
const _ = require('underscore');
const readline = require('./getline');
const yaml = require('yamljs');
const colors = require('colors');
const handlebars = require('handlebars');

var steps = null;
var input = null;
var testCount = 0;
var errorCount = 0;
var lineNumber = 0;
var skip = false;
var filterFloat = function (value) {
	if(/^(\-|\+)?([0-9]+(\.[0-9]+)?|Infinity)$/.test(value))
		return Number(value);
	return NaN;
};

function template(text,params){
	return 	handlebars.compile(text)(params);

}
function isPromise(obj){
	return typeof obj.then === 'function';
}

function reportOk(description,info){
	testCount++;
	console.info('ok',testCount,description);
	if(info){
		console.info('  ---');
		console.info('  ',yaml.stringify(info));
		console.info('  ---');
	}
}

function reportNotOk(description,info){
	testCount++;
	errorCount++;
	console.info('not ok',testCount,description);
	if(info){
		console.info('  ---');
		console.info(yaml.stringify(info).split('\n').map((line)=>{return '  ' + line + '\n';}).join(''));
		console.info('  ...');
	}
	if(scriptParams.quitOnError){
		exit('Quit on first error');
	}
}

function reportError(){
	console.error(Array.from(arguments,(el)=>el.toString()).join(' ').red.bold);
}
function exit(reason){
	console.info(`# Completed. Success: ${testCount - errorCount}, Fail: ${errorCount}`);
	console.info(`1..${testCount}`);
	if(reason){
		console.info('Bail out!',reason);
	}
	if(scriptParams.beepOnExit){
		console.info('\007');
	}
	if(reason || errorCount > 0){
		process.exit(1);
	}else{
		process.exit(0);
	}
}

function handleWait(line){
	var match = line.match(/^\.wait\s+(\d+)$/);
	if(match){
		return new Promise(function(resolve,reject){
			setTimeout(function(){
				resolve(true);
			},filterFloat(match[1]));
		});
	}
	return false;
}

function handleEndSkip(line){
	if(line.match(/^\.skip end/)){
		skip = false;
		return true;
	}else{
		return false;
	}
}

function handleStartSkip(line){
	if(line.match(/^\.skip/)){
		skip = true;
		return true;
	}else{
		return false;
	}
}
function handleSkip(line,platform,params,lineNumber){
	if(skip){
		console.info('Skipping line',lineNumber);
		return true;
	}else{
		return false;
	}
}

function handleRemark(line){
	if(line.match(/^\s*\/\//)){
		return true;
	}else{
		return false;
	}
}

function handleRemark(line){
	if(line.match(/^\s*\/\//)){
		return true;
	}else{
		return false;
	}
}

function handleParam(line,platform,params){
	const match = line.match(/^\.param\s+(\S+)\s+(.+)$/);
	if(match){
		var val = template(match[2],params);
		if(val==="true")val = true;
		if(val==="false")val = false;
		if(!isNaN(filterFloat(val))) 
			val = filterFloat(val);
		params[match[1]] = val;
		if(params.verbose){
			console.info('set param',match[1],'to',JSON.stringify(val));
		}
		return true;
	}
	return false;
}

function handleExit(line,platform,params){
	if(line.match(/^\.exit/)){
		exit();
		return true;
	}
	return false;
}

function handleCommand(line,platform,params){
	if(line.match(/^\$(\S+)\s*(.*)?$/)){
		const match = line.match(/^\$(\S+)\s*(.*)?$/);
		platform.command(match[1],match[2]||null);
		return true;
	}
	return false;
}
function handleConnect(line,platform,params){
	if(line.match(/\^?connect/)){
		let ret = scriptPlatform.connect(params);
		ret.catch(function(err){
			exit('ERROR initializing test bot - ' + err);
		});
		return ret.then(function(){
			return true;
		});
	}
	return false;
}

function handleSendText(line,platform,params){
	return scriptPlatform.sendText(template(line,params),params);
}

function handleReceiveText(line,platform,params,lineNumber){
	const match = line.match(/^\t(.*)$/);
	if(!match){
		return false;
	}
	return scriptPlatform.receiveText(params).then((text)=>{
		let expected = template(match[1],params);
		if(text === expected){
			reportOk(expected + ":" + lineNumber,null);
		}else{
			reportNotOk(expected + ":" + lineNumber,{found:text,wanted:match[1]});
		}},(err)=>{
			reportNotOk(expected + ":" + lineNumber,{reason:err});
		});
}

function handleReceiveEvent(line,platform,params,lineNumber){
	const match = line.match(/^\t\\(\S+)(.*)$/);
	if(!match){
		return false;
	}
	return scriptPlatform.receiveEvent(match[1],params).then((obj)=>{
		/* jshint ignore:start */
		const ok = new Function('return ' + match[2]).call(obj);
		/* jshint ignore:end */
		if(ok){
			reportOk('event ' + match[1] + ":" + lineNumber,null);
		}else{
			reportNotOk('event ' + match[1] + ":" + lineNumber);
		}},(err)=>{
			reportNotOk('event ' + match[1] + ":" + lineNumber,{reason:err});
		});
}

function handleEmptyLine(line){
	return line.match(/^\s*$/);
}

function handleRegex(line,platform,params,lineNumber){
	const match = line.match(/^\t\/(.*)\/$/);
	if(!match){
		return false;
	}
	return scriptPlatform.receiveText(params).then((text)=>{
		let reg = template(match[1],params);
		let test = new RegExp(reg).exec(text);
		if(test){
			params.regex = test;
			reportOk(reg + ":" + lineNumber,null);
		}else{
			reportNotOk(reg + ":" + lineNumber,{found:text,wanted:match[1]});
		}},(err)=>{
			reportNotOk(reg + ":" + lineNumber,{reason:err});
		});
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                     handlers
const handlers = [
	handleEndSkip,
	handleSkip,
	handleEmptyLine, 
	handleStartSkip,
	handleRemark, 
	handleParam, 
	handleExit, 
	handleConnect, 
	handleWait, 
	handleRegex,
	handleReceiveEvent, 
	handleReceiveText,
	handleCommand, 
	handleSendText
];
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const scriptParams = {
	delay : 100,//delay in ms before sending request
	quitOnError : false,//should the program exit on first error
	timeout : 10000,//max time to wait for response from server
	beepOnExit : true,//beep when exiting the test
	nothing : null //last line
};
var scriptPlatform = null;

function testScript(filename,platform,params){
	console.info('TAP version 13');
	console.info('# Subtest:',filename);
	_.extend(scriptParams,params);
	steps = readline.createInterface({
		input: fs.createReadStream(filename)
	});

	steps.on('line', (line) => {
		steps.pause();
		lineNumber++;
		processStep(line,lineNumber);
	});
	steps.on('close', () => {
		exit();
	});

	//look for platform. If doesn't exits then bail out
	if(!platform){
		exit("No platform specified - cannot process script");
	}
	try{
		scriptPlatform = require('./platforms/' + platform);
	}catch(e){
		console.error(e);
		exit("There is no plugin for the '" + platform + "' platform.");
	}
}


function processStep(line,lineNumber){
	function nextStep(){
		steps.resume();
	}
	
	for(let i=0;i<handlers.length;++i){
		var result = handlers[i](line,scriptPlatform,scriptParams,lineNumber);
		if(result){
			//line is handled by this handler
			if(isPromise(result)){
				result.then(nextStep,nextStep);
			}else{
				setImmediate(nextStep);
			}
			return;
		}
	}
}

module.exports = testScript;
