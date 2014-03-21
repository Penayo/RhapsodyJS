'use strict';

var chai = require('chai'),
    http = require('http'),
    request = require('supertest');

chai.expect();
chai.should();
var expect = chai.expect;

var http = require('http'),
    server = require('./testProject/app'),
    app;


describe('Middlewares tests', function() {

    before(function() {
        server.open();
        app = server.app;
    });

    after(function() {
        server.close();
    });

    it('Should redirect if not logged', function(done) {
      request(app)
      .get('/admin')
      .expect(302)
      .end(done);
    });


});

