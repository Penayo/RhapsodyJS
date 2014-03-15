'use strict';

var path = require('path'),
    _ = require('lodash'),
    Wolverine = require('wolverine'),
    Logger = new Wolverine();

var Rhapsody = function Rhapsody(options) {

  var ControllerRouter = require('./rhapsody/router/controllerRouter');
  var ModelRouter = require('./rhapsody/router/modelRouter');

  this.express = require('express');
  this.app = this.express();
  
  this.root = options.root;

  this.router = {
    controllerRouter: new ControllerRouter(this),
    modelRouter: new ModelRouter(this)
  };

  this.config = require(path.join(options.root, '/app/config/config'));

  //Get the general environment settings
  _.extend(this.config, require(path.join(options.root, '/app/config/envs/all')));

  //Overwrite it with the defined environment settings
  _.extend(this.config, require(path.join(options.root, '/app/config/envs/' + this.config.environment)));

  //Then extends it with the other settings
  _.extend(this.config, {
    session: require(path.join(options.root, '/app/config/session')),
    templateEngines: require(path.join(options.root, '/app/config/template-engines')),
    error: require(path.join(options.root, '/app/config/error/error')),
    options: options
  });

  this.log = require('./rhapsody/logger')(this.config.log);

  var self = this;

  //If some uncaufh exception occurs, print it and then kill the process
  process.on('uncaughtException', function(err){
      self.log.fatal(err);
      process.exit(1);
  });

  this.models = {};

  //Expose object as global
  //Should fix it latter
  global.Rhapsody = this;

};

Rhapsody.prototype = {
  generateModels: require('./rhapsody/models'),

  /**
   * Returns the serverModel or the whole model
   * @param  {String} modelName The name of the model
   * @param  {Boolean} full     Optional. Makes return the whole model
   * @return {Model}
   */
  requireModel: function requireModel(modelName, full) {
    var model = this.models[modelName];

    if(full) {
      return (model ? model : false);
    }
    return (model ? model.serverModel : false);
    
  },

  /**
   * Configure the server before open it
   */
  configure: function configure() {
    //If database is enabled, configure it
    if(this.config.database.active) {
      this.database = require('mongoose');
      try {
        this.dbConnection = this.database.createConnection(this.config.database.host, this.config.database.name);
      }
      catch(e) {
        console.error(e.message);
      }

      //Create the models and put it on this.models
      this.generateModels(this, this.config.options.build);
    }


    //Configure express
    this.app.use(this.express.json()); //Parses the request body to JSON
    this.app.use(this.express.urlencoded()); //Actives URL encoded support
    this.app.use(this.express.cookieParser(this.config.session.cookiesSecret)); //Actives cookie support
    this.app.use(this.express.session({ //Actives session support
      secret: this.config.session.sessionSecret
    }));

    //Uses consolidate to support the template engines
    var engineRequires = this.config.templateEngines.engines,
        engines = require('./utils/consolidate')(engineRequires),
        templateEngines = this.config.templateEngines.engines;

    this.app.set('view engine', this.config.templateEngines.defaultEngine); //Set the default view engine

    //Require all the registered view engines
    for(var engine in templateEngines) {
      this.app.engine(templateEngines[engine].extension, engines[engine]);
    }

    this.app.use(this.app.router); //Use the custom routes above the static and backbone-models
    this.app.use('/static', this.express.static(this.root + '/app/static')); //Static files should be here
    //Backbone models should be here for facility
    //the generated models will be in /backbone-models/gen/ModelName.js
    this.app.use('/backbone-models', this.express.static(this.root + '/app/backbone-models'));
    this.app.use(this.config.error.error404Handler);

    //Configure the routes
    this.router.controllerRouter.route();
    if(this.config.routes.allowREST) {
      this.router.modelRouter.route();
    }
  },

  open: function open(callback) {
    //Configure the server before run it
    this.configure();

    var port = this.config.port;
    this.server = this.app.listen(port);
    Logger.info('Listening port ' + port);

    if(callback) {
      callback(this.server);
    }
  },

  close: function close() {
    this.server.close();
    Logger.warn('Server closed');
  }
};


module.exports = Rhapsody;
