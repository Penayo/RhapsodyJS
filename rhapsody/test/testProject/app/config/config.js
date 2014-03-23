module.exports = {
  environment: 'dev',

  routes: {
    //Controller used when access the app's root
    mainController: 'main',

    //View used when the user doen't specify it
    mainView: 'index',

    //If must be created REST routes for models
    allowREST: true
  },

  generateBackboneModels: true
};