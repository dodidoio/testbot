const client = require('../../dodido-client');
var cid = require('uuid').v4();
const DEFAULT_TIMEOUT = 10000;

var _request = null;
var _question = null;
var _events = [];
var _listeners = [];
var evtId = 1;
var _requestActive = false;

///////////////////////////////////////////////////////////////////////////////
//managing state of requests and questions
///////////////////////////////////////////////////////////////////////////////
function activeRequest(){return _requestActive? _request : null;}
function activeQuestion(){return _question;}
function setRequest(req){
	function requestIsNotActive(){_requestActive = false;}
	req.then(requestIsNotActive,requestIsNotActive);
	_requestActive = true;
	_request = req;
	_question = null;
	_events = [];
	_listeners = [];//clear all listeners - we count on them timing-out so no need to reject them
}
function setQuestion(id,expecting){
	_question = {id:id,expecting:expecting};
}

function clearQuestion(id){
	if(_question.id === id){
		_question = null;
	}
}

function readEvent(evt,timeout){
	evt = Array.isArray(evt)? evt : [evt];
	if(!activeRequest()){
		//no active request - reject
		return Promise.reject('no active request');
	}
	//go over all cached events until the requested event type found
	while(_events.length > 0){
		var ret = _events.shift();
		for(let i=0;i<evt.length;++i){
			if(evt[i] === ret.event){
				return Promise.resolve(ret);
			}
		}
	}
	//no event in cache - create promise and add it to listeners
	return new Promise(function(resolve,reject){
		setTimeout(()=>{
			reject('timeout');
		},timeout || DEFAULT_TIMEOUT);
		_listeners.push({evt:evt,func:resolve});
	});
}

function writeEvent(evt){
	evt.id = evtId++;
	if(_listeners.length > 0){
		//there are listeners in line - if the first listener can handle the event then hanlde it
		let first = _listeners[0];
		for(let i=0;i<first.evt.length;++i){
			if(evt.event === first.evt[i]){
				return _listeners.shift().func(evt);
			}
		}
	}else{
		//no listeners waiting - just cache the event
		_events.push(evt);
	}
}
///////////////////////////////////////////////////////////////////////////////

module.exports = {
	connect : function(params){
		var server = params.server || 'wss://assist.dodido.io';
		var token = params.token || null;
		if(!token){
			return Promise.reject('connection token was missing');
		}
		var ret = client.connect(server,token);
		ret.on('opened',()=>{
			if(params.verbose){
				console.info('Connection to server opened');
			}
		});
		ret.on('error',(err)=>{
			if(params.verbose){
				console.error('Error connecting to server:',err);
			}
		});
		return ret;
	},
	
	sendText : function(text,params){
		if(activeRequest() && !activeQuestion()){
			//there is an active request and we are not waiting for an answer - wait until the request is completed
			return activeRequest().then(
				module.exports.sendText.bind(this,text,params),
				module.exports.sendText.bind(this,text,params));
		}
		if(params.verbose){
			console.info('user: ' + text);
		}
		//if there is a pending question then just answer it
		if(activeQuestion()){
			client.answer(activeQuestion().id,text,activeQuestion().expecting);
			clearQuestion(activeQuestion().id);
			return true;
		}
		const input = {
			input:text,
			packages : params.packages? params.packages.split(',') : [],
			token : params['request-token'] || null,
			userid : params['userid'] || null,
			expecting:params.expecting || 'action'
		};
		newRequest = client.request(input,cid);
		setRequest(newRequest);
		newRequest.on('error',(err)=>{
			writeEvent({event:'error',message:err});
			console.error(('Error sendingText - ' + err).red.bold);
			console.error(`\ttext is: ${text}`.red.bold);
		});
		newRequest.on('fail',()=>{
			writeEvent({event:'fail',message:{}});
			console.error(('Error parsing request: ' + text).red.bold);
		});
		newRequest.on('log',(message)=>{
			if(params.log){
				console.info('log: ' + message);
			}
		});
		newRequest.on('ask',(message,id,description,expecting)=>{
			setQuestion(id,expecting);
			if(params.verbose){
				console.info('bot asked: ' + text);
			}
			writeEvent({event:'ask',message:message,id:id,description:description,exepcting:expecting});
		});
		newRequest.on('say',(message)=>{
			if(params.verbose){
				console.info('bot: ' + text);
			}
			writeEvent({event:'say',message:message});
		});
		newRequest.then(()=>{
			//after request is completed remove it
		});
		return true;
	},
	
	receiveText : function(props){
		var timeout = props.timeout || DEFAULT_TIMEOUT;
		return readEvent(['say','ask'],timeout).then((evt)=>{
			return evt.message;
		},(err)=>{
			return Promise.reject(err);
		});
	},
	receiveEvent : function(eventName,props){
		var timeout = props.timeout || DEFAULT_TIMEOUT;
		return readEvent(eventName,timeout).then((evt)=>{
			return evt.message;
		},(err)=>{
			return Promise.reject(err);
		});
	},
	command : function(command,argText){
		if(command === 'clear'){
			//start a new context
			cid = require('uuid').v4();
		}
	}
};