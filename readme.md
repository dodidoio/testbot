testbot
========

testbot is a utility and a library for testing bots using test scripts. The library can easily be extended for 
different bot messaging platforms. Its output uses the TAP protocol.

## Script format
The testbot utility reads script files and processes them. Each line in the script represents a step. Here is a sample script:
```
//line beginning with // are ignored
//question mark denotes a directive. ?param is used to set a parameter
?param packages dodido/test-basic
?param token some-token
//connect testbot. Use the param token
?connect
//wait for 1000 ms
?wait 1000
//lines are sent to the bot as an outgoing message
hello world
//line beginning with a tab are expected received message. If the message received doesn't match then an error is emmited
	Hello to you to
	Great talking to you
who are you
	I am a bot
	My name is Dodido
	What is yours?
John Doe
	Nice meeting you John Doe
?exit
should not get here
```
Here is the list of the step types that are supported:
* //remarks - line starts with //
* ?connect - connect the bot using the platform dependant APIs
* ?param {name} {value} - set a parameter. The parameter can later be used by the messaging platform plugin
* ?wait {ms} - wait for ms before continuing with the script
* \t{test text} - match received message with the text - the text must start with a tab.
* \t/{regular expression}/ - match received message with a regular expression

##Installing
Using npm

```bash
$ npm install testbot
```
##API
Run the script using the following code:
```js
require('testbot')('script-file-name','platform-name',{description:'initial parameters to uses when running the test});
```
##Command Line
Use the following command:

```bash
$ testbot {filename} {platform} --param1 value1 --param2 value2
```