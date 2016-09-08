//this is an adaptation of nodejs getline. In the nodejs implementation, pause does not pause the line events.
//In this implementation it does by caching all lines received after pause
const readline = require('readline');
const EventEmitter = require('events');
const _ = require('underscore');

/**
 * A wrapper for the readline interface. If paused then cache the line and close events
 * @param {[[Type]]} data [[Description]]
 */
function Interface(data){
	this._base = readline.createInterface(data);
	this._state = 'active';
	this._cache = [];
	this._base.on('line',(line)=>{
		if(this._state === 'active'){
			this.emit('line',line);
		}else{
			this._cache.push(line);
		}
	});
	this._base.on('close',()=>{
		if(this._state === 'active'){
			ret.emit('close');
		}else{
			this._cache.push({event:'close'});
		}
	});
}
_.extend(Interface.prototype,EventEmitter.prototype);

Interface.prototype.resume = function(){
	this._state = 'cached';
	this.emitFromCache();
};

Interface.prototype.emitFromCache = function(){
	if(this._state === 'cached'){
		if(this._cache.length === 0){
			//no more events in cache - change state to active
			this._state = 'active';
		}else{
			var next = this._cache.shift();
			if(typeof next === 'string'){
				this.emit('line',next);
			}
			if(next.event === 'close'){
				this.emit('close');
			}
			this.emitFromCache();
		}
	}
};

Interface.prototype.pause = function(){
	this._state = 'paused';
};

module.exports.createInterface = function(data){
	return new Interface(data);
};
