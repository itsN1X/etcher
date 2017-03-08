/*
 * Copyright 2016 resin.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

/**
 * @module Etcher.Modules.Analytics
 */

const _ = require('lodash');
_.mixin(require('lodash-deep'));
const angular = require('angular');
const username = require('username');
const isRunningInAsar = require('electron-is-running-in-asar');
const app = require('electron').remote.app;
const packageJSON = require('../../../package.json');
const path = require('path');

// Force Mixpanel snippet to load Mixpanel locally
// instead of using a CDN for performance reasons
window.MIXPANEL_CUSTOM_LIB_URL = '../../bower_components/mixpanel/mixpanel.js';

require('../../../bower_components/mixpanel/mixpanel-jslib-snippet.js');
require('../../../bower_components/angular-mixpanel/src/angular-mixpanel');
const MODULE_NAME = 'Etcher.Modules.Analytics';
const analytics = angular.module(MODULE_NAME, [
  'analytics.mixpanel',
  require('../models/settings')
]);

/**
 * @summary Create an object copy with all absolute paths replaced with the path basename
 * @function
 * @private
 *
 * @param {Object} object - original object
 * @returns {Object} transformed object
 *
 * @example
 * const anonymized = hidePaths({
 *   path1: '/home/john/rpi.img',
 *   simpleProperty: null,
 *   nested: {
 *     path2: '/home/john/another-image.img',
 *     path3: 'yet-another-image.img',
 *     otherProperty: false
 *   }
 * });
 *
 * console.log(anonymized);
 * > {
 * >   path1: 'rpi.img',
 * >   simpleProperty: null,
 * >   nested: {
 * >     path2: 'another-image.img',
 * >     path3: 'yet-another-image.img',
 * >     otherProperty: false
 * >   }
 * > }
 */
const hidePaths = (object) => {
  return _.deepMapValues(object, (value) => {
    return _.isString(value) && path.isAbsolute(value) ? path.basename(value) : value;
  });
};

// Mixpanel integration
// https://github.com/kuhnza/angular-mixpanel

analytics.config(($mixpanelProvider) => {
  $mixpanelProvider.apiKey('63e5fc4563e00928da67d1226364dd4c');

  $mixpanelProvider.superProperties({

    /* eslint-disable camelcase */

    distinct_id: username.sync(),

    /* eslint-enable camelcase */

    electron: app.getVersion(),
    node: process.version,
    arch: process.arch,
    version: packageJSON.version
  });
});

// TrackJS integration
// http://docs.trackjs.com/tracker/framework-integrations

analytics.run(($window) => {

  // Don't configure TrackJS when
  // running inside the test suite
  if (window.mocha) {
    return;
  }

  $window.trackJs.configure({
    userId: username.sync(),
    version: packageJSON.version
  });
});

analytics.service('AnalyticsService', function($log, $window, $mixpanel, SettingsModel) {

  /**
   * @summary Log a debug message
   * @function
   * @public
   *
   * @description
   * This function sends the debug message to TrackJS only.
   *
   * @param {String} message - message
   *
   * @example
   * AnalyticsService.log('Hello World');
   */
  this.logDebug = (message) => {
    const debugMessage = `${new Date()} ${message}`;

    if (SettingsModel.get('errorReporting') && isRunningInAsar()) {
      $window.trackJs.console.debug(debugMessage);
    }

    $log.debug(debugMessage);
  };

  /**
   * @summary Log an event
   * @function
   * @public
   *
   * @description
   * This function sends the debug message to TrackJS and Mixpanel.
   *
   * @param {String} message - message
   * @param {Object} [data] - event data
   *
   * @example
   * AnalyticsService.logEvent('Select image', {
   *   image: '/dev/disk2'
   * });
   */
  this.logEvent = (message, data) => {
    const anonymizedData = hidePaths(data);

    if (SettingsModel.get('errorReporting') && isRunningInAsar()) {

      // Clone data before passing it to `mixpanel.track`
      // since this function mutates the object adding
      // some custom private Mixpanel properties.
      $mixpanel.track(message, _.clone(anonymizedData));

    }

    const debugMessage = _.attempt(() => {
      if (anonymizedData) {
        return `${message} (${JSON.stringify(anonymizedData)})`;
      }

      return message;
    });

    this.logDebug(debugMessage);
  };

  /**
   * @summary Check whether an error should be reported to TrackJS
   * @function
   * @private
   *
   * @description
   * In order to determine whether the error should be reported, we
   * check a property called `report`. For backwards compatibility, and
   * to properly handle errors that we don't control, an error without
   * this property is reported automatically.
   *
   * @param {Error} error - error
   * @returns {Boolean} whether the error should be reported
   *
   * @example
   * if (AnalyticsService.shouldReportError(new Error('foo'))) {
   *   console.log('We should report this error');
   * }
   */
  this.shouldReportError = (error) => {
    return !_.has(error, 'report') || Boolean(error.report);
  };

  /**
   * @summary Log an exception
   * @function
   * @public
   *
   * @description
   * This function logs an exception in TrackJS.
   *
   * @param {Error} exception - exception
   *
   * @example
   * AnalyticsService.logException(new Error('Something happened'));
   */
  this.logException = (exception) => {
    if (_.every([
      SettingsModel.get('errorReporting'),
      isRunningInAsar(),
      this.shouldReportError(exception)
    ])) {
      $window.trackJs.track(exception);
    }

    $log.error(exception);
  };

});

module.exports = MODULE_NAME;
