'use strict';

var fs = require('fs'),
    _ = require('lodash'),
    responses = require('./responses'),
    path = require('path');

/**
 * Gotta remember that:
 *   - A subcontroller should not have the same name of a view of its supercontroller
 *   - A first-level controller should not have the same name of a view of mainController
 */

var Router = function(rhapsodyApp) {
  this.app = rhapsodyApp.app;
  this.rhapsody = rhapsodyApp;
}

Router.prototype = {

  /**
   * Create all the controller routes
   */
  routeControllers: function routeController() {

    // Define the main controller as the root of the server
    this.routeSingleController({
      path: path.join(this.rhapsody.root, '/app/controllers/' + this.rhapsody.config.defaults.routes.mainController),
      subs: []
    }, true);

    //Create all the other routes based on BFS
    var queue = [],
        currentController,
        exploringFirstLevelControllers = true,
        folderRegex = /^[^\s.]+$/,
        files;

    queue.push({
      path: path.join(this.rhapsody.root, '/app'), // The path for the controller folder
      subs: []    // The subpaths to be routed (like: if the URL is localhost/controller/subcontroller, the subs gonna be ['controller', 'subcontroller'])
    });

    while(queue.length !== 0) {
      currentController = queue.shift();

      //Don't look for the controller file in the first iteration
      if(!exploringFirstLevelControllers) { 
        this.routeSingleController(currentController); //Routes the currentController controller
      }

      try {
        //Read all the files and folders of current 'controllers' directory 
        files = fs.readdirSync(path.join(currentController.path, '/controllers'));

        if(exploringFirstLevelControllers) {
          exploringFirstLevelControllers = false;

          if(files.indexOf('static') !== -1) {
            throw {message: 'A first-level controller can\'t be named "static"', name: 'InvalidControllerName'};
          }
          if(files.indexOf('data') !== -1) {
            throw {message: 'A first-level controller can\'t be named "data"', name: 'InvalidControllerName'};
          }
          if(files.indexOf('backbone-models') !== -1) {
            throw {message: 'A first-level controller can\'t be named "backbone-models"', name: 'InvalidControllerName'};
          }

        }

        //Read all subcontrollers and put in on the queue to be routed
        files.forEach(function(file) {
          if(folderRegex.test(file)) {
            var newPath = currentController.path + '/controllers/' + file,
                newSubs = _.cloneDeep(currentController.subs);
            
            newSubs.push(file);

            var newSubController = {
              path: newPath,
              subs: newSubs
            };

            queue.push(newSubController);
          }
        });
      }
      catch(e) {
        //Falls here when try to reach controllers that doesn't exist or find controller with invalid name
        if(e.name === 'InvalidControllerName') {
          throw e;
        }
      }
    }

  },

  /**
   * Route all the views of a controller
   * @param  {Object} controllerInfo  Contains the subs and the path for the controller
   * @param {String} serverRoot If it's routing the server root, import serverRoot controller
   */
  routeSingleController: function routeSingleController(controllerInfo, serverRoot) {
    var controller = require(controllerInfo.path + '/');

    var views = controller.views,
        subs = controllerInfo.subs.join('/');

    for(var viewName in views) {
      if(views.hasOwnProperty(viewName)) {
        var view = views[viewName];

        //If it's routing the server root, must change
        if(serverRoot) {
          //Workaround for when a root view uses custom verb
          var rootViewAction = viewName.split(':');
          var rootViewName = (rootViewAction.length == 1 ? rootViewAction[0] : rootViewAction[1]);

          if(rootViewName === 'static') {
            throw {message: 'A root view can\'t be named "static"', name: 'InvalidViewName'};
          }
          if(rootViewName ===  'data') {
            throw {message: 'A root view controller can\'t be named "data"', name: 'InvalidViewName'};
          }
          if(rootViewName === 'backbone-models') {
            throw {message: 'A root view controller can\'t be named "backbone-models"', name: 'InvalidViewName'};
          }

          this.bindView(viewName, view, controllerInfo, subs, '/' + rootViewName);
        }
        else {
          this.bindView(viewName, view, controllerInfo, subs);
        }

      }
    }


    //Routes the main view of the controller
    this.bindView(controller.mainView || this.rhapsody.config.defaults.routes.mainView, 
    views[controller.mainView || this.rhapsody.config.defaults.routes.mainView],
    controllerInfo,
    subs,
    '/' + subs + '/?');
  },

  /**
   * Binds a route of a view
   * @param  {String} viewName        The name of the view. Optionally containing its verb
   * @param  {*} view                 A string, object or function with the view
   * @param  {Object} controllerInfo  Contains the subs and the path for the controller
   * @param  {String} subs            The subpaths to this view
   * @param  {String} routingPath     Optional. The path that's going to be routed.
   */
  bindView: function bindView(viewName, view, controllerInfo, subs, routingPath) {
    var viewPath,
        verb,
        params;

    //Check if the view has a custom verb
    //If not, set is as GET
    var action = viewName.split(':');
    if(action.length == 1) {
      viewPath = action[0],
      verb = 'get';
    }
    else {
      viewPath = action[1];
      verb = action[0];
    }

    // The URL that's gonna be routed
    routingPath = routingPath || '/' + subs + '/' + viewPath;

    //The function that will be binded to the route
    var bindedFuncion;

    //If the view accept options
    if(view != null && typeof view === 'object') {

      //If the path accepts parameters, put it on the URL
      if(typeof view.params !== 'undefined') {
        params = view.params.join('/');
        routingPath += '/' + params;
      }

      //Extract the function to be binded
      bindedFuncion = this.extractFunction(view.action, controllerInfo);

      //Finally binds the path
      this.app[verb](routingPath, bindedFuncion);

      //If the view has customRoutes
      if(typeof view.customRoutes !== 'undefined') {
        var customRoutes = view.customRoutes;
        //The user can pass a single custom route or an array
        //If a single route is passed, make it an array
        if(!_.isArray(customRoutes)) {
          customRoutes = [customRoutes];
        }
        for(var i = 0; i < customRoutes.length; i++) {
          var pathToBeRouted = customRoutes[i] + '/' + params;
          //Binds the custom route
          this.app[verb](pathToBeRouted, bindedFuncion);
        }
      }
    }

    //If the view doesn't accept options, extract the function
    else {
      this.app[verb](routingPath, this.extractFunction(view, controllerInfo));
    }
  },

  /**
   * Extract the function to be binded of a view
   * @param  {Object} view The view object
   * @return {Function}      The function to be binded
   */
  extractFunction: function extractFunction(view, controllerInfo) {
    //If it's a function, just return it
    if(typeof view === 'function') {
      return view;
    }
    //If it's just the path to a static file, send it
    else if(typeof view === 'string') {
      var realPath = controllerInfo.path + '/views/' + view;
      return function(req, res) {
        res.sendfile(realPath);
      };
    }
  },

  /**
   * Binds the routes for REST access
   */
  routeModelsREST: function routeModelsREST() {

    /**
     * Response codes based on
     * http://developer.yahoo.com/social/rest_api_guide/http-response-codes.html
     */
    
    /**
     * TODO:
     * 401 response code if access to model needs authentication
     */
    
    /* CREATE */
    this.app.post('/data/:model', function create(req, res) {
      var mongoModel = Rhapsody.requireModel(req.params.model);

      if(!mongoModel) {
        return responses.respond(res, 400); //Malformed syntax or a bad query
      }

      var dataToCreate = req.body;
      //Creates the new data and populates with the post fields
      var newData = new mongoModel(dataToCreate);
      newData.save(function createData(err) {
        if(err) {
          if(err.name === 'ValidationError') {
            responses.respond(res, 400); //Malformed syntax or a bad query
          }
          responses.respond(res, 500); //Internal server error
        }
        else {
         responses.json(res, 201, newData); //Sucessful creation
        }
      });
    });

    /* READ */
    this.app.get('/data/:model/:id?', function read(req, res) {
      var mongoModel = Rhapsody.requireModel(req.params.model);

      if(!mongoModel) {
        return responses.respond(res, 400); //Malformed syntax or a bad query
      }

      //If id not specified, return all data from the model
      if(typeof req.params.id === 'undefined') {
        mongoModel.find({}, function readAllData(err, data) {
          if(err) {
            responses.respond(res, 500); //Internal server error
          }
          else {
            responses.json(res, 200, data); //No error, operation successful
          }
        });
      }
      else {
        mongoModel.findOne({_id: req.params.id}, function readData(err, data) {
          if(err) {
            responses.respond(res, 500); //Internal server error
          }
          else {
            if(data === null) {
              responses.respond(res, 404); //Resource not found
            }
            else {
              responses.json(res, 200, data); //No error, operation successful
            }
          }
        });
      }
    });

    /* UPDATE */
    this.app.put('/data/:model/:id', function update(req, res) {
      var mongoModel = Rhapsody.requireModel(req.params.model);

      if(!mongoModel) {
        return responses.respond(res, 400); //Malformed syntax or a bad query
      }

      var dataToUpdate = req.body;
      mongoModel.update({_id: req.params.id}, dataToUpdate, function updateData(err, data) {
        if(err) {
          if(err.name === 'ValidationError') {
            responses.respond(res, 400); //Malformed syntax or a bad query
          }
          responses.respond(res, 500); //Status code for service error on server
        }
        else {
          responses.respond(res, 202); //The request was received
        }
      });
    });

    /* DELETE */
    this.app.del('/data/:model/:id', function del(req, res) {
      var mongoModel = Rhapsody.requireModel(req.params.model);

      if(!mongoModel) {
        return responses.respond(res, 400); //Malformed syntax or a bad query
      }

      mongoModel.remove({_id: req.params.id}, function deleteData(err) {
        if(err) {
          responses.respond(res, 500); //Status code for service error on server
        }
        else {
          responses.respond(res, 202); //The request was received
        }
      });
    });
  }
};

module.exports = Router;