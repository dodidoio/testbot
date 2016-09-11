const fs = require('fs');
const _ = require('underscore');
const readline = require('./getline');
const yaml = require('yamljs');
var steps = null;
var input = null;
var testCount = 0;

var filterFloat = function (value) {
	if(/^(\-|\+)?([0-9]+(\.[0-9]+)?|Infinity)$/.test(value))
		return Number(value);
	return NaN;
};

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
	console.info('not ok',testCount,description);
	if(info){
		console.info('  ---');
		console.info(yaml.stringify(info).split('\n').map((line)=>{return '  ' + line + '\n';}).join(''));
		console.info('  ...');
	}
}

function exit(reason){
	console.info(`1..${testCount}`);
	if(reason){
		console.info('Bail out!',reason);
	}
	if(scriptParams.beepOnExit){
		console.info('\007');
		process.exit(0);
	}
}

function handleWait(line){
	var match = line.match(/^\?wait\s+(\d+)$/);
	if(match){
		return new Promise(function(resolve,reject){
			setTimeout(function(){
				resolve(true);
			},filterFloat(match[1]));
		});
	}
	return false;
}

function handleRemark(line){
	if(line.match(/^\s*\/\//)){
		return true;
	}else{
		return false;
	}
}

function handleParam(line,platform,params){
	const match = line.match(/^\?param\s+(\S+)\s+(.+)$/);
	if(match){
		var val = match[2];
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
	if(line.match(/\^?exit/)){
		exit();
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
	return scriptPlatform.sendText(line,params);
}

function handleReceiveText(line,platform,params){
	const match = line.match(/^\t(.*)$/);
	if(!match){
		return false;
	}
	return scriptPlatform.receiveText(params).then((text)=>{
		if(text === match[1]){
			reportOk(match[1]);
		}else{
			reportNotOk(match[1],{found:text,wanted:match[1]});
		}},(err)=>{
			reportNotOk(match[1],{reason:err});
		});
}

function handleEmptyLine(line){
	return line.match(/^\s*$/);
}

function handleRegex(line,platform,params){
	const match = line.match(/^\t\/(.*)\/$/);
	if(!match){
		return false;
	}
	return scriptPlatform.receiveText(params).then((text)=>{
		if(new RegExp(match[1]).test(text)){
			reportOk(match[1]);
		}else{
			reportNotOk(match[1],{found:text,wanted:match[1]});
		}},(err)=>{
			reportNotOk(match[1],{reason:err});
		});
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                     handlers
const handlers = [handleEmptyLine, handleRemark, handleParam, handleExit, handleConnect, handleWait, handleRegex, 	
									handleReceiveText, handleSendText
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
		//console.log('LINE',line);
		steps.pause();
		processStep(line);
	});

	//look for platform. If doesn't exits then bail out
	if(!platform){
		exit("No platform specified - cannot process script");
	}
	try{
		scriptPlatform = require('./platforms/' + platform);
	}catch(e){
		console.log(e);
		exit("There is no plugin for the '" + platform + "' platform.");
	}
}


function processStep(line){
	function nextStep(){
		steps.resume();
	}
	
	for(let i=0;i<handlers.length;++i){
		var result = handlers[i](line,scriptPlatform,scriptParams);
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
