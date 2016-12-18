var fs = require('fs');
var path = require('path');

var URL_FLAG = '/+++/';
var SECRET_KEY_FILE = 'secret.js';
var JAVA_FILE = 'com/tkyaji/cordova/DecryptResource.java';
var IOS_FILE = 'CDVCryptURLProtocol.m';

function replaceCryptKey_ios(pluginDir, key, iv) {

    var sourceFile = path.join(pluginDir, IOS_FILE);
    var content = fs.readFileSync(sourceFile, 'utf-8');

    content = content.replace(/SECRET_KEY = @".*";/, 'SECRET_KEY = @"' + secretKey + '";');

    fs.writeFileSync(sourceFile, content, 'utf-8');
}

function replaceCryptKey_android(pluginDir, secretKey) {

    var sourceFile = path.join(pluginDir, JAVA_FILE);
    var content = fs.readFileSync(sourceFile, 'utf-8');

    content = content.replace(/SECRET_KEY = ".*";/, 'SECRET_KEY = "' + secretKey + '";');

    fs.writeFileSync(sourceFile, content, 'utf-8');
}

module.exports = function(context) {

    var path = context.requireCordovaModule('path'),
        fs = context.requireCordovaModule('fs'),
        crypto = context.requireCordovaModule('crypto'),
        Q = context.requireCordovaModule('q'),
        cordova_util = context.requireCordovaModule('cordova-lib/src/cordova/util'),
        platforms = context.requireCordovaModule('cordova-lib/src/platforms/platforms'),
        Parser = context.requireCordovaModule('cordova-lib/src/cordova/metadata/parser'),
        ParserHelper = context.requireCordovaModule('cordova-lib/src/cordova/metadata/parserhelper/ParserHelper'),
        ConfigParser = context.requireCordovaModule('cordova-common').ConfigParser;

    var deferral = new Q.defer();
    var projectRoot = cordova_util.cdProjectRoot();


    context.opts.platforms.map(function(platform) {
        var platformPath = path.join(projectRoot, 'platforms', platform);
        var platformApi = platforms.getPlatformApi(platform, platformPath);
        var platformInfo = platformApi.getPlatformInfo();
        var wwwDir = platformInfo.locations.www;

        var secretKey = fs.readFileSync(wwwDir + '/' + SECRET_KEY_FILE, 'utf-8');
        var randomInt = String(Math.random() * 1E8 >> 0) + (Math.random() * 1E8 >> 0);
        fs.writeFileSync(wwwDir + '/' + SECRET_KEY_FILE, randomInt, 'utf-8');

        if (platform == 'ios') {
            var ios_parser = context.requireCordovaModule('cordova-lib/src/cordova/metadata/ios_parser');
            var iosParser = new ios_parser(platformPath);
            var pluginDir = path.join(iosParser.cordovaproj, 'Plugins', context.opts.plugin.id);
            replaceCryptKey_ios(pluginDir, secretKey);

        } else if (platform == 'android') {
            var pluginDir = path.join(platformPath, 'src');
            replaceCryptKey_android(pluginDir, secretKey);

            var cfg = new ConfigParser(platformInfo.projectConfig.path);
            cfg.doc.getroot().getchildren().filter(function(child, idx, arr) {
                return (child.tag == 'content');
            }).map(function(child) {
                child.attrib.src = URL_FLAG + child.attrib.src;
            });

            cfg.write();
        }
    });

    deferral.resolve();
    return deferral.promise;
}
