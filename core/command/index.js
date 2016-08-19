var path = require('path');
var logger = require('../util/logger')('COMMAND');


/*
 * Each file included in this folder (except `index.js`) is a command and must export the following object
 * {
 *   execute: (...args) => void  | command itself
 * }
 *
 * The execute function should not have much logic
 */

/* Each and every command defined, including commands used in before/after */
var commandNames = [
  'echo',
  'genConfig',
  'openReport',
  'reference',
  'report',
  'test'
];

/* Commands that are only exposed to higher levels */
var exposedCommandNames = [
  'genConfig',
  'reference',
  'test',
  'openReport',
  'echo'
];

/* Used to convert an array of objects {name, execute} to a unique object {[name]: execute} */
function toObjectReducer (object, command) {
  object[command.name] = command.execute;
  return object;
}

var commands = commandNames
  .map(function requireCommand (commandName) {
    return {
      name: commandName,
      commandDefinition: require(path.join(__dirname, commandName))
    };
  })
  .map(function definitionToExecution (command) {
    return {
      name: command.name,
      execute: function execute(config) {
        logger.info('Executing core for `' + command.name + '`');

        var promise = command.commandDefinition.execute(config);

        // If the command didn't return a promise, assume it resolved already
        if (!promise) {
          logger.error('Resolved already:' + command.name);
          promise = Promise.resolve();
        }

        // Do the catch separately or the main runner
        // won't be able to catch it a second time
        promise.catch(function (error) {
          logger.error('Command `' + command.name + '` ended with an error');
          logger.error(error);
        });

        return promise.then(function (result) {
          logger.success('Command `' + command.name + '` sucessfully executed');
          return result;
        });
      }
    };
  })
  .reduce(toObjectReducer, {});

var exposedCommands = exposedCommandNames
  .filter(function commandIsDefined (commandName) {
    return commands.hasOwnProperty(commandName);
  })
  .map(function (commandName) {
    return {
      name: commandName,
      execute: commands[commandName]
    };
  })
  .reduce(toObjectReducer, {});

function execute (commandName, config) {
  if (!exposedCommands.hasOwnProperty(commandName)) {
    if (commandName.charAt(0) === '_' && commands.hasOwnProperty(commandName.substring(1))) {
      commandName = commandName.substring(1);
    } else {
      throw new Error('The command `' + commandName + '` is not exposed publicly.');
    }
  }

  return commands[commandName](config);
}

module.exports = execute;
