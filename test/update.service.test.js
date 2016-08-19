  'use strict';
  
  let chai = require('chai');
  let chaiAsPromised = require('chai-as-promised');
  let http = require('http');
  chai.use(chaiAsPromised);
  
  let expect = chai.expect;
  chai.should();
  
  let updateService = require('../update.service');

  
  
  // let updates = require('./updates.js');
  describe('Update Service getUpdates() Method Tests', () => {
    it('should be resolved', () => {
      return updateService.getDbUpdates().should.eventually.deep.equal({
        name: 'some name'
      });
    });
    
    it('See what happens', function() {
      let http = require('https');
      let options = {
        host: 'api.github.com',
        path: '/repos/request/request',
        headers: {
          'User-Agent': 'request'
        }
      };

      let cb = function(resp) {
        let d = '';
        resp.on('data', function(chunk) {
          d += chunk;
        });
        
        resp.on('end', function() {
          var dd = JSON.parse(d);
          console.log('stuff',JSON.stringify(dd,null,2));
        })
        
        resp.on('error', function(err) {
          console.log('ther is ero',err);
        })
      }
      // console.log('just before')
      // request.get(options).then(function() {
      //   console.log('Hapa je kwa promisify?');
      // })
      // .catch(function(err) {
      //   console.log('something terrible sana')
      // })
      var req = http.request(options,cb);
      //       req.on('error', (e) => {
      //   console.log('problem with request: ',e.message);
      // });
      // console.log(req)

      req.on('error', function(err) {
        console.log('some is wrong with request', err.message);
      })
      req.end();
      
    })
  })
