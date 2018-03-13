// Karma configuration
// Generated on Sun Jul 30 2017 11:20:45 GMT+0200 (CEST)
var webpackConfig = require('./webpack.config');
var fs = require('fs');
module.exports = function(config) {
  var cfg = {
    client: {
      mocha: {
        bail:true
      }
    },
    customLaunchers: {
      Chrome_travis_ci: {
        base: 'Chrome',
        flags: [
          // '--no-sandbox',
        // '--disable-web-security',
        // '--allow-insecure-localhost',
        ]
      }
    },
    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',
    mime: {
      'text/x-typescript': ['ts','tsx']
    },

    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['mocha', 'chai', 'sinon'],
    preprocessors: {
      "**/*.ts": ["webpack"], // *.tsx for React Jsx
    },

    // list of files / patterns to load in the browser
    files: [
      'tests/integration/*spec.ts',
      'tests/unit/*spec.ts'
    ],


    // list of files to exclude
    exclude: [
    ],


    webpack: webpackConfig[0],

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['progress'],


    // web server port
    port: 9876,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,

    hostname: 'localhost',

    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: false,


    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['Chrome'],


    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: true,

    // Concurrency level
    // how many browser should be started simultaneous
    concurrency: Infinity,
    httpsServerOptions: {
      key: fs.readFileSync('./tests/assets/key.pem'),
      cert: fs.readFileSync('./tests/assets/cert.pem'),
      requestCert: false,
      rejectUnauthorized: false
    },
    protocol: 'https:',
    browserNoActivityTimeout: 1000000,
    browserDisconnectTolerance: 1000000,
  };
  if (process.env.TRAVIS) {
    cfg.browsers = ['Chrome_travis_ci'];
  }
  config.set(cfg)
};