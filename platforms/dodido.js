const client = require('../../dodido-client');
const cid = require('uuid').v4();
const DEFAULT_TIMEOUT = 10000;
var request = null;
var question = null;
var _events = [];
var _listeners = [];
var evtId = 1;

function setRequest(req){
	//console.log('SET REQUEST');
	request = req;
	question = null;
	_events = [];
	_listeners = [];//clear all listeners - we count on them timing-out so no need to reject them
}
function setQuestion(id,expecting){
	question = {id:id,expecting:expecting};
}

function clearQuestion(id){
	if(question.id === id){
		question = null;
	}
}

function readEvent(timeout){
	//console.log('CALL',timeout);
	if(!request){
		//no active request - reject
		return Promise.reject('no active request');
	}
	else if(_events.length > 0){
		//an event is already in cache -return it
		var ret = _events.shift();
		//console.log('READ',ret);
		return Promise.resolve(ret);
	}else{
		//no event in cache - create promise and add it to listeners
		return new Promise(function(resolve,reject){
			setTimeout(()=>{
				reject('timeout');
			},timeout || DEFAULT_TIMEOUT);
			_listeners.push(resolve);
		});
	}
}

function writeEvent(evt){
	evt.id = evtId++;
	//console.log('WRITE',evt);
	if(_listeners.length > 0){
		//there are listeners in line - pass the event to the first listener
		//console.log('READ',evt);
		_listeners.shift()(evt);
	}else{
		//no listeners waiting - just cache the event
		_events.push(evt);
	}
}

module.exports = {
	connect : function(params){
		var server = params.server || 'wss://assist.dodido.io';
		var token = params.token || null;
		if(!token){
			return Promise.reject('connection token was missing');
		}
		return client.connect(server,token);
	},
	
	sendText : function(text,params){
		//if there is a pending question then just answer it
		if(question){
			client.answer(question.id,text,question.expecting);
			clearQuestion(question.id);
			return true;
		}
		const expecting = params.expecting || 'action';
		const packages = params.packages? params.packages.split(',') : [];
		const input = {
			input:text,
			packages : packages,
			expecting:expecting
		};
		newRequest = client.request(input,cid);
		setRequest(newRequest);
		request.on('error',(err)=>{
			console.error('Error sendingText -',err);
		});
		request.on('ask',(message,id,description,expecting)=>{
			setQuestion(id,expecting);
			writeEvent({event:'ask',message:message,id:id,description:description,exepcting:expecting});
		});
		request.on('say',(message)=>{
			writeEvent({event:'say',message:message});
		});
		request.then(()=>{
			//after request is completed remove it
		});
		return true;
	},
	
	receiveText : function(props){
		var timeout = props.timeout || DEFAULT_TIMEOUT;
		return readEvent(timeout).then((evt)=>{
			return evt.message;
		},(err)=>{
			return Promise.reject(err);
		});
	}
};