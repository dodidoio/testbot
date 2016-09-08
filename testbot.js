//testbot.js

/**
testbot is a utility for testing slackbots. It is deployed as a bot on slack defined in a config file. The format
for executing the bot is
	node testbot [filename]
Each line in he config file is executed in order. Here is a list of possible types of lines
	//[any text] - this is a remark
	[any text] - a text to send to the bot
	\t[any text] - a text to receive from the bot. If the text doesn't match then record a FAIL. Otherwise record a SUCCESS
	\t/[regext]/ - same as previous only accept a regular expression
	?connect [the bot token] - the token to use when connecting with slack
	?param - set a parameter for program execution. Here are possible parameters
		target - the name of the target bot to address
	?exit - exit program immediately. This can be used when a full test file was created but only part of it tests
	code parts that were actually developed. There is no use running the whole test yet.
	
*/
//modules
var fs = require('fs');
//globals
var rtm = null;
var self = null;
var steps = [];
var pos = -1;
var params = {
	target : 'elshor',					//the target robot or person - send messages to this user
	delay : 100,//delay in ms before sending request to dodido
	quitOnError : false,//should the program exit on first error
	timeout : 10000,//max time to wait for response from server
	beepOnExit : true,//beep when exiting the test
	nothing : null //last line
};

//last message received - we store it in global context so we can run several regular expression searches
var lastMessage = "";

function loadFileAsSteps(){
	var text = fs.readFileSync(params.testfile,'utf8');
	steps = text.split('\n');
}

function exit(){
	printSummary();
	if(params.beepOnExit)console.log('\007');
	process.exit();
}

function executeNextStep(previousStep){
	console.assert(typeof previousStep !== 'undefined');
	var stepPos = ++pos;
	var match = null;
	setImmediate(_executeNextStep.bind(this,stepPos));
}

function _executeNextStep(stepPos){
	console.assert(stepPos === pos,"Pos does not match stepPos. Pos is "+pos+", stepPos is "+stepPos);
	var match = null;
	if(stepPos >= steps.length){
		//completed processing
		exit();
	}
	var step = steps[stepPos];

	//it is an empty line
	if(step.trim().length === 0){
		reportStep('EMPTY',stepPos);
		executeNextStep(stepPos);
	}
	//it is a remark
	else if(step.trim().indexOf('//') === 0){
		reportStep('REMARK',stepPos);
		executeNextStep(stepPos);
	}

	//it is a receive message for previous request - call receive message
	else if(step.match(/^\t\+/)){
		receiveMessage(lastMessage);
	}

	//it is a receive
	else if(step[0] === '\t'){
		//do nothing - wait for message to be received
	}

	//it is a send
	else{
		var message = step.trim();
		console.assert(message && message.length > 0,"Message cannot be null or with length zero - "+step+" stepPos is " + stepPos);
		sendMessage(message,params.delay,stepPos);
	}
}

