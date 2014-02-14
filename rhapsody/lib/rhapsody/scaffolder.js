var fs = require('fs-extra'),
    path = require('path'),
    appPath = process.cwd(),
    Logger = require('./logger');

module.exports = {

  scaffoldApp: function scaffoldApp(appName, appPath, appVersion) {
    appPath = path.join(appPath, appName);

    Logger('Scaffolding app');
  
    try {
      fs.mkdirSync(appPath);
    }
    catch(e) {
      Logger.error(e.message);
    }

    //Copy the scaffold of a project to the app folder
    fs.copySync(path.join(__dirname, '/../scaffold'), appPath, function(err) {
      if(err) {
        return Logger.error(err);
      }
    });

    //Copy RhapsodyJS itself to node_modules
    fs.mkdirSync(path.join(appPath, '/node_modules'));
    fs.copySync(path.join(__dirname, '/../../'), path.join(appPath, '/node_modules/rhapsody'), function(err) {
      if(err) {
        return Logger.error(err);
      }
    });


    Logger('Generating package.json');
    //Generate package.json
    var packageFile = {
      'name': appName,
      'main': 'app',
      'dependencies': {
        'rhapsody': ('~' + appVersion)
      }
    };

    fs.writeJSON(path.join(appPath, '/package.json'), packageFile, function(err) {
      if(err) {
        //If it fails, delete the folder created to the app
        fs.remove(appPath, function(err) {

        });
        return Logger.error(err);
      }
    });
  },

  scaffoldModel: function scaffoldModel(modelName, attributes) {
    var model = {
      attributes: {
      },

      sharedMethods: {
      },

      clientMethods: {

      },

      serverMethods: {
        
      },

      options: {
        allowREST: true,
        middlewares: []
      }
    };

    var attr, i, attribute;

    //Fills the model attributes with it's types
    for(i = 0; i < attributes.length; i++) {
      attr = attributes[i];
      attribute = attr.split(':');
      if(attribute.length === 2) {
        model.attributes[attribute[0]] = {
          type: attribute[1]
        }
      }
      else {
        return Logger.error('You forgot an attribute type');
      }
    }

    var modelString = 'var ' + modelName + ' = ';
    modelString += JSON.stringify(model, null, '\t');
    modelString += ';';
    modelString += '\n\nmodule.exports = ' + modelName;

    try {
      fs.writeFile(path.join(appPath, '/models/' + modelName + '.js'), modelString, function(err) {
        if(err) {
          return Logger.error(err);
        }
      });
    }
    catch(e) {
      throw e;
    }
  },

  scaffoldController: function scaffoldController(controllerName, views) {

  }

};


