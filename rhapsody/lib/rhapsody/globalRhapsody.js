'use strict';

module.exports = function globalRhapsody(root) {

  return {
    config: {
      db: require(root + '/config/database')
    },

    database: require('mongoose'),
    defaults: require(root + '/config/defaults'),

    generateModels: require('./models'),

    log: require('./logger'),

    models: {},

    /**
     * Returns the serverModel or the whole model
     * @param  {String} modelName The name of the model
     * @param  {[Boolean]} field     Optional. Makes return the whole model
     * @return {Model}
     */
    requireModel: function requireModel(modelName, complete) {
      if(complete) {
        return Rhapsody.models[modelName];
      }
      return Rhapsody.models[modelName].serverModel;
    },

    root: root
  };
};